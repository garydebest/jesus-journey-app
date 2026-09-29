// Explicitly sandbox-only fixtures. Never connect this script to production.
import bcrypt from "bcryptjs";
import { db, storage } from "../server/storage";
import { churches, surveyWaves, aggregateSnapshots, ITEM_CODES } from "../shared/schema";
import { DEMO_CHURCH_ID } from "../shared/surveyAccess";
import { computeWaveAggregate } from "../shared/aggregate";

const url = new URL(process.env.DATABASE_URL!);
if (!["127.0.0.1", "localhost"].includes(url.hostname) || url.pathname !== "/jj_preview")
  throw new Error("Seed is restricted to the local jj_preview database.");
const hash = await bcrypt.hash("PreviewOnly2026", 10);
for (const [id, name, email] of [
  [DEMO_CHURCH_ID, "Grace Fellowship Community Church", "demo@myjesusjourney.life"],
  ["preview-returning", "Returning Church (preview)", "returning@example.test"],
  ["preview-paid", "Paid Church (preview)", "paid@example.test"],
  ["preview-unpaid", "Registered Church (preview)", "registered@example.test"],
]) {
  await db.insert(churches).values({ id, name, primaryContactEmail: email, primaryContactName: "Preview contact",
    communityCode: "ACCOUNT-" + id, passwordHash: id === DEMO_CHURCH_ID ? await bcrypt.hash("Firstlook", 10) : hash }).onConflictDoNothing();
}
for (const [id, churchId, status, paymentStatus, code] of [
  ["preview-grace-history", DEMO_CHURCH_ID, "closed", "paid", "DEMO-HISTORY"],
  ["preview-history", "preview-returning", "closed", "paid", "PAST-SURVEY"],
  ["preview-paid-wave", "preview-paid", "not_started", "paid", "PREVIEW-PAID"],
  ["preview-unpaid-wave", "preview-unpaid", "pending_payment", "unpaid", "PREVIEW-UNPAID"],
] as const) {
  await db.insert(surveyWaves).values({ id, churchId, label: status === "closed" ? "Illustrative past survey (synthetic data)" : "New survey (preview)",
    status, paymentStatus, joinCode: code, minSampleSize: 50, opensAt: "2026-10-18", closesAt: "2026-11-01",
    closedAt: status === "closed" ? "2026-08-01T12:00:00Z" : null }).onConflictDoNothing();
  if (status === "closed") {
    const rows = Array.from({length: 30}, (_, i) => ({
      ...Object.fromEntries(ITEM_CODES.map((key, j) => [key, 2 + (i + j) % 4])),
      respondentId: `synthetic-${i}`, waveId: id, journeyPre: 2 + i % 4, journeyPost: 2 + i % 4,
      spiritualChange: 1 + i % 4, gender: i % 2 ? "Male" : "Female",
      ageGroup: ["16-19", "20-29", "30-39", "40-49", "50-59", "60 and older"][i % 6],
      relationshipStatus: "Married", attendanceFrequency: "Weekly", tenure: "3-5 years",
      smallGroupFrequency: "Weekly", volunteerFrequency: "Monthly", childrenInHousehold: "[]",
      raceEthnicity: null, commentText: null, createdAt: new Date(),
    }));
    const summary = computeWaveAggregate(rows as any);
    await db.insert(aggregateSnapshots).values({ id: `${id}-snapshot`, waveId: id, churchId, respondentCount: rows.length,
      summaryJson: JSON.stringify(summary) }).onConflictDoNothing();
  }
}
console.log("Synthetic preview fixtures ready. No production data was modified.");
process.exit(0);
