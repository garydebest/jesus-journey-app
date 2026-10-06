// Password reset / change and admin username QA. Local jj_preview database ONLY;
// mail is captured in memory. Run:
//   MAILER_TEST_OUTBOX=1 ADMIN_KEY=qa-admin-key DATABASE_URL=postgres://jj:jj@localhost:5432/jj_preview npx tsx script/password-reset-qa.ts
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import express from "express";
import { createServer } from "node:http";

const url = new URL(process.env.DATABASE_URL!);
assert.ok(["127.0.0.1", "localhost"].includes(url.hostname) && url.pathname === "/jj_preview", "QA is restricted to the local jj_preview database");
assert.equal(process.env.MAILER_TEST_OUTBOX, "1", "Set MAILER_TEST_OUTBOX=1");

const { ensureBootstrapped, pool } = await import("../server/storage");
const { registerRoutes } = await import("../server/routes");
const { testOutbox } = await import("../server/mailer");
await ensureBootstrapped();
const app = express();
app.use(express.json());
const server = createServer(app);
await registerRoutes(server, app);
await new Promise<void>((r) => server.listen(0, r));
const base = `http://127.0.0.1:${(server.address() as any).port}`;
const post = async (path: string, body: unknown, token?: string) => {
  const res = await fetch(base + path, { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
  return { status: res.status, json: await res.json().catch(() => ({})) };
};
let passed = 0;
const test = async (name: string, fn: () => Promise<void>) => { await fn(); passed++; console.log("  ✓", name); };

const email = `reset-${randomUUID().slice(0, 8)}@example.test`;
const signup = await post("/api/churches/signup", { name: "Reset QA Church", primaryContactName: "Pat Tester", primaryContactEmail: email, password: "original-pass" });
assert.equal(signup.status, 201, JSON.stringify(signup.json));
const firstToken = signup.json.token as string;

await test("admin login requires username admin + password", async () => {
  assert.equal((await post("/api/admin/login", { password: "qa-admin-key" })).status, 401);
  assert.equal((await post("/api/admin/login", { username: "gary", password: "qa-admin-key" })).status, 401);
  assert.equal((await post("/api/admin/login", { username: "admin", password: "wrong" })).status, 401);
  const ok = await post("/api/admin/login", { username: "Admin ", password: "qa-admin-key" });
  assert.equal(ok.status, 200); assert.ok(ok.json.token);
});

await test("forgot password gives the same response for unknown email and sends nothing", async () => {
  testOutbox.length = 0;
  const r = await post("/api/churches/forgot-password", { email: "nobody-here@example.test" });
  assert.equal(r.status, 200); assert.equal(testOutbox.length, 0);
});

let link = "";
await test("forgot password emails a one-hour reset link to the account email", async () => {
  testOutbox.length = 0;
  const r = await post("/api/churches/forgot-password", { email: email.toUpperCase() });
  assert.equal(r.status, 200);
  assert.equal(testOutbox.length, 1);
  assert.equal(testOutbox[0].to, email);
  const m = testOutbox[0].text.match(/https?:\/\/\S+\/#\/church\/reset\/([A-Za-z0-9_-]+)/);
  assert.ok(m, "link present"); link = m![1];
  const { rows } = await pool.query(`SELECT token_hash FROM church_password_resets WHERE token_hash = $1`, [link]);
  assert.equal(rows.length, 0, "raw token is not stored");
});

await test("short password rejected; reset succeeds once; old sessions signed out", async () => {
  assert.equal((await post("/api/churches/reset-password", { token: link, password: "short" })).status, 400);
  const ok = await post("/api/churches/reset-password", { token: link, password: "brand-new-pass" });
  assert.equal(ok.status, 200, JSON.stringify(ok.json));
  assert.equal((await post("/api/churches/reset-password", { token: link, password: "another-pass" })).status, 400, "single use");
  const me = await fetch(base + "/api/churches/me", { headers: { Authorization: `Bearer ${firstToken}` } });
  assert.equal(me.status, 401, "existing session revoked");
  assert.equal((await post("/api/churches/login", { email, password: "original-pass" })).status, 401);
  assert.equal((await post("/api/churches/login", { email, password: "brand-new-pass" })).status, 200);
});

await test("requesting a new link invalidates the older one; rate limit 3/hour", async () => {
  testOutbox.length = 0;
  await post("/api/churches/forgot-password", { email });
  await post("/api/churches/forgot-password", { email });
  const tokens = testOutbox.map((m) => m.text.match(/reset\/([A-Za-z0-9_-]+)/)![1]);
  assert.equal(tokens.length, 2);
  assert.equal((await post("/api/churches/reset-password", { token: tokens[0], password: "older-link-pass" })).status, 400);
  await post("/api/churches/forgot-password", { email });
  assert.equal(testOutbox.length, 2, "4th request in the hour (3 counted incl. earlier) sends nothing");
});

await test("expired link rejected", async () => {
  await pool.query(`UPDATE church_password_resets SET expires_at = now() - interval '1 minute', used_at = NULL WHERE church_id = (SELECT id FROM churches WHERE primary_contact_email = $1)`, [email]);
  const tok = testOutbox[testOutbox.length - 1].text.match(/reset\/([A-Za-z0-9_-]+)/)![1];
  assert.equal((await post("/api/churches/reset-password", { token: tok, password: "expired-pass" })).status, 400);
});

await test("change password: needs correct current password; keeps this session, signs out others", async () => {
  const a = (await post("/api/churches/login", { email, password: "brand-new-pass" })).json.token;
  const b = (await post("/api/churches/login", { email, password: "brand-new-pass" })).json.token;
  assert.equal((await post("/api/churches/me/password", { currentPassword: "wrong", newPassword: "changed-pass" }, a)).status, 400);
  assert.equal((await post("/api/churches/me/password", { currentPassword: "brand-new-pass", newPassword: "short" }, a)).status, 400);
  assert.equal((await post("/api/churches/me/password", { currentPassword: "brand-new-pass", newPassword: "changed-pass" }, a)).status, 200);
  assert.equal((await fetch(base + "/api/churches/me", { headers: { Authorization: `Bearer ${a}` } })).status, 200);
  assert.equal((await fetch(base + "/api/churches/me", { headers: { Authorization: `Bearer ${b}` } })).status, 401);
  assert.equal((await post("/api/churches/login", { email, password: "changed-pass" })).status, 200);
  assert.equal((await post("/api/churches/me/password", { currentPassword: "x", newPassword: "yyyyyyyy" })).status, 401, "requires auth");
});

console.log(`\n${passed} password QA checks passed`);
server.close(); await pool.end(); process.exit(0);
