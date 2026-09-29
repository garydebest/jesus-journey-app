// Isolated test/preview fixture. No credentials, database, payments, or email.
import { readFile } from "node:fs/promises";
import { storage } from "../server/storage";
import { DEMO_CHURCH_ID } from "../shared/surveyAccess";
import { DASHBOARD_DEMO_WAVE_ID } from "../shared/dashboardDemo";

export async function installDashboardDemoFixture(includePdfMetadata = false) {
  const report = JSON.parse(await readFile("server/report-engine/debriefing/sample_fixture.json", "utf8"));
  // Reuse the saved demo aggregates, not new report generation.
  const summary = {
    respondentCount: report.respondentCount, generatedAt: report.generatedAt,
    pathwayAverages: report.pathwaysByGoal.flatMap((g: any) => g.pathways.map((p: any) => ({
      num: p.num, name: p.name, goal: g.goal, score: p.churchAverage, band: p.band,
    }))),
    goalAverages: Object.fromEntries(report.pathwaysByGoal.map((g: any) => [g.goal, g.goalAverage])),
    maturityDistribution: report.maturityAndChange.distribution.map((s: any, i: number) => ({ ...s, level: i + 1 })),
    averageMaturity: report.maturityAndChange.averageMaturity,
    demographics: { gender: {}, ageGroup: {}, attendanceFrequency: {}, tenure: {} },
  };
  const demoWave = {
    id: DASHBOARD_DEMO_WAVE_ID, churchId: DEMO_CHURCH_ID,
    label: report.waveLabel, status: "closed", paymentStatus: "paid",
    joinCode: "DEMOSAMPLE", minSampleSize: 300, createdAt: report.generatedAt,
    closedAt: report.generatedAt, opensAt: "2026-08-01", closesAt: "2026-09-10",
    stripeCheckoutSessionId: "PRIVATE_SENTINEL",
  };
  const otherWave = { ...demoWave, id: "other-church-wave", churchId: "other-church" };
  const unpaidWave = { ...otherWave, id: "unpaid-wave", status: "pending_payment", paymentStatus: "unpaid", joinCode: "UNPAID" };
  const snapshot = {
    respondentCount: 210, summaryJson: JSON.stringify(summary),
    reportPdfPath: includePdfMetadata ? "sample-report.pdf" : null,
    commentsReportPdfPath: includePdfMetadata ? "sample-comments.pdf" : null,
    internalOnly: "PRIVATE_SENTINEL",
  };
  let unexpectedCalls = 0;
  for (const key of Object.keys(storage)) {
    if (typeof (storage as any)[key] === "function") (storage as any)[key] = async () => {
      unexpectedCalls++;
      throw Error(`Unexpected storage call: ${key}`);
    };
  }
  Object.assign(storage, {
    getWaveById: async (id: string) => [demoWave, otherWave, unpaidWave].find(w => w.id === id),
    getWavesByChurch: async (id: string) => [demoWave, otherWave, unpaidWave].filter(w => w.churchId === id),
    getSnapshotByWave: async () => snapshot,
    countResponsesByWave: async () => 0,
    getWaveByJoinCode: async (code: string) => [demoWave, unpaidWave].find(w => w.joinCode === code),
  });
  return { demoWave, summary, unexpectedCalls: () => unexpectedCalls };
}
