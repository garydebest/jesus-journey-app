// Individual administrator accounts + two-factor QA. Local jj_preview database
// ONLY; mail is captured in memory. Run:
//   MAILER_TEST_OUTBOX=1 ADMIN_KEY=qa-admin-key DATABASE_URL=postgres://jj:jj@localhost:5432/jj_preview npx tsx script/admin-accounts-qa.ts
import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";

const url = new URL(process.env.DATABASE_URL!);
assert.ok(["127.0.0.1", "localhost"].includes(url.hostname) && url.pathname === "/jj_preview", "QA is restricted to the local jj_preview database");
assert.equal(process.env.MAILER_TEST_OUTBOX, "1", "Set MAILER_TEST_OUTBOX=1");

const { ensureBootstrapped, pool } = await import("../server/storage");
const { registerRoutes } = await import("../server/routes");
const { testOutbox } = await import("../server/mailer");
const { ensureAdminTables, provisionAdmin } = await import("../server/adminAccounts");
const { totpAt, currentStep } = await import("../server/totp");
await ensureBootstrapped();
await ensureAdminTables();
const cleanup = async () => {
  await pool.query(`DELETE FROM admin_activity`);
  await pool.query(`DELETE FROM admin_tokens`);
  await pool.query(`DELETE FROM admin_users WHERE email LIKE '%@example.test'`);
};
await cleanup();

const app = express();
app.use(express.json());
const server = createServer(app);
await registerRoutes(server, app);
await new Promise<void>((r) => server.listen(0, r));
const base = `http://127.0.0.1:${(server.address() as any).port}`;
const call = async (method: string, path: string, body?: unknown, token?: string) => {
  const res = await fetch(base + path, {
    method,
    headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, json: (await res.json().catch(() => ({}))) as any };
};
const post = (p: string, b: unknown, t?: string) => call("POST", p, b, t);
const get = (p: string, t?: string) => call("GET", p, undefined, t);
let passed = 0;
const test = async (name: string, fn: () => Promise<void>) => { await fn(); passed++; console.log("  ✓", name); };
const linkFrom = (to: string, kind: "reset" | "confirm-email") => {
  const m = [...testOutbox].reverse().find((x) => x.to === to && x.text.includes(`/#/admin/${kind}/`));
  assert.ok(m, `email with ${kind} link to ${to}`);
  return m!.text.match(new RegExp(`/#/admin/${kind}/([A-Za-z0-9_-]+)`))![1];
};
// Codes can only be used once per 30-second step; let the test move the
// "last used" marker back so it doesn't need to wait between sign-ins.
const freshCode = async (email: string, secret: string) => {
  await pool.query(`UPDATE admin_users SET totp_last_step = $1 WHERE email = $2`, [currentStep() - 2, email]);
  return totpAt(secret, currentStep());
};
const signIn = async (email: string, password: string, secret: string) => {
  const s1 = await post("/api/admin/login", { email, password });
  assert.equal(s1.status, 200, JSON.stringify(s1.json));
  assert.equal(s1.json.step, "code");
  const s2 = await post("/api/admin/login/code", { challenge: s1.json.challenge, code: await freshCode(email, secret) });
  assert.equal(s2.status, 200, JSON.stringify(s2.json));
  return s2.json.token as string;
};

const OWNER = "owner-qa@example.test", MEMBER = "member-qa@example.test";
const ownerPass = "owner-password-123", memberPass = "member-password-456";
let legacyToken = "", ownerSecret = "", ownerToken = "", recovery: string[] = [], memberSecret = "", memberToken = "";

await test("shared login works before any owner has two-factor on", async () => {
  const r = await post("/api/admin/login", { username: "admin", password: "qa-admin-key" });
  assert.equal(r.status, 200); legacyToken = r.json.token;
  assert.equal((await get("/api/admin/overview", legacyToken)).status, 200);
  assert.equal((await get("/api/admin/me", legacyToken)).json.legacy, true);
});

await test("all three admin tables have row-level security enabled", async () => {
  const { rows } = await pool.query(`SELECT relname, relrowsecurity FROM pg_class WHERE relname IN ('admin_users','admin_tokens','admin_activity')`);
  assert.equal(rows.length, 3);
  for (const r of rows) assert.equal(r.relrowsecurity, true, `${r.relname} RLS`);
});

await test("provisioned owner: forgot-password sends a setup link; unknown email gets the same reply and no email", async () => {
  await provisionAdmin("Olive Owner", OWNER, "owner");
  testOutbox.length = 0;
  const unknown = await post("/api/admin/forgot-password", { email: "nobody@example.test" });
  const known = await post("/api/admin/forgot-password", { email: OWNER.toUpperCase() });
  assert.equal(unknown.status, 200); assert.equal(known.status, 200);
  assert.equal(unknown.json.message, known.json.message);
  assert.equal(testOutbox.length, 1);
  assert.match(testOutbox[0].subject, /Set up your Jesus Journey administrator account/);
  const tok = linkFrom(OWNER, "reset");
  const { rows } = await pool.query(`SELECT 1 FROM admin_tokens WHERE token_hash = $1`, [tok]);
  assert.equal(rows.length, 0, "raw token is not stored");
  const check = await post("/api/admin/reset-password/check", { token: tok });
  assert.equal(check.json.valid, true); assert.equal(check.json.purpose, "setup");
});

await test("setup link: short password rejected, then works once", async () => {
  const tok = linkFrom(OWNER, "reset");
  assert.equal((await post("/api/admin/reset-password", { token: tok, password: "too-short" })).status, 400);
  assert.equal((await post("/api/admin/reset-password", { token: tok, password: ownerPass })).status, 200);
  assert.equal((await post("/api/admin/reset-password", { token: tok, password: "another-password-1" })).status, 400, "single use");
  assert.equal((await post("/api/admin/reset-password/check", { token: tok })).json.valid, false);
});

await test("wrong password and unknown email give the same 401", async () => {
  const a = await post("/api/admin/login", { email: OWNER, password: "wrong-password-x" });
  const b = await post("/api/admin/login", { email: "ghost@example.test", password: "wrong-password-x" });
  assert.equal(a.status, 401); assert.equal(b.status, 401); assert.equal(a.json.message, b.json.message);
});

await test("first sign-in requires two-factor setup; wrong code rejected; right code turns it on with 8 recovery codes", async () => {
  const s1 = await post("/api/admin/login", { email: OWNER, password: ownerPass });
  assert.equal(s1.status, 200); assert.equal(s1.json.step, "enroll");
  assert.match(s1.json.otpauthUrl, /^otpauth:\/\/totp\/.*issuer=Jesus%20Journey%20Admin/);
  assert.match(s1.json.qrSvg, /<svg/);
  ownerSecret = s1.json.secret;
  assert.equal((await post("/api/admin/login/enroll", { challenge: s1.json.challenge, code: "000000" })).status, 400);
  const s2 = await post("/api/admin/login/enroll", { challenge: s1.json.challenge, code: totpAt(ownerSecret, currentStep()) });
  assert.equal(s2.status, 200, JSON.stringify(s2.json));
  recovery = s2.json.recoveryCodes; ownerToken = s2.json.token;
  assert.equal(recovery.length, 8);
  const { rows } = await pool.query(`SELECT totp_secret_enc, recovery_codes_json FROM admin_users WHERE email = $1`, [OWNER]);
  assert.ok(!rows[0].totp_secret_enc.includes(ownerSecret), "secret is encrypted at rest");
  assert.ok(!rows[0].recovery_codes_json.includes(recovery[0]), "recovery codes are hashed");
});

await test("once the owner has two-factor on, the shared login is refused and its sessions end", async () => {
  assert.equal((await get("/api/admin/overview", legacyToken)).status, 401);
  assert.equal((await post("/api/admin/login", { username: "admin", password: "qa-admin-key" })).status, 401);
});

await test("code sign-in works; the same code can't be used twice", async () => {
  const s1 = await post("/api/admin/login", { email: OWNER, password: ownerPass });
  assert.equal(s1.json.step, "code");
  const code = await freshCode(OWNER, ownerSecret);
  const ok = await post("/api/admin/login/code", { challenge: s1.json.challenge, code });
  assert.equal(ok.status, 200);
  const again = await post("/api/admin/login", { email: OWNER, password: ownerPass });
  const replay = await post("/api/admin/login/code", { challenge: again.json.challenge, code });
  assert.equal(replay.status, 400, "replayed code rejected");
  assert.equal((await get("/api/admin/overview", ok.json.token)).status, 200);
});

await test("a recovery code works once and sends a notice", async () => {
  testOutbox.length = 0;
  const s1 = await post("/api/admin/login", { email: OWNER, password: ownerPass });
  const r = await post("/api/admin/login/code", { challenge: s1.json.challenge, code: recovery[0].toUpperCase() });
  assert.equal(r.status, 200);
  assert.ok(testOutbox.some((m) => m.to === OWNER && /recovery code was used/.test(m.subject)));
  const s2 = await post("/api/admin/login", { email: OWNER, password: ownerPass });
  assert.equal((await post("/api/admin/login/code", { challenge: s2.json.challenge, code: recovery[0] })).status, 400);
  const me = await get("/api/admin/me", r.json.token);
  assert.equal(me.json.recoveryCodesRemaining, 7);
});

await test("five wrong codes end the sign-in attempt", async () => {
  const s1 = await post("/api/admin/login", { email: OWNER, password: ownerPass });
  for (let i = 0; i < 5; i++) await post("/api/admin/login/code", { challenge: s1.json.challenge, code: "111111" });
  const r = await post("/api/admin/login/code", { challenge: s1.json.challenge, code: await freshCode(OWNER, ownerSecret) });
  assert.equal(r.status, 401);
});

await test("owner adds a team member, who gets a setup email and enrolls", async () => {
  testOutbox.length = 0;
  ownerToken = await signIn(OWNER, ownerPass, ownerSecret);
  const add = await post("/api/admin/team", { name: "Max Member", email: MEMBER, role: "admin" }, ownerToken);
  assert.equal(add.status, 200, JSON.stringify(add.json)); assert.equal(add.json.emailSent, true);
  assert.equal((await post("/api/admin/team", { name: "Dup", email: MEMBER }, ownerToken)).status, 400);
  assert.equal((await post("/api/admin/reset-password", { token: linkFrom(MEMBER, "reset"), password: memberPass })).status, 200);
  const s1 = await post("/api/admin/login", { email: MEMBER, password: memberPass });
  assert.equal(s1.json.step, "enroll"); memberSecret = s1.json.secret;
  const s2 = await post("/api/admin/login/enroll", { challenge: s1.json.challenge, code: totpAt(memberSecret, currentStep()) });
  assert.equal(s2.status, 200); memberToken = s2.json.token;
  assert.equal((await get("/api/admin/overview", memberToken)).status, 200);
});

await test("team and activity pages are owner-only", async () => {
  assert.equal((await get("/api/admin/team", memberToken)).status, 403);
  assert.equal((await get("/api/admin/activity", memberToken)).status, 403);
  assert.equal((await post("/api/admin/team", { name: "X", email: "x@example.test" }, memberToken)).status, 403);
  const team = await get("/api/admin/team", ownerToken);
  assert.equal(team.status, 200); assert.equal(team.json.team.length >= 2, true);
  assert.equal((await get("/api/admin/team")).status, 401);
});

await test("change password: needs current password, keeps this device, signs out others", async () => {
  const other = await signIn(MEMBER, memberPass, memberSecret);
  assert.equal((await post("/api/admin/me/password", { currentPassword: "nope-nope-nope", newPassword: "member-new-pass-789" }, memberToken)).status, 400);
  assert.equal((await post("/api/admin/me/password", { currentPassword: memberPass, newPassword: "short" }, memberToken)).status, 400);
  const r = await post("/api/admin/me/password", { currentPassword: memberPass, newPassword: "member-new-pass-789" }, memberToken);
  assert.equal(r.status, 200); memberToken = r.json.token;
  assert.equal((await get("/api/admin/overview", other)).status, 401, "other device signed out");
  assert.equal((await get("/api/admin/overview", memberToken)).status, 200, "this device stays signed in");
  assert.equal((await post("/api/admin/login", { email: MEMBER, password: memberPass })).status, 401);
});

await test("forgot password (existing account) sends a 1-hour reset link and the reset signs out sessions", async () => {
  testOutbox.length = 0;
  await post("/api/admin/forgot-password", { email: MEMBER });
  assert.ok(testOutbox.some((m) => m.to === MEMBER && /Reset your Jesus Journey administrator password/.test(m.subject)));
  const tok = linkFrom(MEMBER, "reset");
  assert.equal((await post("/api/admin/reset-password/check", { token: tok })).json.purpose, "reset");
  assert.equal((await post("/api/admin/reset-password", { token: tok, password: memberPass })).status, 200);
  assert.equal((await get("/api/admin/overview", memberToken)).status, 401);
  memberToken = await signIn(MEMBER, memberPass, memberSecret);
});

const NEW_MEMBER = "member-new-qa@example.test";
await test("change email: confirm link to the new address, old address notified, sign in with new email", async () => {
  testOutbox.length = 0;
  assert.equal((await post("/api/admin/me/email", { newEmail: OWNER, currentPassword: memberPass }, memberToken)).status, 400, "email in use");
  assert.equal((await post("/api/admin/me/email", { newEmail: NEW_MEMBER, currentPassword: "wrong-wrong-wrong" }, memberToken)).status, 400);
  assert.equal((await post("/api/admin/me/email", { newEmail: NEW_MEMBER, currentPassword: memberPass }, memberToken)).status, 200);
  assert.ok(testOutbox.some((m) => m.to === MEMBER && /being changed/.test(m.subject)));
  assert.equal((await post("/api/admin/login", { email: MEMBER, password: memberPass })).json.step, "code", "old email still works until confirmed");
  const tok = linkFrom(NEW_MEMBER, "confirm-email");
  assert.equal((await post("/api/admin/confirm-email", { token: tok })).status, 200);
  assert.equal((await post("/api/admin/confirm-email", { token: tok })).status, 400, "single use");
  assert.equal((await get("/api/admin/overview", memberToken)).status, 401, "signed out after email change");
  assert.equal((await post("/api/admin/login", { email: MEMBER, password: memberPass })).status, 401);
  memberToken = await signIn(NEW_MEMBER, memberPass, memberSecret);
});

await test("new recovery codes need the current password and replace the old set", async () => {
  assert.equal((await post("/api/admin/me/recovery-codes", { currentPassword: "wrong-wrong-wrong" }, memberToken)).status, 400);
  const r = await post("/api/admin/me/recovery-codes", { currentPassword: memberPass }, memberToken);
  assert.equal(r.status, 200); assert.equal(r.json.recoveryCodes.length, 8);
});

await test("owner resets a member's two-factor: they are signed out and must enroll again", async () => {
  const id = (await get("/api/admin/team", ownerToken)).json.team.find((m: any) => m.email === NEW_MEMBER).id;
  assert.equal((await post(`/api/admin/team/${id}/reset-two-factor`, {}, memberToken)).status, 403);
  assert.equal((await post(`/api/admin/team/${id}/reset-two-factor`, {}, ownerToken)).status, 200);
  assert.equal((await get("/api/admin/overview", memberToken)).status, 401);
  const s1 = await post("/api/admin/login", { email: NEW_MEMBER, password: memberPass });
  assert.equal(s1.json.step, "enroll");
  memberSecret = s1.json.secret;
  const s2 = await post("/api/admin/login/enroll", { challenge: s1.json.challenge, code: totpAt(memberSecret, currentStep()) });
  assert.equal(s2.status, 200); memberToken = s2.json.token;
});

await test("owner removes access (signed out, can't sign in or get links), then restores it", async () => {
  const id = (await get("/api/admin/team", ownerToken)).json.team.find((m: any) => m.email === NEW_MEMBER).id;
  const ownerId = (await get("/api/admin/me", ownerToken)).json.id;
  assert.equal((await post(`/api/admin/team/${ownerId}/remove`, {}, ownerToken)).status, 400, "can't act on self");
  assert.equal((await post(`/api/admin/team/${id}/remove`, {}, ownerToken)).status, 200);
  assert.equal((await get("/api/admin/overview", memberToken)).status, 401);
  assert.equal((await post("/api/admin/login", { email: NEW_MEMBER, password: memberPass })).status, 401);
  testOutbox.length = 0;
  await post("/api/admin/forgot-password", { email: NEW_MEMBER });
  assert.equal(testOutbox.length, 0, "removed accounts get no links");
  assert.equal((await post(`/api/admin/team/${id}/restore`, {}, ownerToken)).status, 200);
  memberToken = await signIn(NEW_MEMBER, memberPass, memberSecret);
});

await test("activity log records sign-ins, account changes and survey actions with the person's name", async () => {
  const { rows: waves } = await pool.query(`SELECT id FROM survey_waves`);
  let opened = false;
  for (const w of waves) if ((await get(`/api/admin/waves/${w.id}/report`, memberToken)).status === 200) { opened = true; break; }
  assert.ok(opened, "a seeded report opened");
  await new Promise((r) => setTimeout(r, 300));
  const a = await get("/api/admin/activity", ownerToken);
  assert.equal(a.status, 200);
  const actions = a.json.activity.map((x: any) => `${x.who}: ${x.action}`);
  for (const want of ["Turned on two-factor sign-in", "Signed in with a recovery code", "Changed password", "Changed sign-in email", "Added administrator", "Reset two-factor sign-in", "Removed administrator access", "Shared admin login"]) {
    assert.ok(actions.some((s: string) => s.includes(want)), `activity includes "${want}"`);
  }
  assert.ok(actions.some((s: string) => s.startsWith("Max Member")), "entries carry the person's name");
  const opening = a.json.activity.find((x: any) => /Opened report/.test(x.action));
  assert.ok(opening, "survey report open recorded");
  assert.ok(opening.detail && !/^wave /.test(opening.detail), "detail names the church and survey");
});

await test("sign out ends the session", async () => {
  assert.equal((await post("/api/admin/logout", {}, memberToken)).status, 200);
  assert.equal((await get("/api/admin/overview", memberToken)).status, 401);
});

await cleanup();
console.log(`\n${passed} administrator account QA checks passed`);
server.close(); await pool.end(); process.exit(0);
