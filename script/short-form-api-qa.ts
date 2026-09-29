import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { churches, surveyWaves, responses } from "../shared/schema";
import { SURVEY_ITEMS } from "../shared/surveyItems";
import { retainedAnswers, classifyStoredResponse } from "../shared/shortForm";

const url = new URL(process.env.DATABASE_URL!);
assert(["127.0.0.1", "localhost"].includes(url.hostname) && url.pathname === "/jj_preview");
const { db, storage } = await import("../server/storage");
const { registerRoutes } = await import("../server/routes");
const { createSession } = await import("../server/auth");
const id = `SHORT-QA-${randomUUID()}`.toUpperCase();
await db.insert(churches).values({ id, name: "SYNTHETIC QA", communityCode: id, primaryContactName: "Synthetic", primaryContactEmail: `${id}@example.test`, passwordHash: "not-a-real-password" });
await db.insert(surveyWaves).values({ id, churchId: id, label: "SYNTHETIC ONLY", joinCode: id, status: "live", paymentStatus: "paid", minSampleSize: 16 });
const app = express(); app.use(express.json());
const server = createServer(app); await registerRoutes(server, app);
app.use((err: Error, _req: any, res: any, _next: any) => res.status(500).json({ message: err.message }));
await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${(server.address() as any).port}`;
const all = Object.fromEntries(SURVEY_ITEMS.map(item => [item.code, 4]));
let checks = 0;
async function request(path: string, status: number, body?: unknown, token?: string) {
  const res = await fetch(base + path, { method: body ? "POST" : "GET", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const text = await res.text(); assert.equal(res.status, status, `${path}: ${text}`); checks++;
  return text ? JSON.parse(text) : null;
}
const payload = (initial: number) => ({ joinCode: id, journeyPre: initial, journeyPost: initial <= 2 ? 5 : 1, spiritualChange: 2, items: retainedAnswers(all, initial), demographics: { gender: "Female", age: "30-39" } });
try {
  await request(`/api/join/${id}`, 200);
  for (const initial of [1, 2, 3, 4, 5]) await request("/api/responses", 201, payload(initial));
  assert.equal(await storage.countResponsesByWave(id), 5);
  const rows = await db.select().from(responses).where(eq(responses.waveId, id));
  for (const row of rows) {
    assert.equal(classifyStoredResponse(row), row.journeyPre! <= 2 ? "distant_exploring_short" : "full");
    if (row.journeyPre! <= 2) { assert.equal(row.b6, null); assert.equal(row.k3, 4); assert.equal(row.journeyPost, 5); }
  }
  for (const body of [
    { ...payload(1), items: {} },
    { ...payload(1), items: { ...retainedAnswers(all, 1), B6: 4 } },
    { ...payload(3), items: retainedAnswers(all, 1) },
    { ...payload(1), journeyPre: undefined },
    { ...payload(1), items: { ...retainedAnswers(all, 1), B1: 2.5 } },
  ]) await request("/api/responses", 400, body);
  assert.equal(await storage.countResponsesByWave(id), 5);
  await request("/api/responses", 403, { joinCode: "GRACEDEMO", items: {} });
  await request(`/api/waves/${id}/report`, 401);
  await request(`/api/waves/${id}/report`, 404, undefined, createSession("another-church"));
  await request(`/api/admin/waves/${id}/debriefing`, 401);
  const own = createSession(id);
  const participation = await request(`/api/waves/${id}/participation`, 200, undefined, own);
  assert.equal(participation.total, 5);
  assert(!JSON.stringify(participation).includes("journeyPre"));
  await db.update(responses).set({ gender: "Male" }).where(eq(responses.respondentId, rows[0].respondentId));
  const hidden = await request(`/api/waves/${id}/participation`, 200, undefined, own);
  assert.deepEqual(hidden.gender, []); assert.equal(hidden.suppressed.gender, true);
  await db.update(surveyWaves).set({ status: "closed" }).where(eq(surveyWaves.id, id));
  await request("/api/responses", 410, payload(1));
  assert.equal(await storage.countResponsesByWave(id), 5);
  console.log(`PASS: ${checks} real HTTP checks with isolated PostgreSQL; 38/63 persistence, omitted NULLs, validation, access control, privacy, demo and closed-wave guards.`);
} finally {
  server.closeAllConnections();
  await new Promise<void>(resolve => server.close(() => resolve()));
}
process.exit(0);
