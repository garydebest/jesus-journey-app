// Owner-only response-limit override. Local jj_preview database ONLY.
//   MAILER_TEST_OUTBOX=1 ADMIN_KEY=qa-admin-key ADMIN_USERNAME=admin DATABASE_URL=postgres://jj:jj@localhost:5432/jj_preview npx tsx script/response-limit-override-qa.ts
import assert from "node:assert/strict";
import crypto from "node:crypto";
import express from "express";
import { createServer } from "node:http";

const url = new URL(process.env.DATABASE_URL!);
assert.ok(["127.0.0.1", "localhost"].includes(url.hostname) && url.pathname === "/jj_preview", "QA is restricted to the local jj_preview database");

const { ensureBootstrapped, pool, storage } = await import("../server/storage");
const { registerRoutes } = await import("../server/routes");
const { createAdminSession, createSession } = await import("../server/auth");
const { saveChurchResponse } = await import("../server/closeSurvey");
const { responseLimitForWave } = await import("../server/pricing");
await ensureBootstrapped();

const app = express();
app.use(express.json());
const server = createServer(app);
await registerRoutes(server, app);
await new Promise<void>((r) => server.listen(0, r));
const base = `http://127.0.0.1:${(server.address() as any).port}`;
const call = async (method: string, path: string, body?: unknown, token?: string) => {
  const res = await fetch(base + path, { method, headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let json: any = {}; try { json = JSON.parse(text); } catch {}
  return { status: res.status, json, text };
};
let passed = 0;
const test = async (name: string, fn: () => Promise<void>) => { await fn(); passed++; console.log("  ✓", name); };

// ---- fixtures ---------------------------------------------------------------
const EMAIL = "limit-override@example.test", MEMBER = "limit-member@example.test";
for (const { id } of (await pool.query(`SELECT id FROM churches WHERE primary_contact_email = $1`, [EMAIL])).rows) {
  await pool.query(`DELETE FROM responses WHERE wave_id IN (SELECT id FROM survey_waves WHERE church_id = $1)`, [id]);
  await pool.query(`DELETE FROM respondents WHERE wave_id IN (SELECT id FROM survey_waves WHERE church_id = $1)`, [id]);
  await pool.query(`DELETE FROM church_email_events WHERE church_id = $1`, [id]).catch(() => {});
  await pool.query(`DELETE FROM survey_waves WHERE church_id = $1`, [id]);
  await pool.query(`DELETE FROM churches WHERE id = $1`, [id]);
}
await pool.query(`DELETE FROM admin_users WHERE email = $1`, [MEMBER]);
const church = await storage.createChurch({ name: "Limit Test Church", primaryContactName: "Lee Example", primaryContactEmail: EMAIL, region: "British Columbia" } as any, "x");
const created = await storage.createWave(church.id, { label: "Limit Survey", minSampleSize: 150, sizeTier: "upto_200" } as any, 49900, "cad");
await pool.query(`UPDATE survey_waves SET status = 'live', payment_status = 'paid' WHERE id = $1`, [created.id]);
const waveId = created.id, joinCode = created.joinCode;
// 3 existing responses
const answer = () => saveChurchResponse(waveId, { journeyPre: 3 } as any);
for (let i = 0; i < 3; i++) await answer();

const owner = createAdminSession(); // shared login counts as the owner
const memberId = crypto.randomUUID();
await pool.query(`INSERT INTO admin_users (id, email, name, role) VALUES ($1, $2, 'QA Member', 'admin')`, [memberId, MEMBER]);
const member = createAdminSession({ id: memberId, sessionVersion: 0 });
const patch = (body: unknown, token?: string) => call("PATCH", `/api/admin/waves/${waveId}/response-limit`, body, token);

await test("pure rule: override wins, 0 means no limit, null falls back to the tier", async () => {
  assert.equal(responseLimitForWave({ sizeTier: "upto_200", responseLimitOverride: null }), 200);
  assert.equal(responseLimitForWave({ sizeTier: "upto_200", responseLimitOverride: 250 }), 250);
  assert.equal(responseLimitForWave({ sizeTier: "upto_200", responseLimitOverride: 0 }), null);
  assert.equal(responseLimitForWave({ sizeTier: "over_1500", responseLimitOverride: 40 }), 40);
});

await test("signed-out and non-owner administrators are refused", async () => {
  assert.equal((await patch({ mode: "custom", limit: 3 })).status, 401);
  const r = await patch({ mode: "custom", limit: 3 }, member);
  assert.equal(r.status, 403, r.text);
  assert.equal((await storage.getWaveById(waveId))!.responseLimitOverride, null);
});

await test("validation: unknown mode and bad numbers are refused", async () => {
  for (const body of [{}, { mode: "x" }, { mode: "custom" }, { mode: "custom", limit: 0 }, { mode: "custom", limit: 2.5 }, { mode: "custom", limit: 100001 }, { mode: "custom", limit: "abc" }]) {
    assert.equal((await patch(body, owner)).status, 400, JSON.stringify(body));
  }
});

await test("admin listing shows plan and effective limits; church API never sees the override field", async () => {
  const list = await call("GET", "/api/admin/churches", undefined, owner);
  const entry = list.json.churches?.flatMap((g: any) => g.waves).find((e: any) => e.wave.id === waveId) ?? list.json.flatMap?.((g: any) => g.waves).find((e: any) => e.wave.id === waveId);
  assert.ok(entry, "wave listed");
  assert.equal(entry.wave.planResponseLimit, 200);
  assert.equal(entry.wave.responseLimit, 200);
  assert.equal(entry.wave.responseLimitOverride, null);
});

await test("lowering the limit on a live survey to the current count blocks new participants immediately", async () => {
  const r = await patch({ mode: "custom", limit: 3 }, owner);
  assert.equal(r.status, 200, r.text);
  assert.equal(r.json.wave.responseLimit, 3);
  assert.equal(r.json.wave.responseLimitOverride, 3);
  assert.equal(r.json.wave.planResponseLimit, 200);
  assert.equal(r.json.responses, 3);
  const mine = await call("GET", "/api/waves", undefined, createSession(church.id));
  const w = mine.json.waves.find((x: any) => x.id === waveId);
  assert.equal(w.responseLimit, 3, "church sees the limit in force");
  assert.ok(!("responseLimitOverride" in w) && !("planResponseLimit" in w), "church never sees override details");
  const join = await call("GET", `/api/join/${joinCode}`);
  assert.equal(join.status, 409);
  assert.equal(join.json.code, "RESPONSE_LIMIT_REACHED");
  assert.doesNotMatch(join.json.message, /plan|tier/i, "participants are not told about plans");
  await assert.rejects(answer(), (e: any) => e.code === "RESPONSE_LIMIT_REACHED");
  const { rows } = await pool.query(`SELECT count(*)::int AS n FROM responses WHERE wave_id = $1`, [waveId]);
  assert.equal(rows[0].n, 3, "existing responses kept");
});

await test("raising the limit reopens the survey straight away", async () => {
  assert.equal((await patch({ mode: "custom", limit: 4 }, owner)).status, 200);
  assert.equal((await call("GET", `/api/join/${joinCode}`)).status, 200);
  await answer();
  await assert.rejects(answer(), (e: any) => e.code === "RESPONSE_LIMIT_REACHED");
});

await test("no limit, then back to the plan limit", async () => {
  const none = await patch({ mode: "none" }, owner);
  assert.equal(none.status, 200);
  assert.equal(none.json.wave.responseLimit, null);
  assert.equal(none.json.wave.responseLimitOverride, 0);
  await answer();
  const plan = await patch({ mode: "plan" }, owner);
  assert.equal(plan.json.wave.responseLimit, 200);
  assert.equal(plan.json.wave.responseLimitOverride, null);
  assert.equal((await call("GET", `/api/join/${joinCode}`)).status, 200);
});

await test("each change is recorded in admin activity", async () => {
  await new Promise((r) => setTimeout(r, 300));
  const { rows } = await pool.query(`SELECT action FROM admin_activity WHERE action LIKE '%response limit%' AND created_at > now() - interval '5 minutes' ORDER BY created_at`);
  const actions = rows.map((r: any) => r.action);
  for (const a of ["Set response limit to 3", "Set response limit to 4", "Removed the response limit", "Set response limit to the plan default"]) assert.ok(actions.includes(a), `missing activity: ${a} in ${actions.join(" | ")}`);
});

await test("closed surveys and the shared demo cannot be changed", async () => {
  await pool.query(`UPDATE survey_waves SET status = 'closed' WHERE id = $1`, [waveId]);
  assert.equal((await patch({ mode: "none" }, owner)).status, 409);
  const demo = (await pool.query(`SELECT id FROM survey_waves WHERE church_id IN (SELECT id FROM churches WHERE is_demo = true) LIMIT 1`).catch(() => ({ rows: [] as any[] }))).rows[0];
  if (demo) assert.equal((await call("PATCH", `/api/admin/waves/${demo.id}/response-limit`, { mode: "none" }, owner)).status, 403);
});

// ---- cleanup ----------------------------------------------------------------
await pool.query(`DELETE FROM responses WHERE wave_id = $1`, [waveId]);
await pool.query(`DELETE FROM respondents WHERE wave_id = $1`, [waveId]);
await pool.query(`DELETE FROM survey_waves WHERE id = $1`, [waveId]);
await pool.query(`DELETE FROM churches WHERE id = $1`, [church.id]);
await pool.query(`DELETE FROM admin_users WHERE id = $1`, [memberId]);
console.log(`\nResponse limit override QA: ${passed} checks passed.`);
server.close();
await pool.end().catch(() => {});
process.exit(0);
