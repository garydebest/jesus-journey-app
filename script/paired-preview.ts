// Isolated review harness. No database connection, email, payment, or writes.
import express from "express";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { storage } from "../server/storage";
import { registerRoutes } from "../server/routes";
import { buildDemographicAssessment, buildMaturityStageAssessment } from "../shared/debriefing/systematicAssessment";
const report = JSON.parse(await readFile("server/report-engine/debriefing/sample_fixture.json", "utf8"));
report.demographicAssessment = buildDemographicAssessment(report.demographics);
report.maturityStageAssessment = buildMaturityStageAssessment(report.maturityAndChange.changeByMaturity);
const church = { id: report.churchId, name: report.churchName, communityCode: "DEMO",
  primaryContactName: "Preview contact", primaryContactEmail: "demo@myjesusjourney.life",
  primaryContactPhone: null, region: "Synthetic sample", createdAt: report.generatedAt };
const wave = { id: report.waveId, churchId: church.id, label: report.waveLabel, status: "closed",
  paymentStatus: "paid", joinCode: "DEMO-HISTORY", minSampleSize: 50, createdAt: report.generatedAt,
  closedAt: report.generatedAt, opensAt: "2026-08-01", closesAt: "2026-09-10" };
// Fail closed: any unexpected storage call must never reach a real database.
for (const key of Object.keys(storage)) {
  if (typeof (storage as any)[key] === "function")
    (storage as any)[key] = async () => { throw Error("Unavailable in read-only preview"); };
}
Object.assign(storage, {
  getAllChurches: async () => [church], getAllWaves: async () => [wave],
  getAllLegacySnapshots: async () => [], getChurchById: async () => church,
  getSnapshotByWave: async () => ({ respondentCount: 210 }),
  getDebriefingReportByWave: async (id: string) => id === wave.id
    ? { reportJson: JSON.stringify(report), respondentCount: 210, generatedAt: report.generatedAt } : undefined,
});
const app = express();
app.use((req, res, next) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  if (req.method !== "GET" && !["/api/admin/login", "/api/admin/logout"].includes(req.path))
    return res.status(403).json({ message: "Read-only synthetic preview" });
  next();
});
app.use(express.json());
const server = createServer(app);
await registerRoutes(server, app);
app.use(express.static("dist/public"));
app.use((err: Error, _req: any, res: any, _next: any) => res.status(500).json({ message: err.message }));
server.listen(5000, "0.0.0.0", () => console.log("Read-only synthetic report preview ready"));
