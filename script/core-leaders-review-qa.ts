// Core Leaders Review end to end. Local jj_preview database ONLY; report storage is a local fake.
//   ADMIN_KEY=qa-admin-key ADMIN_USERNAME=admin DATABASE_URL=postgres://jj:jj@localhost:5432/jj_preview npx tsx script/core-leaders-review-qa.ts
import assert from "node:assert/strict";
import crypto from "node:crypto";
import express from "express";
import { createServer } from "node:http";

const url = new URL(process.env.DATABASE_URL!);
assert.ok(["127.0.0.1", "localhost"].includes(url.hostname) && url.pathname === "/jj_preview", "QA is restricted to the local jj_preview database");

// Fake Supabase Storage so generated PDFs can be "uploaded" and read back.
const objects = new Map<string, Buffer>();
const fake = express();
fake.use(express.raw({ type: () => true, limit: "50mb" }));
fake.post(/^\/storage\/v1\/object\/(.+)$/, (req, res) => { objects.set(req.params[0], Buffer.from(req.body)); res.json({ Key: req.params[0] }); });
fake.put(/^\/storage\/v1\/object\/(.+)$/, (req, res) => { objects.set(req.params[0], Buffer.from(req.body)); res.json({ Key: req.params[0] }); });
fake.get(/^\/storage\/v1\/object\/(?:authenticated\/)?(.+)$/, (req, res) => {
  const b = objects.get(req.params[0]); if (!b) return res.status(404).json({ message: "not found" });
  res.type("application/pdf").send(b);
});
const fakeServer = createServer(fake);
await new Promise<void>((r) => fakeServer.listen(0, r));
process.env.SUPABASE_URL = `http://127.0.0.1:${(fakeServer.address() as any).port}`;
process.env.SUPABASE_SERVICE_ROLE_KEY = "qa-fake";

const { ensureBootstrapped, pool, storage } = await import("../server/storage");
const { registerRoutes } = await import("../server/routes");
const { createAdminSession, createSession } = await import("../server/auth");
const { saveChurchResponse } = await import("../server/closeSurvey");
const { ITEM_CODES } = await import("../shared/schema");
await ensureBootstrapped();
await (await import("../server/adminAccounts")).ensureAdminTables();

const app = express();
app.use(express.json());
const server = createServer(app);
await registerRoutes(server, app);
await new Promise<void>((r) => server.listen(0, r));
const base = `http://127.0.0.1:${(server.address() as any).port}`;
const call = async (method: string, path: string, body?: unknown, token?: string) => {
  const res = await fetch(base + path, { method, headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const buf = Buffer.from(await res.arrayBuffer());
  let json: any = {}; try { json = JSON.parse(buf.toString()); } catch {}
  return { status: res.status, json, text: buf.toString().slice(0, 300), buf, type: res.headers.get("content-type") };
};
let passed = 0;
const test = async (name: string, fn: () => Promise<void>) => { await fn(); passed++; console.log("  ✓", name); };

// ---- fixtures ---------------------------------------------------------------
const EMAIL = "core-leaders@example.test", MEMBER = "core-leaders-member@example.test";
for (const { id } of (await pool.query(`SELECT id FROM churches WHERE primary_contact_email = $1`, [EMAIL])).rows) {
  await pool.query(`DELETE FROM leader_reviews WHERE church_id = $1`, [id]);
  await pool.query(`DELETE FROM responses WHERE wave_id IN (SELECT id FROM survey_waves WHERE church_id = $1)`, [id]);
  await pool.query(`DELETE FROM respondents WHERE wave_id IN (SELECT id FROM survey_waves WHERE church_id = $1)`, [id]);
  await pool.query(`DELETE FROM church_email_events WHERE church_id = $1`, [id]).catch(() => {});
  await pool.query(`DELETE FROM survey_waves WHERE church_id = $1`, [id]);
  await pool.query(`DELETE FROM churches WHERE id = $1`, [id]);
}
await pool.query(`DELETE FROM admin_users WHERE email = $1`, [MEMBER]);
const church = await storage.createChurch({ name: "Leaders Test Church", primaryContactName: "Lee Example", primaryContactEmail: EMAIL, region: "British Columbia" } as any, "x");
const created = await storage.createWave(church.id, { label: "Leaders Survey", minSampleSize: 150, sizeTier: "upto_200" } as any, 49900, "cad");
await pool.query(`UPDATE survey_waves SET status = 'live', payment_status = 'paid' WHERE id = $1`, [created.id]);
const waveId = created.id, joinCode = created.joinCode;

const owner = createAdminSession();
const memberId = crypto.randomUUID();
await pool.query(`INSERT INTO admin_users (id, email, name, role) VALUES ($1, $2, 'QA Member', 'admin')`, [memberId, MEMBER]);
const member = createAdminSession({ id: memberId, sessionVersion: 0 });
const churchToken = createSession(church.id);

let seed = 11;
const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const answers = (lift: number) => Object.fromEntries(ITEM_CODES.map((c: string) => [c.toUpperCase(), Math.max(1, Math.min(5, Math.round(2.5 + lift + (rnd() - .5) * 2.4)))]));
const submit = (code: string, lift = 1) => call("POST", "/api/responses", { joinCode: code, items: answers(lift), journeyPre: 4, journeyPost: 4, spiritualChange: 2 });
const direct = (isCoreLeader: boolean, lift: number) => {
  const items = answers(lift);
  const cols = Object.fromEntries(ITEM_CODES.map((c: string) => [c, items[c.toUpperCase()]]));
  return saveChurchResponse(waveId, { ...cols, journeyPre: 4, journeyPost: isCoreLeader ? 5 : 3, spiritualChange: 2, isCoreLeader } as any);
};
const listEntry = async (token = owner) => {
  const list = await call("GET", "/api/admin/churches", undefined, token);
  const groups = list.json.churches ?? list.json;
  return groups.flatMap((g: any) => g.waves).find((e: any) => e.wave.id === waveId);
};

await test("bootstrap adds the new columns and an RLS-protected leader_reviews table", async () => {
  const cols = (await pool.query(`SELECT table_name, column_name FROM information_schema.columns WHERE column_name IN ('core_leaders_enabled','leader_join_code','is_core_leader')`)).rows;
  assert.equal(cols.length, 3);
  const rls = (await pool.query(`SELECT relrowsecurity FROM pg_class WHERE relname = 'leader_reviews'`)).rows[0];
  assert.equal(rls?.relrowsecurity, true);
});

await test("off by default: no leader code anywhere, and the church dashboard hides it", async () => {
  const entry = await listEntry();
  assert.equal(entry.wave.coreLeadersEnabled, false);
  assert.equal(entry.wave.leaderJoinCode, null);
  assert.equal(entry.leaderResponseCount, 0);
  const mine = await call("GET", "/api/waves", undefined, churchToken);
  const w = (mine.json.waves ?? mine.json).find((x: any) => x.id === waveId);
  assert.equal(w.leaderJoinCode, null);
});

await test("only the owner can switch the round on; signed-out is refused", async () => {
  assert.equal((await call("PATCH", `/api/admin/waves/${waveId}/core-leaders`, { enabled: true })).status, 401);
  assert.equal((await call("PATCH", `/api/admin/waves/${waveId}/core-leaders`, { enabled: true }, member)).status, 403);
  assert.equal((await call("PATCH", `/api/admin/waves/${waveId}/core-leaders`, { enabled: "yes" }, owner)).status, 400);
});

let leaderCode = "";
await test("switching on creates a distinct five-character leader code the church can see", async () => {
  const r = await call("PATCH", `/api/admin/waves/${waveId}/core-leaders`, { enabled: true }, owner);
  assert.equal(r.status, 200, r.text);
  leaderCode = r.json.wave.leaderJoinCode;
  assert.match(leaderCode, /^[2-9A-HJKMNP-Z]{5}$/);
  assert.notEqual(leaderCode, joinCode);
  const mine = await call("GET", "/api/waves", undefined, churchToken);
  assert.equal((mine.json.waves ?? mine.json).find((x: any) => x.id === waveId).leaderJoinCode, leaderCode);
});

await test("leader code joins the same survey and flags the response; church code does not", async () => {
  const j = await call("GET", `/api/join/${leaderCode.toLowerCase()}`);
  assert.equal(j.status, 200, j.text);
  assert.equal(j.json.waveId, waveId);
  assert.equal((await submit(leaderCode, 1.3)).status, 201);
  assert.equal((await submit(joinCode, 0)).status, 201);
  const rows = (await pool.query(`SELECT is_core_leader FROM responses WHERE wave_id = $1 ORDER BY created_at`, [waveId])).rows;
  assert.deepEqual(rows.map((r) => r.is_core_leader).sort(), [false, true]);
});

await test("preparing the review is refused under 30 leaders", async () => {
  for (let i = 0; i < 28; i++) await direct(true, 1.2);
  const entry = await listEntry(member);
  assert.equal(entry.leaderResponseCount, 29);
  assert.equal(entry.leaderMinimum, 30);
  const r = await call("POST", `/api/admin/waves/${waveId}/core-leaders/generate`, undefined, member);
  assert.equal(r.status, 409, r.text);
  assert.match(r.json.message, /at least 30/);
});

await test("at 30+ leaders any administrator can prepare it; survey stays open and nothing is deleted", async () => {
  for (let i = 0; i < 3; i++) await direct(true, 1.2);
  for (let i = 0; i < 40; i++) await direct(false, 0);
  const before = Number((await pool.query(`SELECT count(*) FROM responses WHERE wave_id = $1`, [waveId])).rows[0].count);
  const r = await call("POST", `/api/admin/waves/${waveId}/core-leaders/generate`, undefined, member);
  assert.equal(r.status, 200, r.text);
  assert.equal(r.json.leaderReview.respondentCount, 32);
  const after = Number((await pool.query(`SELECT count(*) FROM responses WHERE wave_id = $1`, [waveId])).rows[0].count);
  assert.equal(after, before);
  assert.equal((await storage.getWaveById(waveId))!.status, "live");
});

await test("both PDFs download for administrators only", async () => {
  for (const route of ["leaders-review.pdf", "leaders-facilitator.pdf"]) {
    assert.equal((await call("GET", `/api/admin/waves/${waveId}/${route}`)).status, 401);
    const r = await call("GET", `/api/admin/waves/${waveId}/${route}`, undefined, member);
    assert.equal(r.status, 200, r.text);
    assert.equal(r.buf.subarray(0, 5).toString(), "%PDF-");
  }
});

await test("preparing again overwrites the one saved review with the latest answers", async () => {
  await direct(true, 1.2);
  const r = await call("POST", `/api/admin/waves/${waveId}/core-leaders/generate`, undefined, owner);
  assert.equal(r.status, 200, r.text);
  assert.equal(r.json.leaderReview.respondentCount, 33);
  assert.equal(Number((await pool.query(`SELECT count(*) FROM leader_reviews WHERE wave_id = $1`, [waveId])).rows[0].count), 1);
  const entry = await listEntry();
  assert.equal(entry.leaderReview.respondentCount, 33);
});

await test("switching off stops the leader code at once but keeps it for switching back on", async () => {
  assert.equal((await call("PATCH", `/api/admin/waves/${waveId}/core-leaders`, { enabled: false }, owner)).status, 200);
  assert.equal((await call("GET", `/api/join/${leaderCode}`)).status, 404);
  assert.equal((await submit(leaderCode)).status, 404);
  assert.equal((await call("POST", `/api/admin/waves/${waveId}/core-leaders/generate`, undefined, owner)).status, 409);
  const mine = await call("GET", "/api/waves", undefined, churchToken);
  assert.equal((mine.json.waves ?? mine.json).find((x: any) => x.id === waveId).leaderJoinCode, null);
  const on = await call("PATCH", `/api/admin/waves/${waveId}/core-leaders`, { enabled: true }, owner);
  assert.equal(on.json.wave.leaderJoinCode, leaderCode);
});

await test("leader responses count toward the purchased response limit", async () => {
  const total = Number((await pool.query(`SELECT count(*) FROM responses WHERE wave_id = $1`, [waveId])).rows[0].count);
  await pool.query(`UPDATE survey_waves SET response_limit_override = $2 WHERE id = $1`, [waveId, total]);
  const r = await submit(leaderCode);
  assert.equal(r.status, 409, r.text);
  await pool.query(`UPDATE survey_waves SET response_limit_override = NULL WHERE id = $1`, [waveId]);
});

await test("the shared demo church cannot use it", async () => {
  const { DEMO_CHURCH_ID } = await import("../shared/surveyAccess");
  let demo = (await pool.query(`SELECT id FROM churches WHERE id = $1`, [DEMO_CHURCH_ID])).rows[0];
  const madeDemo = !demo;
  if (madeDemo) {
    const c = await storage.createChurch({ name: "Demo QA", primaryContactName: "Demo", primaryContactEmail: "demo-leaders@example.test", region: "British Columbia" } as any, "x");
    await pool.query(`UPDATE churches SET id = $1 WHERE id = $2`, [DEMO_CHURCH_ID, c.id]);
  }
  const w = await storage.createWave(DEMO_CHURCH_ID, { label: "Demo QA", minSampleSize: 10, sizeTier: "upto_200" } as any, 0, "cad");
  assert.equal((await call("PATCH", `/api/admin/waves/${w.id}/core-leaders`, { enabled: true }, owner)).status, 403);
  assert.equal((await call("POST", `/api/admin/waves/${w.id}/core-leaders/generate`, undefined, owner)).status, 403);
  await pool.query(`DELETE FROM survey_waves WHERE id = $1`, [w.id]);
  if (madeDemo) await pool.query(`DELETE FROM churches WHERE id = $1`, [DEMO_CHURCH_ID]);
});

await test("closing passes the leaders flag and the final Facilitator's Report gets the comparison", async () => {
  const { closeSurvey } = await import("../server/closeSurvey");
  const { generateSurveyReviewPdfs } = await import("../server/surveyReviewPdf");
  const { execFileSync } = await import("node:child_process");
  const { writeFileSync } = await import("node:fs");
  let flag: unknown;
  const ok = async () => ({ ok: true, storageKey: "stub.pdf", commentsStorageKey: "stub-c.pdf" });
  await closeSurvey(waveId, true, {
    church: ok as any, debrief: ok as any,
    surveyReview: async (p: any) => { flag = p.leadersComparison; return generateSurveyReviewPdfs(p); },
  } as any);
  assert.equal(flag, true);
  const fac = objects.get(`church-reports/${waveId}-facilitator.pdf`);
  const rev = objects.get(`church-reports/${waveId}-survey-review.pdf`);
  assert.ok(fac && rev, "final Survey Review PDFs saved");
  writeFileSync("/tmp/qa-final-fac.pdf", fac!); writeFileSync("/tmp/qa-final-rev.pdf", rev!);
  assert.match(execFileSync("pdftotext", ["/tmp/qa-final-fac.pdf", "-"]).toString(), /Our leaders and the congregation/);
  assert.doesNotMatch(execFileSync("pdftotext", ["/tmp/qa-final-rev.pdf", "-"]).toString(), /Our leaders and the congregation/);
});

await test("after close: raw responses are gone, the saved leader review stays, and the round is locked", async () => {
  assert.equal(Number((await pool.query(`SELECT count(*) FROM responses WHERE wave_id = $1`, [waveId])).rows[0].count), 0);
  const entry = await listEntry();
  assert.equal(entry.leaderResponseCount, 33);
  assert.equal((await call("GET", `/api/admin/waves/${waveId}/leaders-review.pdf`, undefined, owner)).status, 200);
  assert.equal((await call("PATCH", `/api/admin/waves/${waveId}/core-leaders`, { enabled: false }, owner)).status, 409);
  assert.equal((await call("POST", `/api/admin/waves/${waveId}/core-leaders/generate`, undefined, owner)).status, 409);
});

console.log(`\n${passed} Core Leaders checks passed.`);
await pool.query(`DELETE FROM admin_users WHERE email = $1`, [MEMBER]);
server.close(); fakeServer.close(); await pool.end();
process.exit(0);
