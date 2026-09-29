import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import { registerRoutes } from "../server/routes";
import { createSession } from "../server/auth";
import { DASHBOARD_DEMO_TOKEN, DASHBOARD_DEMO_WAVE_ID, allowsDashboardDemoRequest } from "../shared/dashboardDemo";
import { installDashboardDemoFixture } from "./dashboard-demo-fixture";

const fixture = await installDashboardDemoFixture();
const app = express();
app.use(express.json());
const server = createServer(app);
await registerRoutes(server, app);
app.use((err: Error, _req: any, res: any, _next: any) => res.status(500).json({ message: err.message }));
await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${(server.address() as any).port}`;
let checks = 0;
async function request(path: string, status: number, method = "GET", token: string | null = DASHBOARD_DEMO_TOKEN, body?: any) {
  const res = await fetch(base + path, {
    method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), "Content-Type": "application/json" },
    ...(method !== "GET" && method !== "HEAD" ? { body: JSON.stringify(body ?? {}) } : {}),
  });
  const text = await res.text();
  assert.equal(res.status, status, `${method} ${path}: ${text}`);
  checks++;
  return { res, text, json: text ? JSON.parse(text) : null };
}
try {
  await request("/api/waves", 401, "GET", null);
  await request("/api/waves", 401, "GET", "invalid");
  const result = await request("/api/waves?churchId=other-church", 200);
  assert.equal(result.json.waves.length, 1);
  assert.equal(result.json.waves[0].id, DASHBOARD_DEMO_WAVE_ID);
  assert(!result.text.includes("PRIVATE_SENTINEL"));
  assert(!result.text.includes("stripeCheckoutSessionId"));
  assert.equal(result.res.headers.get("cache-control"), "private, no-store");
  const report = await request(`/api/waves/${DASHBOARD_DEMO_WAVE_ID}/report`, 200);
  assert.equal(report.json.snapshot.summary.respondentCount, 210);
  assert(!report.text.includes("PRIVATE_SENTINEL"));
  assert(!report.text.includes("summaryJson"));
  await request(`/api/waves/${DASHBOARD_DEMO_WAVE_ID}/report.pdf`, 404); // Fixture has no stored PDFs.
  await request(`/api/waves/${DASHBOARD_DEMO_WAVE_ID}/comments-report.pdf`, 404);
  await request("/api/waves", 200, "HEAD");
  for (const path of [
    "/api/churches/me", "/api/churches/plan", "/api/admin/churches",
    "/api/waves/other-church-wave/report", "/api/waves/other-church-wave/report.pdf",
    "/api/waves/other-church-wave/comments-report.pdf",
    `/api/waves/${DASHBOARD_DEMO_WAVE_ID}/payment-status`,
    `/api/waves/${DASHBOARD_DEMO_WAVE_ID}/participation`,
    `/api/waves/${DASHBOARD_DEMO_WAVE_ID}/timeline`,
    `/api/waves/${DASHBOARD_DEMO_WAVE_ID}/debriefing`,
    "/api/future-feature",
  ]) await request(path, 403);
  for (const [method, path] of [
    ["POST", "/api/waves"], ["PUT", "/api/churches/plan"], ["PATCH", "/api/churches/me"],
    ["POST", `/api/waves/${DASHBOARD_DEMO_WAVE_ID}/confirm-plan`],
    ["POST", `/api/waves/${DASHBOARD_DEMO_WAVE_ID}/close`],
    ["PATCH", `/api/waves/${DASHBOARD_DEMO_WAVE_ID}/dates`],
    ["DELETE", `/api/waves/${DASHBOARD_DEMO_WAVE_ID}/pending`],
    ["POST", "/api/responses"], ["POST", "/api/churches/signup"],
    ["POST", "/api/churches/login"], ["POST", "/api/admin/login"],
    ["POST", "/api/stripe/webhook"],
  ]) await request(path, 403, method, DASHBOARD_DEMO_TOKEN, { churchId: "other-church" });
  const regular = createSession("other-church");
  await request("/api/waves/other-church-wave/report", 200, "GET", regular);
  await request(`/api/waves/${DASHBOARD_DEMO_WAVE_ID}/report`, 404, "GET", regular);
  const own = await request("/api/waves", 200, "GET", regular);
  assert(!own.json.waves.some((w: any) => w.id === DASHBOARD_DEMO_WAVE_ID));
  assert.equal(own.json.waves.find((w: any) => w.id === "unpaid-wave").joinCode, null);
  await request("/api/waves/unpaid-wave/confirm-plan", 403, "POST", regular);
  await request("/api/join/UNPAID", 403, "GET", null);
  await request("/api/join/GRACEDEMO", 200, "GET", null);
  await request("/api/responses", 403, "POST", null, { joinCode: "GRACEDEMO", items: {} });
  assert.equal(fixture.unexpectedCalls(), 0);
  assert(!allowsDashboardDemoRequest("POST", "/api/waves"));
  assert(!allowsDashboardDemoRequest("GET", "/api/waves/other-church-wave/report"));
  console.log(`PASS: ${checks} HTTP checks; public projection, exact demo scope, write rejection, admin isolation, ordinary account ownership, unpaid activation, participant demo, zero unexpected storage calls.`);
} finally {
  server.closeAllConnections();
  await new Promise<void>(resolve => server.close(() => resolve()));
}
