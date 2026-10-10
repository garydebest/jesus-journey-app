// Sign-in and reset rate-limit QA against the local jj_preview database ONLY.
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
const post = async (path: string, body: unknown, ip: string) => {
  const res = await fetch(base + path, { method: "POST", headers: { "Content-Type": "application/json", "X-Forwarded-For": ip }, body: JSON.stringify(body) });
  return res.status;
};
let passed = 0;
const test = async (name: string, fn: () => Promise<void>) => { await fn(); passed++; console.log("  ✓", name); };

const email = `ratelimit-${randomUUID().slice(0, 8)}@example.test`;
const password = "Correct-horse-42";
const signup = await fetch(base + "/api/churches/signup", { method: "POST", headers: { "Content-Type": "application/json", "X-Forwarded-For": "10.0.0.1" },
  body: JSON.stringify({ name: "Rate Limit QA Church", primaryContactName: "QA", primaryContactEmail: email, password, region: "CA" }) });
const signupOk = signup.status === 200 || signup.status === 201;
if (!signupOk) console.log("  (signup fixture returned", signup.status, "- account-level success check skipped)");

await test("church login: 5 failures per account then 429, even from new addresses", async () => {
  for (let i = 0; i < 5; i++) assert.equal(await post("/api/churches/login", { email, password: "wrong" }, `10.1.0.${i}`), 401);
  assert.equal(await post("/api/churches/login", { email, password: "wrong" }, "10.1.0.99"), 429);
  if (signupOk) assert.equal(await post("/api/churches/login", { email, password }, "10.1.0.100"), 429, "correct password also blocked during lockout");
});
await test("church login: other accounts unaffected", async () => {
  assert.equal(await post("/api/churches/login", { email: "someone-else@example.test", password: "wrong" }, "10.2.0.1"), 401);
});
await test("admin login: 5 failures per address then 429; correct key from other address works", async () => {
  for (let i = 0; i < 5; i++) assert.equal(await post("/api/admin/login", { username: "admin", password: "nope" }, "10.3.0.1"), 401);
  assert.equal(await post("/api/admin/login", { username: "admin", password: process.env.ADMIN_KEY }, "10.3.0.1"), 429);
  assert.equal(await post("/api/admin/login", { username: process.env.ADMIN_USERNAME ?? "admin", password: process.env.ADMIN_KEY }, "10.3.0.2"), 200);
});
await test("forgot-password: at most 3 emails per address per hour, same reply after", async () => {
  const target = `reset-cap-${randomUUID().slice(0, 8)}@example.test`;
  const before = testOutbox.length;
  for (let i = 0; i < 5; i++) assert.equal(await post("/api/churches/forgot-password", { email: target }, `10.4.0.${i}`), 200);
  assert.ok(testOutbox.length - before <= 3);
});
await test("forgot-password: 10 per address then 429", async () => {
  for (let i = 0; i < 10; i++) await post("/api/churches/forgot-password", { email: `x${i}@example.test` }, "10.5.0.1");
  assert.equal(await post("/api/churches/forgot-password", { email: "y@example.test" }, "10.5.0.1"), 429);
});
await test("reset-password: 10 attempts per address then 429", async () => {
  for (let i = 0; i < 10; i++) assert.equal(await post("/api/churches/reset-password", { token: "bad", password: "Another-pass-99" }, "10.6.0.1"), 400);
  assert.equal(await post("/api/churches/reset-password", { token: "bad", password: "Another-pass-99" }, "10.6.0.1"), 429);
});
console.log(`${passed} rate-limit API checks passed`);
server.close(); await pool.end();
