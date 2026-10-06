// Phase 1 client-journey QA. Local jj_preview database ONLY; mail is captured
// in memory (MAILER_TEST_OUTBOX=1). Run:
//   MAILER_TEST_OUTBOX=1 DATABASE_URL=postgres://jj:jj@localhost:5432/jj_preview npx tsx script/phase1-journey-qa.ts
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";

const url = new URL(process.env.DATABASE_URL!);
assert.ok(["127.0.0.1", "localhost"].includes(url.hostname) && url.pathname === "/jj_preview", "QA is restricted to the local jj_preview database");
assert.equal(process.env.MAILER_TEST_OUTBOX, "1", "Set MAILER_TEST_OUTBOX=1");
delete process.env.ORIENTATION_CALENDLY_URL;
delete process.env.DEBRIEF_CALENDLY_URL;

const { db, storage, OrientationRequiredError } = await import("../server/storage");
const { churches, surveyWaves, aggregateSnapshots, churchEmailEvents } = await import("../shared/schema");
const { testOutbox, setTestMailFailures } = await import("../server/mailer");
const J = await import("../server/journey");
const { bookingConfig } = await import("../server/journeyConfig");
const { DEMO_CHURCH_ID } = await import("../shared/surveyAccess");

let passed = 0;
async function test(name: string, fn: () => Promise<void> | void) {
  await fn(); passed++; console.log("  ✓", name);
}
const day = (offset: number, from = new Date()) => new Date(from.getTime() + offset * 86400000).toISOString().slice(0, 10);
const tag = randomUUID().slice(0, 8);
const outboxFor = (pred: (m: (typeof testOutbox)[number]) => boolean) => testOutbox.filter(pred);
const clear = () => { testOutbox.length = 0; };

async function makeChurch(opts: { coordinator?: string; pastor?: string; pastorResults?: boolean; id?: string } = {}) {
  const id = opts.id ?? `qa-${tag}-${randomUUID().slice(0, 6)}`;
  const email = `primary-${id}@example.test`;
  await db.insert(churches).values({
    id, name: `QA Church ${id.slice(-6)}`, primaryContactName: "Pat Primary", primaryContactEmail: email,
    communityCode: `QA-${id}`, passwordHash: "x",
    surveyCoordinatorName: opts.coordinator ? "Casey Coordinator" : null,
    surveyCoordinatorEmail: opts.coordinator ?? null,
    leadPastorName: opts.pastor ? "Rev. Lee" : null, leadPastorEmail: opts.pastor ?? null,
    leadPastorReceivesResults: !!opts.pastorResults,
  }).onConflictDoNothing();
  return (await storage.getChurchById(id))!;
}
async function makeWave(churchId: string, values: Partial<typeof surveyWaves.$inferInsert> = {}) {
  const id = `qaw-${randomUUID().slice(0, 10)}`;
  await db.insert(surveyWaves).values({
    id, churchId, label: "QA survey", status: "not_started", paymentStatus: "paid", joinCode: `QA${randomUUID().slice(0, 6)}`,
    minSampleSize: 40, opensAt: day(1), closesAt: day(22), paidAt: new Date().toISOString(), ...values,
  });
  return (await storage.getWaveById(id))!;
}
const plan = (w: { opensAt: string | null; closesAt: string | null; minSampleSize: number }) =>
  ({ opensAt: w.opensAt!, closesAt: w.closesAt!, minSampleSize: w.minSampleSize, overrides: {} });

console.log("Phase 1 client-journey QA");

await test("booking URLs absent → null config and helpful fallback in emails", async () => {
  const c = bookingConfig();
  assert.equal(c.orientationUrl, null); assert.equal(c.debriefUrl, null);
  assert.match(c.fallbackMessage, /admin@jesusjourney\.life/);
  process.env.ORIENTATION_CALENDLY_URL = "http://insecure.example"; // non-https is rejected
  assert.equal(bookingConfig().orientationUrl, null);
  delete process.env.ORIENTATION_CALENDLY_URL;
});

await test("recipient rules dedupe identical addresses and honour lead-pastor opt-in", async () => {
  const church = await makeChurch({ coordinator: `SAME-${tag}@example.test`, pastor: "pastor@example.test", pastorResults: false });
  await db.update(churches).set({ primaryContactEmail: `same-${tag}@example.test` }).where(eq(churches.id, church.id));
  const c2 = (await storage.getChurchById(church.id))!;
  assert.equal(J.recipientsFor("survey_activated", c2).length, 1);
  assert.equal(J.recipientsFor("reports_ready", c2).length, 1, "pastor excluded without opt-in");
  await db.update(churches).set({ leadPastorReceivesResults: true }).where(eq(churches.id, church.id));
  const c3 = (await storage.getChurchById(church.id))!;
  assert.deepEqual(J.recipientsFor("reports_ready", c3).map((r) => r.role), ["primary", "pastor"]);
  assert.deepEqual(J.recipientsFor("purchase_confirmed", c3).map((r) => r.role), ["primary"]);
});

const church = await makeChurch({ coordinator: `coord-${tag}@example.test` });
const wave = await makeWave(church.id);

await test("payment confirmation sends once (idempotent across retries) plus one internal notice", async () => {
  clear();
  await J.onWavePaid(wave.id); await J.onWavePaid(wave.id); await J.onWavePaid(wave.id);
  const client = outboxFor((m) => m.to === church.primaryContactEmail);
  assert.equal(client.length, 1); assert.match(client[0].subject, /ready to plan/);
  assert.match(client[0].text, /Hello Pat,/);
  assert.match(client[0].text, /Booking will be available shortly\. Please contact admin@jesusjourney\.life\./);
  assert.doesNotMatch(client[0].text + client[0].html, /undefined|\bnull\b|NaN/);
  const internal = outboxFor((m) => m.to === "admin@jesusjourney.life");
  assert.equal(internal.length, 1); assert.match(internal[0].subject, /^\[Jesus Journey\] New paid survey — /);
});

await test("activation is blocked server-side until orientation is marked complete", async () => {
  await assert.rejects(() => storage.confirmWavePlan(wave.id, church.id, plan(wave)), (e: any) => e instanceof OrientationRequiredError && e.code === "ORIENTATION_REQUIRED");
  await storage.updateWaveJourney(wave.id, { orientationBookedAt: day(3) });
  await assert.rejects(() => storage.confirmWavePlan(wave.id, church.id, plan(wave)), OrientationRequiredError, "booking alone never unlocks");
  const w = (await storage.getWaveById(wave.id))!;
  assert.equal(w.status, "not_started"); assert.equal(w.activatedAt, null);
});

await test("orientation completion sends separate follow-ups to primary and coordinator, once", async () => {
  clear();
  await storage.updateWaveJourney(wave.id, { orientationCompletedAt: new Date() });
  await J.onOrientationCompleted(wave.id); await J.onOrientationCompleted(wave.id);
  const f = outboxFor((m) => /survey launch plan/.test(m.subject));
  assert.equal(f.length, 2);
  assert.deepEqual(new Set(f.map((m) => m.to)), new Set([church.primaryContactEmail, church.surveyCoordinatorEmail]));
  assert.ok(f.some((m) => /Hello Casey,/.test(m.text)) && f.some((m) => /Hello Pat,/.test(m.text)));
});

await test("activation succeeds after orientation, records activatedAt, sends activation emails once", async () => {
  clear();
  const updated = await storage.confirmWavePlan(wave.id, church.id, plan(wave));
  assert.ok(["live", "prep", "closing_soon"].includes(updated.status)); assert.ok(updated.activatedAt);
  await J.onSurveyActivated(wave.id); await J.onSurveyActivated(wave.id);
  assert.equal(outboxFor((m) => /ready to launch/.test(m.subject)).length, 2);
  assert.equal(outboxFor((m) => /\] Survey activated —/.test(m.subject)).length, 1);
});

await test("reports-ready is never sent while a survey is open", async () => {
  clear();
  await J.onReportsReady(wave.id);
  assert.equal(testOutbox.length, 0);
  await assert.rejects(() => J.adminResend("reports_ready", wave.id));
});

await test("daily sweep: orientation reminders at 48h, no duplicates, stop once booked", async () => {
  const c = await makeChurch();
  const w = await makeWave(c.id, { paidAt: new Date(Date.now() - 2 * 86400000).toISOString() });
  clear();
  await J.runJourneySweep(); await J.runJourneySweep();
  assert.equal(outboxFor((m) => m.to === c.primaryContactEmail && /book your Jesus Journey Survey Orientation/.test(m.subject)).length, 1);
  const w2 = await makeWave(c.id, { paidAt: new Date(Date.now() - 2 * 86400000).toISOString(), orientationBookedAt: day(4) });
  clear(); await J.runJourneySweep();
  const events = await storage.getEmailEventsByWave(w2.id);
  assert.equal(events.filter((e) => e.eventType === "orientation_reminder").length, 0);
  void w;
});

await test("daily sweep: third orientation reminder also alerts the internal team", async () => {
  const c = await makeChurch();
  await makeWave(c.id, { paidAt: new Date(Date.now() - 12 * 86400000).toISOString() });
  clear(); await J.runJourneySweep();
  assert.equal(outboxFor((m) => m.to === c.primaryContactEmail).length, 1);
  assert.ok(outboxFor((m) => m.to === "admin@jesusjourney.life" && /Orientation needs follow-up/.test(m.subject) && m.text.includes(c.name)).length === 1);
});

await test("closed surveys never receive collection reminders; close-or-extend only while active", async () => {
  const c = await makeChurch({ coordinator: `c2-${tag}@example.test` });
  const live = await makeWave(c.id, { status: "live", opensAt: day(-14), closesAt: day(0), activatedAt: new Date(Date.now() - 15 * 86400000), orientationCompletedAt: new Date() });
  const closed = await makeWave(c.id, { status: "closed", opensAt: day(-14), closesAt: day(0), activatedAt: new Date(Date.now() - 15 * 86400000), orientationCompletedAt: new Date(), closedAt: new Date().toISOString() });
  clear(); await J.runJourneySweep(); await J.runJourneySweep();
  const liveEvents = (await storage.getEmailEventsByWave(live.id)).filter((e) => e.eventType === "close_or_extend");
  assert.equal(liveEvents.length, 2, "coordinator + primary, once each");
  const closedEvents = await storage.getEmailEventsByWave(closed.id);
  assert.equal(closedEvents.filter((e) => ["early_checkin", "midpoint_reminder", "final_week", "close_or_extend"].includes(e.eventType)).length, 0);
});

await test("reports-ready after verified close, then debrief reminder 3 days later (not if booked)", async () => {
  const c = await makeChurch({ coordinator: `c3-${tag}@example.test`, pastor: `p3-${tag}@example.test`, pastorResults: true });
  const reportDay = new Date(Date.now() - 3 * 86400000).toISOString();
  const w = await makeWave(c.id, { status: "closed", closedAt: reportDay, reportGeneratedAt: reportDay, orientationCompletedAt: new Date() });
  clear();
  await J.onReportsReady(w.id);
  assert.equal(testOutbox.length, 0, "no report record → no announcement");
  await db.insert(aggregateSnapshots).values({ id: randomUUID(), waveId: w.id, churchId: c.id, respondentCount: 25, summaryJson: "{}", reportPdfPath: `${w.id}.pdf` });
  await J.onReportsReady(w.id);
  assert.equal(outboxFor((m) => /results are ready/i.test(m.subject)).length, 3, "primary, coordinator, opted-in pastor");
  clear(); const sw = await J.runJourneySweep(); await J.runJourneySweep();
  assert.deepEqual(sw.errors, []);
  assert.equal(outboxFor((m) => /Book your Jesus Journey results debrief/.test(m.subject)).length, 2);
  assert.equal(outboxFor((m) => /results are ready/i.test(m.subject)).length, 0, "catch-up does not resend");
  const booked = await makeWave(c.id, { status: "closed", closedAt: reportDay, reportGeneratedAt: reportDay, debriefBookedAt: day(5) });
  await db.insert(aggregateSnapshots).values({ id: randomUUID(), waveId: booked.id, churchId: c.id, respondentCount: 25, summaryJson: "{}", reportPdfPath: `${booked.id}.pdf` });
  await J.runJourneySweep();
  assert.equal((await storage.getEmailEventsByWave(booked.id)).filter((e) => e.eventType === "debrief_reminder").length, 0);
});

await test("delivery failure is recorded and raises one internal alert without looping", async () => {
  const c = await makeChurch();
  const w = await makeWave(c.id);
  setTestMailFailures([c.primaryContactEmail]);
  clear(); await J.onWavePaid(w.id);
  setTestMailFailures([]);
  const events = await storage.getEmailEventsByWave(w.id);
  assert.equal(events.find((e) => e.eventType === "purchase_confirmed")?.status, "failed");
  assert.equal(outboxFor((m) => /Email delivery failed/.test(m.subject)).length, 1);
  clear(); await J.onWavePaid(w.id); // a failed claim can be retried
  assert.equal(outboxFor((m) => m.to === c.primaryContactEmail).length, 1);
});

await test("admin resend uses a fresh key and is limited to approved messages", async () => {
  clear();
  const out = await J.adminResend("purchase_confirmed", wave.id);
  assert.equal(out.length, 1); assert.equal(out[0].status, "sent");
  assert.ok(!J.RESENDABLE.includes("close_or_extend" as any));
  const ev = await db.select().from(churchEmailEvents).where(eq(churchEmailEvents.waveId, wave.id));
  assert.ok(ev.some((e) => e.triggeredBy === "admin"));
});

await test("the shared Grace demo never sends journey email", async () => {
  const demoWaves = (await storage.getWavesByChurch(DEMO_CHURCH_ID));
  clear();
  for (const w of demoWaves) { await J.onWavePaid(w.id); await J.onReportsReady(w.id); }
  await J.runJourneySweep();
  assert.equal(outboxFor((m) => /demo@myjesusjourney/.test(m.to)).length, 0);
});

await test("JOURNEY_EMAILS_ENABLED=false pauses all journey email", async () => {
  process.env.JOURNEY_EMAILS_ENABLED = "false";
  const c = await makeChurch(); const w = await makeWave(c.id);
  clear(); await J.onWavePaid(w.id);
  const r = await J.runJourneySweep();
  assert.equal(testOutbox.length, 0); assert.equal(r.disabled, true);
  delete process.env.JOURNEY_EMAILS_ENABLED;
});

console.log(`\n${passed} Phase 1 journey checks passed.`);
process.exit(0);
