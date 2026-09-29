// Real Express routes and production saveChurchResponse with an in-memory
// transaction adapter. No reachable database or external storage is configured.
import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import { SURVEY_ITEMS } from "../shared/surveyItems";
process.env.DATABASE_URL = "postgresql://unused@127.0.0.1:9/unused?sslmode=disable";
const { db, storage } = await import("../server/storage");
const { registerRoutes } = await import("../server/routes");
const { createSession, createAdminSession } = await import("../server/auth");
const { responses } = await import("../shared/schema");
const wave = { id: "synthetic", churchId: "synthetic", status: "live", paymentStatus: "paid", label: "Synthetic" };
let unexpected = 0, checks = 0;
const saved: any[] = [];
for (const key of Object.keys(storage)) if (typeof (storage as any)[key] === "function") (storage as any)[key] = async () => { unexpected++; throw Error("Unexpected database operation"); };
const snapshot = { respondentCount: 20, summaryJson: JSON.stringify({ respondentCount: 20, demographics: { gender: { Female: 11, Male: 9 } } }) };
Object.assign(storage, {
  getWaveByJoinCode: async () => wave,
  getWaveById: async () => wave,
  getChurchById: async () => ({ name: "Synthetic" }),
  getSnapshotByWave: async () => snapshot,
  getWavesByChurch: async () => [wave],
  countResponsesByWave: async () => 20,
});
(db as any).transaction = async (run: any) => run({
  select: () => ({ from: () => ({ where: () => ({ for: async () => [wave] }) }) }),
  insert: (table: any) => ({ values: (value: any) => {
    if (table === responses) { saved.push(value); return { returning: async () => [value] }; }
    return Promise.resolve();
  } }),
});
const app = express(); app.use(express.json());
const server = createServer(app); await registerRoutes(server, app);
app.use((err: Error, _req: any, res: any, _next: any) => res.status(500).json({ message: err.message }));
await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${(server.address() as any).port}`;
const payload = { joinCode: "SYNTHETIC", journeyPre: 3, journeyPost: 4, spiritualChange: 2, items: Object.fromEntries(SURVEY_ITEMS.map(q => [q.code, 4])) };
try {
  for (const [country, preset] of [["CA", "canada"], ["US", "usa"], ["GB", "uk"], ["DE", "international"], ["XX", "international"], ["", "international"]]) {
    const res = await fetch(base + "/api/survey-display", { headers: country ? { "CF-IPCountry": country } : {} });
    assert.equal(res.status, 200); assert.equal(res.headers.get("cache-control"), "private, no-store");
    assert.equal(res.headers.get("vary"), "CF-IPCountry");
    assert.deepEqual(await res.json(), { ethnicityPreset: preset }); checks++;
  }
  for (const demographics of [undefined, {}, { ethnicity: ["White", "Black"], children: ["0-2 year old(s)"] }, { ethnicity: "East Indian descent" }, { ethnicity: ["Prefer not to say"], children: [] }, { ethnicity: ["White", "Prefer not to say"] }]) {
    const res = await fetch(base + "/api/responses", { method: "POST", headers: { "Content-Type": "application/json", "CF-IPCountry": "CA", "X-Forwarded-For": "192.0.2.123" },
      body: JSON.stringify({ ...payload, demographics, country: "CA", ip: "192.0.2.123", ethnicityPreset: "canada" }) });
    assert.equal(res.status, 201, await res.text()); checks++;
  }
  assert.equal(saved.length, 6);
  for (const field of ["gender", "ageGroup", "relationshipStatus", "attendanceFrequency", "tenure", "smallGroupFrequency", "volunteerFrequency", "childrenInHousehold", "raceEthnicity"]) assert.equal(saved[0][field], null);
  assert.equal(saved[2].raceEthnicity, '["white","black"]');
  assert.equal(saved[2].childrenInHousehold, '["0-2 year old(s)"]');
  assert.equal(saved[3].raceEthnicity, '["south_asian"]');
  assert.equal(saved[4].raceEthnicity, null); assert.equal(saved[4].childrenInHousehold, null);
  assert.equal(saved[5].raceEthnicity, null);
  assert(!/192\.0\.2|country|ethnicityPreset|\bip\b/i.test(JSON.stringify(saved))); checks++;
  const token = createSession("synthetic"), admin = createAdminSession();
  for (const [route, auth] of [["/api/waves/synthetic/report", token], ["/api/admin/waves/synthetic/report", admin], ["/api/waves", token], ["/api/waves/synthetic", token]]) {
    const res = await fetch(base + route, { headers: { Authorization: `Bearer ${auth}` } });
    const body = await res.text(); assert.equal(res.status, 200, `${route}: ${body}`);
    assert(!/Female|Male/.test(body), `${route} leaked raw snapshot`); checks++;
  }
  assert(snapshot.summaryJson.includes("Male")); // archive unchanged
  const reject = await fetch(base + "/api/responses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload, joinCode: "GRACEDEMO" }) });
  assert.equal(reject.status, 403); assert.equal(saved.length, 6); checks++;
  assert.equal(unexpected, 0);
  console.log(`PASS: ${checks} HTTP/persistence-boundary checks; mocked transaction adapter, zero real database/storage calls.`);
} finally {
  server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve()));
}
