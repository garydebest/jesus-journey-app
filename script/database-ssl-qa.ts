// Database TLS verification QA. Sends no username, password, or SQL to any real database.
//   npx tsx script/database-ssl-qa.ts            (offline checks)
//   LIVE_PROBE=1 npx tsx script/database-ssl-qa.ts  (also strict handshake to the Supabase pooler)
import assert from "node:assert/strict";
import net from "node:net";
import tls from "node:tls";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { X509Certificate } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import pg from "pg";
import { databaseSsl } from "../server/database-ssl";
import { SUPABASE_ROOT_CA_2021 } from "../server/supabase-ca";

const POOLER = "aws-0-us-west-1.pooler.supabase.com";
let failures = 0;
async function check(name: string, fn: () => unknown | Promise<unknown>) {
  try { await fn(); console.log(`PASS ${name}`); } catch (e: any) { failures++; console.log(`FAIL ${name}: ${e?.message ?? e}`); }
}

// 1. Configuration choices
await check("Supabase pooler URL requires verified TLS with the Supabase CA", () => {
  const ssl = databaseSsl(`postgresql://u:p@${POOLER}:6543/postgres`)!;
  assert.equal(ssl.rejectUnauthorized, true);
  assert.equal(ssl.ca, SUPABASE_ROOT_CA_2021);
  assert.equal(ssl.servername, POOLER);
});
await check("Direct db.<ref>.supabase.co URL also verified", () => {
  assert.equal(databaseSsl("postgresql://u:p@db.abc.supabase.co:5432/postgres")!.rejectUnauthorized, true);
});
await check("Look-alike host is not treated as Supabase", () => {
  assert.equal(databaseSsl("postgresql://u:p@evilsupabase.com:5432/x")!.rejectUnauthorized, false);
});
await check("Explicit sslmode in URL keeps previous behaviour", () => {
  assert.equal(databaseSsl(`postgresql://u:p@${POOLER}:6543/postgres?sslmode=require`), undefined);
});
await check("Local/dev host keeps previous behaviour", () => {
  assert.deepEqual(databaseSsl("postgres://jj:jj@localhost:5432/jj_preview"), { rejectUnauthorized: false });
});
await check("Bundled CA is the official Supabase Root 2021 CA", () => {
  const c = new X509Certificate(SUPABASE_ROOT_CA_2021);
  assert.match(c.subject, /CN=Supabase Root 2021 CA/);
  assert.equal(c.fingerprint256, "80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA");
});

// 2. pg itself enforces the setting: fake local Postgres TLS endpoint with a throwaway certificate
const dir = mkdtempSync(join(tmpdir(), "dbssl-"));
const sh = (args: string[]) => execFileSync("openssl", args, { cwd: dir, stdio: "ignore" });
sh(["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", "ca.key", "-out", "ca.crt", "-days", "1", "-subj", "/CN=Test CA"]);
sh(["req", "-newkey", "rsa:2048", "-nodes", "-keyout", "srv.key", "-out", "srv.csr", "-subj", "/CN=test.pooler.supabase.com"]);
writeFileSync(join(dir, "ext.cnf"), "subjectAltName=DNS:test.pooler.supabase.com\n");
sh(["x509", "-req", "-in", "srv.csr", "-CA", "ca.crt", "-CAkey", "ca.key", "-CAcreateserial", "-out", "srv.crt", "-days", "1", "-extfile", "ext.cnf"]);
const testCa = readFileSync(join(dir, "ca.crt"), "utf8");
let handshakes = 0;
const server = net.createServer((sock) => {
  sock.once("data", () => {
    sock.write("S");
    const t = new tls.TLSSocket(sock, { isServer: true, key: readFileSync(join(dir, "srv.key")), cert: readFileSync(join(dir, "srv.crt")) });
    t.on("secure", () => { handshakes++; t.destroy(); });
    t.on("error", () => {});
  });
  sock.on("error", () => {});
});
await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
const port = (server.address() as net.AddressInfo).port;
async function pgConnect(ssl: tls.ConnectionOptions) {
  const c = new pg.Client({ host: "127.0.0.1", port, user: "x", database: "x", ssl, connectionTimeoutMillis: 5000 });
  c.on("error", () => {});
  try { await c.connect(); return "connected"; } catch (e: any) { return e.code || e.message; } finally { c.end().catch(() => {}); }
}
const supaSsl = databaseSsl(`postgresql://u:p@test.pooler.supabase.com:6543/postgres`)!;
await check("pg rejects a server certificate not issued by Supabase's CA (no fallback)", async () => {
  const before = handshakes;
  const r = await pgConnect(supaSsl);
  assert.match(String(r), /SELF_SIGNED|UNABLE_TO_VERIFY|unable to verify|self-signed/i);
  assert.equal(handshakes, before);
});
await check("pg rejects a trusted certificate for the wrong hostname", async () => {
  const r = await pgConnect({ ...supaSsl, ca: testCa, servername: "other.pooler.supabase.com" });
  assert.match(String(r), /ERR_TLS_CERT_ALTNAME_INVALID|altnames|Hostname/i);
});
await check("pg completes the handshake when chain and hostname are valid", async () => {
  const before = handshakes;
  await pgConnect({ ...supaSsl, ca: testCa });
  await new Promise((r) => setTimeout(r, 200));
  assert.equal(handshakes, before + 1);
});
server.close();

// 3. Optional live strict handshake to the real pooler (SSLRequest + TLS only; no login, no SQL)
if (process.env.LIVE_PROBE === "1") {
  for (const p of [6543, 5432]) {
    await check(`Live Supabase pooler :${p} verifies with bundled CA`, () => new Promise<void>((resolve, reject) => {
      const s = net.connect({ host: POOLER, port: p });
      const timer = setTimeout(() => { s.destroy(); reject(new Error("timeout")); }, 15000);
      s.once("error", reject);
      s.once("connect", () => { const b = Buffer.alloc(8); b.writeInt32BE(8, 0); b.writeInt32BE(80877103, 4); s.write(b); });
      s.once("data", (d) => {
        if (d[0] !== 83) return reject(new Error("SSL not offered"));
        const t = tls.connect({ socket: s, ...databaseSsl(`postgresql://u:p@${POOLER}:${p}/postgres`)! });
        t.once("error", (e) => { clearTimeout(timer); reject(e); });
        t.once("secureConnect", () => { clearTimeout(timer); const ok = t.authorized; t.destroy(); ok ? resolve() : reject(new Error("not authorized")); });
      });
    }));
  }
}

console.log(failures ? `${failures} check(s) failed` : "All database TLS checks passed");
process.exit(failures ? 1 : 0);
