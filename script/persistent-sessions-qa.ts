// Sign-ins survive a server restart (deploy). Local jj_preview database ONLY.
// Starts the API twice in separate processes and reuses tokens across them:
//   MAILER_TEST_OUTBOX=1 ADMIN_KEY=qa-admin-key ADMIN_USERNAME=admin DATABASE_URL=postgres://jj:jj@localhost:5432/jj_preview npx tsx script/persistent-sessions-qa.ts
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:http";

const url = new URL(process.env.DATABASE_URL!);
assert.ok(["127.0.0.1", "localhost"].includes(url.hostname) && url.pathname === "/jj_preview", "QA is restricted to the local jj_preview database");

// ---- Child mode: run the API on the given port --------------------------------
if (process.argv[2] === "serve") {
  const express = (await import("express")).default;
  const { ensureBootstrapped } = await import("../server/storage");
  const { registerRoutes } = await import("../server/routes");
  await ensureBootstrapped();
  const app = express();
  app.use(express.json());
  const server = createServer(app);
  await registerRoutes(server, app);
  server.listen(Number(process.argv[3]), "127.0.0.1", () => console.log("READY"));
} else {
  const { pool } = await import("../server/storage");
  const port = 5600 + Math.floor(Math.random() * 300);
  const base = `http://127.0.0.1:${port}`;
  let child: ChildProcess | null = null;

  const start = () => new Promise<void>((resolve, reject) => {
    child = spawn(process.execPath, [...process.execArgv, process.argv[1], "serve", String(port)], { env: process.env, stdio: ["ignore", "pipe", "inherit"] });
    const timer = setTimeout(() => reject(new Error("server did not start")), 30000);
    child.stdout!.on("data", (d) => { if (String(d).includes("READY")) { clearTimeout(timer); resolve(); } });
    child.on("exit", (code) => { if (code) reject(new Error(`server exited ${code}`)); });
  });
  const stop = () => new Promise<void>((resolve) => {
    if (!child) return resolve();
    child.removeAllListeners("exit");
    child.on("exit", () => resolve());
    child.kill("SIGKILL");
    child = null;
  });
  const restart = async () => { await stop(); await start(); };
  const call = async (method: string, path: string, body?: unknown, token?: string) => {
    const res = await fetch(base + path, { method, headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const json: any = await res.json().catch(() => ({}));
    return { status: res.status, json };
  };
  const settle = () => new Promise((r) => setTimeout(r, 600));
  const hash = (t: string) => createHash("sha256").update(t).digest("hex");
  let passed = 0;
  const test = async (name: string, fn: () => Promise<void>) => { await fn(); passed++; console.log("  ✓", name); };

  try {
    await start();
    const email = `sessions-qa-${randomUUID().slice(0, 8)}@example.test`;
    const password = "SessionsQa2026!";
    const signup = await call("POST", "/api/churches/signup", { name: "Sessions QA Church", primaryContactName: "Pat", primaryContactEmail: email, password });
    assert.equal(signup.status, 201, JSON.stringify(signup.json));
    const churchToken: string = signup.json.token;
    const churchId: string = signup.json.church.id;
    const admin = await call("POST", "/api/admin/login", { username: "admin", password: process.env.ADMIN_KEY });
    assert.equal(admin.status, 200, "shared admin login must be on for this QA");
    const adminToken: string = admin.json.token;
    await settle();

    await test("only a hash of each token is stored", async () => {
      const { rows } = await pool.query(`SELECT token_hash, kind FROM auth_sessions WHERE token_hash IN ($1, $2)`, [hash(churchToken), hash(adminToken)]);
      assert.equal(rows.length, 2);
      const { rows: raw } = await pool.query(`SELECT 1 FROM auth_sessions WHERE token_hash IN ($1, $2)`, [churchToken, adminToken]);
      assert.equal(raw.length, 0);
    });

    await restart();
    await test("church and admin stay signed in after a restart", async () => {
      assert.equal((await call("GET", "/api/churches/me", undefined, churchToken)).status, 200);
      assert.equal((await call("GET", "/api/admin/overview", undefined, adminToken)).status, 200);
    });

    await test("unknown and admin-vs-church tokens are refused", async () => {
      assert.equal((await call("GET", "/api/churches/me", undefined, "not-a-token")).status, 401);
      assert.equal((await call("GET", "/api/churches/me", undefined, adminToken)).status, 401);
      assert.equal((await call("GET", "/api/admin/overview", undefined, churchToken)).status, 401);
    });

    await test("password change signs out other devices, also after a restart", async () => {
      const other = (await call("POST", "/api/churches/login", { email, password })).json.token as string;
      await settle();
      const changed = await call("POST", "/api/churches/me/password", { currentPassword: password, newPassword: "SessionsQa2026!new" }, churchToken);
      assert.equal(changed.status, 200, JSON.stringify(changed.json));
      await restart();
      assert.equal((await call("GET", "/api/churches/me", undefined, other)).status, 401);
      assert.equal((await call("GET", "/api/churches/me", undefined, churchToken)).status, 200);
    });

    await test("signing out stays signed out after a restart", async () => {
      assert.equal((await call("POST", "/api/churches/logout", {}, churchToken)).status, 200);
      assert.equal((await call("POST", "/api/admin/logout", {}, adminToken)).status, 200);
      await restart();
      assert.equal((await call("GET", "/api/churches/me", undefined, churchToken)).status, 401);
      assert.equal((await call("GET", "/api/admin/overview", undefined, adminToken)).status, 401);
    });

    await test("expired sessions are refused and removed", async () => {
      const t = (await call("POST", "/api/churches/login", { email, password: "SessionsQa2026!new" })).json.token as string;
      const a = (await call("POST", "/api/admin/login", { username: "admin", password: process.env.ADMIN_KEY })).json.token as string;
      await settle();
      await pool.query(`UPDATE auth_sessions SET created_at = now() - interval '15 days' WHERE token_hash = $1`, [hash(t)]);
      await pool.query(`UPDATE auth_sessions SET created_at = now() - interval '13 hours' WHERE token_hash = $1`, [hash(a)]);
      await restart();
      assert.equal((await call("GET", "/api/churches/me", undefined, t)).status, 401);
      assert.equal((await call("GET", "/api/admin/overview", undefined, a)).status, 401);
      const { rows } = await pool.query(`SELECT 1 FROM auth_sessions WHERE token_hash IN ($1, $2)`, [hash(t), hash(a)]);
      assert.equal(rows.length, 0);
    });

    await pool.query(`DELETE FROM auth_sessions WHERE church_id = $1`, [churchId]);
    await pool.query(`DELETE FROM church_email_events WHERE church_id = $1`, [churchId]).catch(() => {});
    await pool.query(`DELETE FROM churches WHERE id = $1`, [churchId]).catch(() => {});
    console.log(`persistent-sessions QA: ${passed} checks passed`);
  } finally {
    await stop();
    await pool.end().catch(() => {});
  }
}
