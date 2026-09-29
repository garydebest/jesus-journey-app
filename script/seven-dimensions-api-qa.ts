import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import WebSocket from "ws";

process.env.DATABASE_URL = "postgresql://unused@127.0.0.1:9/unused?sslmode=disable";
const archive = readFileSync("script/fixtures/legacy-church-report.pdf");
let storageWrites = 0;
const objects = createServer((req, res) => {
  if (req.method !== "GET") { storageWrites++; res.writeHead(403); return res.end(); }
  res.writeHead(200, { "Content-Type": "application/pdf" }); res.end(archive);
});
await new Promise<void>(r => objects.listen(0, "127.0.0.1", r));
process.env.SUPABASE_URL = `http://127.0.0.1:${(objects.address() as any).port}`;
process.env.SUPABASE_SERVICE_ROLE_KEY = "local-synthetic-test-only";
if (!globalThis.WebSocket) (globalThis as any).WebSocket = WebSocket;
const { storage } = await import("../server/storage");
const { registerRoutes } = await import("../server/routes");
const { createAdminSession, createSession } = await import("../server/auth");
const { DASHBOARD_DEMO_TOKEN, DASHBOARD_DEMO_WAVE_ID } = await import("../shared/dashboardDemo");
const { DEMO_CHURCH_ID } = await import("../shared/surveyAccess");
const original = readFileSync("script/fixtures/legacy-dimensions.json", "utf8");
let unexpectedCalls = 0;
for (const key of Object.keys(storage)) if (typeof (storage as any)[key] === "function") {
  (storage as any)[key] = async () => { unexpectedCalls++; throw Error("Unexpected database access"); };
}
Object.assign(storage, {
  getDebriefingReportByWave: async () => ({ reportJson: original, respondentCount: 210 }),
  getWaveById: async (id: string) => ({ id, churchId: id === DASHBOARD_DEMO_WAVE_ID ? DEMO_CHURCH_ID : "church" }),
  getSnapshotByWave: async () => ({ reportPdfPath: "synthetic.pdf" }),
});
const app = express(); app.use(express.json());
const server = createServer(app);
await registerRoutes(server, app);
app.use((err: Error, _req: any, res: any, _next: any) => res.status(500).json({ message: err.message }));
await new Promise<void>(r => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${(server.address() as any).port}`;
const admin = createAdminSession(), church = createSession("church"), other = createSession("other");
async function request(route: string, token: string, expected = 200) {
  const res = await fetch(base + route, { headers: { Authorization: `Bearer ${token}` } });
  assert.equal(res.status, expected, route);
  return res;
}
try {
  for (const token of ["invalid", church, DASHBOARD_DEMO_TOKEN]) {
    await request("/api/admin/waves/test/debriefing", token, token === DASHBOARD_DEMO_TOKEN ? 403 : 401);
  }
  const payload = await (await request("/api/admin/waves/test/debriefing", admin)).text();
  assert(!/reportJson|\bdimensions?\b|relationships & growth/i.test(payload));
  assert.equal(JSON.parse(payload).debriefing.report.pathwaysByGoal.flatMap((g: any) => g.pathways).length, 16);
  for (const [route, token] of [
    ["/api/admin/waves/test/report.pdf", admin],
    ["/api/waves/test/report.pdf", church],
    [`/api/waves/${DASHBOARD_DEMO_WAVE_ID}/report.pdf`, DASHBOARD_DEMO_TOKEN],
    ["/api/admin/waves/test/debriefing.pdf", admin],
  ]) {
    const bytes = Buffer.from(await (await request(route, token)).arrayBuffer());
    assert.equal(bytes.subarray(0, 5).toString(), "%PDF-");
    if (!route.includes("debriefing")) assert(!bytes.equals(archive));
  }
  await request("/api/waves/test/report.pdf", other, 404);
  await request("/api/admin/waves/test/report.pdf", church, 401);
  assert.equal(storageWrites, 0);
  assert.equal(unexpectedCalls, 0);
  assert.equal(readFileSync("script/fixtures/legacy-dimensions.json", "utf8"), original);
  console.log("PASS: 10 HTTP checks; sanitized JSON without raw reportJson; protected admin/church/demo PDFs; cross-account denial; zero storage writes/database calls");
} finally {
  server.closeAllConnections(); objects.closeAllConnections();
  await Promise.all([new Promise<void>(r => server.close(() => r())), new Promise<void>(r => objects.close(() => r()))]);
}
