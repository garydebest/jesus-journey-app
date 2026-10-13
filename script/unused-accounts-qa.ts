// Welcome email + unused-account cleanup QA. Local jj_preview database ONLY;
// mail is captured in memory. Run after script/seed-preview.ts:
//   MAILER_TEST_OUTBOX=1 ADMIN_KEY=qa-admin-key DATABASE_URL=postgres://jj:jj@localhost:5432/jj_preview npx tsx script/unused-accounts-qa.ts
import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";

const url = new URL(process.env.DATABASE_URL!);
assert.ok(["127.0.0.1", "localhost"].includes(url.hostname) && url.pathname === "/jj_preview", "QA is restricted to the local jj_preview database");
assert.equal(process.env.MAILER_TEST_OUTBOX, "1", "Set MAILER_TEST_OUTBOX=1");
process.env.DISCOVERY_CALENDLY_URL = "https://calendly.com/garydebest/jesus-journey-discovery";
delete process.env.UNUSED_ACCOUNT_CLEANUP;

const { ensureBootstrapped, pool } = await import("../server/storage");
const { registerRoutes } = await import("../server/routes");
const { testOutbox } = await import("../server/mailer");
const { runUnusedAccountSweep, scheduledDeletionDate, protectionReasons } = await import("../server/unusedAccounts");
const { storage } = await import("../server/storage");
await ensureBootstrapped();

const app = express();
app.use(express.json());
const server = createServer(app);
await registerRoutes(server, app);
await new Promise<void>((r) => server.listen(0, r));
const base = `http://127.0.0.1:${(server.address() as any).port}`;
const post = async (path: string, body: unknown, token?: string) => {
  const res = await fetch(base + path, { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
  return { status: res.status, json: (await res.json().catch(() => ({}))) as any };
};
let passed = 0;
const test = async (name: string, fn: () => Promise<void>) => { await fn(); passed++; console.log("  ✓", name); };
const settle = () => new Promise((r) => setTimeout(r, 400));
const one = async (sql: string, args: unknown[] = []) => (await pool.query(sql, args)).rows[0];
const exists = async (id: string) => !!(await one(`SELECT 1 AS x FROM churches WHERE id = $1`, [id]));
const ageAccount = (id: string, monthsAgo: number) =>
  pool.query(`UPDATE churches SET created_at = now() - make_interval(months => $2), last_sign_in_at = NULL, unused_warning_sent_at = NULL WHERE id = $1`, [id, monthsAgo]);

const A = "unused-a@example.test", B = "unused-b@example.test";
await pool.query(`DELETE FROM church_email_events WHERE church_id IN (SELECT id FROM churches WHERE primary_contact_email IN ($1, $2))`, [A, B]);
await pool.query(`DELETE FROM survey_waves WHERE church_id IN (SELECT id FROM churches WHERE primary_contact_email IN ($1, $2))`, [A, B]);
await pool.query(`DELETE FROM churches WHERE primary_contact_email IN ($1, $2)`, [A, B]);
const seededBefore = (await one(`SELECT count(*)::int AS n FROM churches`)).n;

let idA = "", idB = "";
await test("registering sends the branded welcome email with the Discovery call link, plus an internal heads-up", async () => {
  testOutbox.length = 0;
  const r = await post("/api/churches/signup", { name: "Unused Church A", primaryContactName: "Alex Example", primaryContactEmail: A, password: "password-123", region: "Canada" });
  assert.equal(r.status, 201); idA = r.json.church.id;
  await settle();
  const welcome = testOutbox.find((m) => m.to === A);
  assert.ok(welcome, "welcome email sent");
  assert.equal(welcome!.subject, "Thank you for your interest in the Jesus Journey Survey");
  assert.match(welcome!.text, /We would love to answer any of your questions and show you how the Survey could help your community along the way of becoming more like Jesus\. Follow the link for a free Discovery call in order to find out more\./);
  assert.ok(welcome!.html.includes("https://calendly.com/garydebest/jesus-journey-discovery"), "Discovery link in the button");
  assert.match(welcome!.html, /Book a free Discovery call/);
  assert.ok(testOutbox.some((m) => m.to !== A && /New account registered — Unused Church A/.test(m.subject)), "internal notice");
  const r2 = await post("/api/churches/signup", { name: "Unused Church B", primaryContactName: "Blair Example", primaryContactEmail: B, password: "password-123" });
  idB = r2.json.church.id;
  await settle();
});

await test("signing in records the last sign-in", async () => {
  const r = await post("/api/churches/login", { email: A, password: "password-123" });
  assert.equal(r.status, 200);
  assert.ok((await one(`SELECT last_sign_in_at FROM churches WHERE id = $1`, [idA])).last_sign_in_at);
});

await test("an account younger than 5½ months is left alone", async () => {
  await ageAccount(idA, 5);
  testOutbox.length = 0;
  await runUnusedAccountSweep();
  assert.equal(testOutbox.length, 0);
  assert.equal(await exists(idA), true);
});

await test("after 6 months unused, a notice is sent once and nothing is deleted yet", async () => {
  await ageAccount(idA, 7);
  testOutbox.length = 0;
  const r1 = await runUnusedAccountSweep();
  assert.equal(r1.noticesSent >= 1, true);
  const notice = testOutbox.find((m) => m.to === A);
  assert.ok(notice); assert.equal(notice!.subject, "Your Jesus Journey account will be deleted soon");
  assert.match(notice!.text, /Sign in to keep my account/);
  assert.equal(await exists(idA), true, "never deleted on the same run as the notice");
  testOutbox.length = 0;
  await runUnusedAccountSweep();
  assert.equal(testOutbox.filter((m) => m.to === A).length, 0, "no duplicate notice");
  assert.equal(await exists(idA), true, "not deleted before 14 days");
  const row = await one(`SELECT * FROM churches WHERE id = $1`, [idA]);
  const due = scheduledDeletionDate({ createdAt: row.created_at, lastSignInAt: row.last_sign_in_at, unusedWarningSentAt: row.unused_warning_sent_at });
  assert.ok(new Date(due).getTime() - Date.now() > 13 * 86_400_000, "deletion is at least 14 days after the notice");
});

await test("14 days after the notice, the unused account and its unpaid survey records are deleted", async () => {
  await pool.query(`INSERT INTO survey_waves (id, church_id, label, join_code, status, payment_status) VALUES ('unused-qa-wave', $1, 'Unpaid draft', 'UNUSEDQA1', 'pending_payment', 'unpaid')`, [idA]);
  await pool.query(`UPDATE churches SET unused_warning_sent_at = now() - interval '15 days' WHERE id = $1`, [idA]);
  testOutbox.length = 0;
  const r = await runUnusedAccountSweep();
  assert.equal(r.deleted, 1);
  assert.equal(await exists(idA), false);
  assert.equal((await one(`SELECT count(*)::int AS n FROM survey_waves WHERE church_id = $1`, [idA])).n, 0);
  assert.equal((await one(`SELECT count(*)::int AS n FROM church_email_events WHERE church_id = $1`, [idA])).n, 0);
  assert.ok(testOutbox.some((m) => /Unused accounts deleted \(1\)/.test(m.subject) && m.text.includes("Unused Church A")), "internal summary");
  const log = await one(`SELECT * FROM admin_activity WHERE action = 'Deleted unused account' ORDER BY created_at DESC LIMIT 1`);
  assert.ok(log && log.detail.includes("Unused Church A") && log.admin_name === "System");
  assert.equal((await post("/api/churches/login", { email: A, password: "password-123" })).status, 401);
});

await test("signing in after the notice keeps the account", async () => {
  await ageAccount(idB, 7);
  await runUnusedAccountSweep();
  assert.ok((await one(`SELECT unused_warning_sent_at FROM churches WHERE id = $1`, [idB])).unused_warning_sent_at, "notice sent");
  await pool.query(`UPDATE churches SET unused_warning_sent_at = now() - interval '15 days' WHERE id = $1`, [idB]);
  assert.equal((await post("/api/churches/login", { email: B, password: "password-123" })).status, 200);
  const r = await runUnusedAccountSweep();
  assert.equal(r.deleted, 0);
  assert.equal(await exists(idB), true);
});

await test("accounts that purchased a survey, historical accounts and the demo are never touched", async () => {
  const protectedIds: string[] = [];
  for (const c of await storage.getAllChurches()) if ((await protectionReasons(c)).length > 0) protectedIds.push(c.id);
  assert.ok(["preview-paid", "preview-returning"].every((id) => protectedIds.includes(id)), "paid and returning accounts are protected");
  assert.ok(!protectedIds.includes("preview-unpaid"), "registered-only account is not protected");
  const saved = (await pool.query(`SELECT id, created_at FROM churches WHERE id = ANY($1)`, [protectedIds])).rows;
  await pool.query(`UPDATE churches SET created_at = now() - interval '3 years', last_sign_in_at = NULL, unused_warning_sent_at = now() - interval '30 days' WHERE id = ANY($1)`, [protectedIds]);
  testOutbox.length = 0;
  const r = await runUnusedAccountSweep();
  assert.equal(r.deleted, 0);
  assert.ok(r.skippedProtected >= 2);
  for (const id of protectedIds) assert.equal(await exists(id), true, `${id} kept`);
  assert.equal(testOutbox.filter((m) => /deleted soon/.test(m.subject)).length, 0, "no notices to protected accounts");
  for (const s of saved) await pool.query(`UPDATE churches SET created_at = $2, unused_warning_sent_at = NULL WHERE id = $1`, [s.id, s.created_at]);
});

await test("no notice means no deletion (emails turned off), and cleanup can be paused", async () => {
  await ageAccount(idB, 8);
  process.env.JOURNEY_EMAILS_ENABLED = "false";
  await runUnusedAccountSweep();
  await pool.query(`UPDATE churches SET created_at = now() - interval '9 months' WHERE id = $1`, [idB]);
  await runUnusedAccountSweep();
  assert.equal(await exists(idB), true, "never deleted without a sent notice");
  assert.equal((await one(`SELECT unused_warning_sent_at FROM churches WHERE id = $1`, [idB])).unused_warning_sent_at, null);
  delete process.env.JOURNEY_EMAILS_ENABLED;
  process.env.UNUSED_ACCOUNT_CLEANUP = "off";
  const r = await runUnusedAccountSweep();
  assert.equal(r.enabled, false); assert.equal(r.noticesSent, 0);
  delete process.env.UNUSED_ACCOUNT_CLEANUP;
});

await test("admin overview shows the scheduled deletion date only for never-purchased accounts", async () => {
  const { createAdminSession } = await import("../server/auth");
  const token = createAdminSession();
  const res = await fetch(base + "/api/admin/churches", { headers: { Authorization: `Bearer ${token}` } });
  const { churches } = (await res.json()) as any;
  const b = churches.find((g: any) => g.church.id === idB);
  assert.match(b.scheduledDeletion, /^\d{4}-\d{2}-\d{2}$/);
  const paid = churches.find((g: any) => g.church.id === "preview-paid");
  assert.equal(paid.scheduledDeletion, null);
  assert.equal(b.church.passwordHash, undefined);
});

await pool.query(`DELETE FROM church_email_events WHERE church_id = $1`, [idB]);
await pool.query(`DELETE FROM churches WHERE id = $1`, [idB]);
assert.equal((await one(`SELECT count(*)::int AS n FROM churches`)).n, seededBefore, "seeded accounts unchanged");
console.log(`\n${passed} unused-account QA checks passed`);
server.close(); await pool.end(); process.exit(0);
