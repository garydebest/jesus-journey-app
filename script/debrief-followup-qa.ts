// Debrief follow-up draft QA. Local jj_preview database ONLY; mail captured in
// memory; the AI call is replaced with a deterministic stub. Run:
//   MAILER_TEST_OUTBOX=1 DATABASE_URL=postgres://jj:jj@localhost:5432/jj_preview npx tsx script/debrief-followup-qa.ts
import assert from "node:assert/strict";
import crypto, { randomUUID } from "node:crypto";

const url = new URL(process.env.DATABASE_URL!);
assert.ok(["127.0.0.1", "localhost"].includes(url.hostname) && url.pathname === "/jj_preview", "QA is restricted to the local jj_preview database");
assert.equal(process.env.MAILER_TEST_OUTBOX, "1", "Set MAILER_TEST_OUTBOX=1");

const { db, storage, pool } = await import("../server/storage");
const { churches, surveyWaves } = await import("../shared/schema");
const { testOutbox } = await import("../server/mailer");
const A = await import("../server/adminAccounts");
const F = await import("../server/debriefFollowup");

let passed = 0;
async function test(name: string, fn: () => Promise<void>) { await fn(); passed++; console.log("  ✓", name); }
const tag = randomUUID().slice(0, 6);
await A.ensureAdminTables();
await storage.getChurchById("bootstrap");
await F.ensureFollowupTables();

const adminId = randomUUID();
await pool.query(`INSERT INTO admin_users (id, email, name, role, notice_email) VALUES ($1, $2, 'Melt van der Spuy', 'admin', $3)`, [adminId, `melt-${tag}@newjoy.test`, `melt-${tag}@jj.test`]);
const churchId = `qa-fu-${tag}`;
const primary = `pat-${tag}@church.test`; const coord = `chris-${tag}@church.test`;
await db.insert(churches).values({
  id: churchId, name: `Followup Church ${tag}`, primaryContactName: "Pat Lee", primaryContactEmail: primary,
  surveyCoordinatorName: "Chris Wong", surveyCoordinatorEmail: coord, communityCode: `QU-${tag}`, passwordHash: "x",
});
await storage.setChurchFacilitator(churchId, adminId);
const waveId = `qaw-fu-${tag}`;
await db.insert(surveyWaves).values({ id: waveId, churchId, label: "Spring", status: "closed", paymentStatus: "paid", joinCode: `QU${tag}`, minSampleSize: 40, debriefBookedAt: "2026-11-12" });
const orientWaveId = `qaw-fo-${tag}`;

// Deterministic stand-in for the AI call. Captures what it was given.
let lastPrompt = "";
F.setCompleterForTests(async (_sys, user) => {
  lastPrompt = user;
  return JSON.stringify({
    strengths: ["People feel welcomed on Sunday mornings", "Our prayer life is growing"],
    questions: ["Why do newer people struggle to find a small group?"],
    nextSteps: [{ step: "Share the results with the elders", owner: "Pat", date: "December 1" }, { step: "Plan a small-group launch", owner: "", date: "" }],
    growthPlanInterest: true,
    reviewNotes: "The owner of the small-group launch wasn't named.",
  });
});

const SECRET_BYTES = crypto.randomBytes(24);
const SECRET = `whsec_${SECRET_BYTES.toString("base64")}`;
function sign(body: string, id = `msg_${tag}`, ts = Math.floor(Date.now() / 1000)) {
  const sig = crypto.createHmac("sha256", SECRET_BYTES).update(`${id}.${ts}.${body}`).digest("base64");
  return { "webhook-id": id, "webhook-timestamp": String(ts), "webhook-signature": `v1,bogus v1,${sig}` };
}

const longTalk = "We talked through the Survey Review together and agreed on what to celebrate and what to look into next. ".repeat(6);
const meeting = (over: Partial<F.FathomMeeting> = {}): F.FathomMeeting => ({
  title: "Jesus Journey Results Debrief", meeting_title: "Results Debrief", recording_id: `rec-${tag}`,
  url: `https://fathom.video/calls/${tag}`, share_url: `https://fathom.video/share/${tag}`,
  recording_start_time: "2026-11-12T18:00:00Z",
  calendar_invitees: [{ name: "Pat Lee", email: primary.toUpperCase(), is_external: true }, { name: "Gary Best", email: "garydebest@gmail.com", is_external: false }],
  recorded_by: { name: "Gary Best", email: "garydebest@gmail.com" },
  transcript: [
    { speaker: { display_name: "Gary Best" }, text: "Thanks for joining. " + longTalk, timestamp: "00:00:05" },
    { speaker: { display_name: "Pat Lee", matched_calendar_invitee_email: primary }, text: "SECRET-TRANSCRIPT-MARKER " + longTalk, timestamp: "00:01:10" },
  ],
  default_summary: { markdown_formatted: "## Summary\nThe team reviewed results." },
  action_items: [{ description: "Share results with elders", assignee: { name: "Pat Lee", email: primary } }],
  ...over,
});

console.log("Debrief follow-up QA");

await test("signature: valid Standard Webhooks signature passes; tampering, stale time and wrong secret fail", async () => {
  const body = JSON.stringify({ a: 1 });
  assert.equal(F.verifyFathomSignature(body, sign(body), SECRET).valid, true);
  assert.equal(F.verifyFathomSignature(body + " ", sign(body), SECRET).valid, false);
  assert.equal(F.verifyFathomSignature(body, sign(body, "m", Math.floor(Date.now() / 1000) - 900), SECRET).valid, false);
  assert.equal(F.verifyFathomSignature(body, sign(body), `whsec_${crypto.randomBytes(24).toString("base64")}`).valid, false);
  assert.equal(F.verifyFathomSignature(body, {}, SECRET).valid, false);
});

await test("matching: church contact + debrief date matches; orientation calls and strangers don't", async () => {
  const m = await F.matchDebrief(meeting());
  assert.ok("church" in m && m.wave.id === waveId);
  // Untitled call on the booked date still matches by date.
  const byDate = await F.matchDebrief(meeting({ title: "Zoom meeting", meeting_title: "Zoom meeting" }));
  assert.ok("church" in byDate && byDate.wave.id === waveId);
  // Untitled call on another day doesn't.
  const other = await F.matchDebrief(meeting({ title: "Zoom meeting", meeting_title: "Zoom meeting", recording_start_time: "2026-10-01T18:00:00Z" }));
  assert.ok(!("church" in other) && other.looksLikeDebrief === false);
  const orient = await F.matchDebrief(meeting({ title: "Survey Orientation", meeting_title: "Survey Orientation" }));
  assert.ok(!("church" in orient));
  const stranger = await F.matchDebrief(meeting({ calendar_invitees: [{ email: "nobody@else.test" }], transcript: [] }));
  assert.ok(!("church" in stranger) && stranger.looksLikeDebrief === true);
});

await test("webhook handling: drafts once, notifies internally (with facilitator copy), never emails the church", async () => {
  testOutbox.length = 0;
  const outcome = await F.handleFathomMeeting(meeting());
  assert.match(outcome, /^drafted/);
  const f = (await F.getFollowup(waveId))!;
  assert.equal(f.status, "draft"); assert.equal(f.source, "fathom"); assert.equal(f.fathomUrl, `https://fathom.video/share/${tag}`);
  assert.equal(f.subject, F.FOLLOWUP_SUBJECT);
  assert.match(f.body, /^Dear Pat and Chris,/);
  assert.match(f.body, /Strengths you want to celebrate:\n- People feel welcomed/);
  assert.match(f.body, /- Share the results with the elders – Pat – December 1/);
  assert.match(f.body, /- Plan a small-group launch – \[owner to confirm\] – \[date to confirm\]/);
  assert.match(f.body, /Act tab of your dashboard: .*\/#\/church/);
  assert.match(f.body, /Thank you for your interest in the Growth Plan\. Gary will be in touch about details\./);
  assert.match(f.body, /With gratitude,\nMelt van der Spuy\nJesus Journey$/);
  assert.equal(f.reviewNotes, "The owner of the small-group launch wasn't named.");
  assert.match(lastPrompt, /SECRET-TRANSCRIPT-MARKER/);
  assert.match(lastPrompt, /Share results with elders \(Pat Lee\)/);
  // Only internal notices went out.
  assert.ok(testOutbox.length >= 1);
  assert.ok(testOutbox.every((m) => m.to !== primary && m.to !== coord));
  assert.ok(testOutbox.some((m) => /Debrief follow-up draft ready — Followup Church .* — Melt/.test(m.subject)));
  assert.ok(testOutbox.some((m) => m.to === `melt-${tag}@jj.test`));
  // Retried delivery is ignored.
  testOutbox.length = 0;
  assert.equal(await F.handleFathomMeeting(meeting()), "duplicate");
  assert.equal(testOutbox.length, 0);
});

await test("privacy: the transcript is not stored anywhere in the follow-up tables", async () => {
  const { rows } = await pool.query(`SELECT row_to_json(t)::text AS j FROM debrief_followups t UNION ALL SELECT row_to_json(e)::text FROM fathom_webhook_events e`);
  assert.ok(rows.length > 0);
  assert.ok(rows.every((r) => !r.j.includes("SECRET-TRANSCRIPT-MARKER")));
});

await test("unmatched debrief recording sends an internal 'not matched' notice only", async () => {
  testOutbox.length = 0;
  const outcome = await F.handleFathomMeeting(meeting({ recording_id: `rec2-${tag}`, calendar_invitees: [{ email: "nobody@else.test" }], transcript: [] }));
  assert.equal(outcome, "unmatched debrief");
  assert.equal(testOutbox.length, 1);
  assert.match(testOutbox[0].subject, /Debrief recording not matched/);
  assert.ok(!testOutbox[0].text!.includes("SECRET-TRANSCRIPT-MARKER"));
});

await test("edits are saved; a later recording doesn't overwrite an edited draft", async () => {
  const before = (await F.getFollowup(waveId))!;
  const edited = await F.saveFollowupEdits(waveId, before.subject, before.body.replace("[owner to confirm]", "Chris").replace("[date to confirm]", "January 15"));
  assert.equal(edited.edited, true);
  await assert.rejects(F.saveFollowupEdits(waveId, "", "x"));
  testOutbox.length = 0;
  assert.equal(await F.handleFathomMeeting(meeting({ recording_id: `rec3-${tag}` })), "kept edited draft");
  assert.match((await F.getFollowup(waveId))!.body, /Plan a small-group launch – Chris – January 15/);
});

await test("pasted transcript: too-short text is refused; failure of the AI is surfaced cleanly", async () => {
  const church = (await storage.getChurchById(churchId))!; const wave = (await storage.getWaveById(waveId))!;
  await assert.rejects(F.draftFromText(church, wave, "too short", { source: "pasted" }), /too short/);
  F.setCompleterForTests(async () => "not json");
  await assert.rejects(F.draftFromText(church, wave, longTalk, { source: "pasted" }), /unexpected format/);
  F.setCompleterForTests(async () => JSON.stringify({ strengths: [], questions: [], nextSteps: [], growthPlanInterest: false, reviewNotes: "" }));
});

await test("send: goes to primary contact and coordinator, recorded in email history, then locked", async () => {
  const church = (await storage.getChurchById(churchId))!; const wave = (await storage.getWaveById(waveId))!;
  testOutbox.length = 0;
  const { followup, outcomes } = await F.sendFollowup(church, wave, "Melt van der Spuy");
  assert.equal(followup.status, "sent"); assert.equal(followup.sentBy, "Melt van der Spuy");
  assert.deepEqual(outcomes.map((o) => o.recipient).sort(), [coord, primary].sort());
  assert.deepEqual(testOutbox.map((m) => m.to).sort(), [coord, primary].sort());
  assert.ok(testOutbox.every((m) => m.subject === F.FOLLOWUP_SUBJECT && /<ul>/.test(m.html) && /href="http/.test(m.html)));
  const events = (await storage.getEmailEventsByWave(waveId)).filter((e) => e.eventType === F.FOLLOWUP_EVENT_TYPE);
  assert.equal(events.length, 2); assert.ok(events.every((e) => e.status === "sent" && e.triggeredBy === "admin"));
  await assert.rejects(F.sendFollowup(church, wave, "x"), /already sent/);
  await assert.rejects(F.saveFollowupEdits(waveId, "s", "b"), /no unsent draft/);
  await assert.rejects(F.draftFromText(church, wave, longTalk, { source: "pasted" }), /already been sent/);
  assert.equal(await F.handleFathomMeeting(meeting({ recording_id: `rec4-${tag}` })), "skipped: follow-up already sent");
});

await test("pasted draft for a church with no facilitator is signed by the admin who drafted it", async () => {
  const c2 = `qa-fu2-${tag}`; const w2 = `qaw-fu2-${tag}`;
  await db.insert(churches).values({ id: c2, name: `Second ${tag}`, primaryContactName: "Sam", primaryContactEmail: `sam-${tag}@church.test`, communityCode: `QV-${tag}`, passwordHash: "x" });
  await db.insert(surveyWaves).values({ id: w2, churchId: c2, label: "Fall", status: "closed", paymentStatus: "paid", joinCode: `QV${tag}`, minSampleSize: 40 });
  const f = await F.draftFromText((await storage.getChurchById(c2))!, (await storage.getWaveById(w2))!, longTalk, { source: "pasted", fallbackSigner: "Gary Best" });
  assert.equal(f.source, "pasted");
  assert.match(f.body, /^Dear Sam,/);
  assert.match(f.body, /- \[add two or three strengths/);
  assert.ok(!/Growth Plan/.test(f.body));
  assert.match(f.body, /With gratitude,\nGary Best\nJesus Journey$/);
  assert.equal(F.followupRecipients((await storage.getChurchById(c2))!).length, 1);
});
void orientWaveId;

console.log(`\n${passed} debrief follow-up checks passed.`);
await pool.end();
process.exit(0);
