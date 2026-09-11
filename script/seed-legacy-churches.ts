// One-time seed for two 2017 SJI "Jesus Journey" PDF-report churches, entered
// as historical baselines. Per the governing rule for this data ("store only
// what the PDF's show"), every figure below is transcribed directly from a
// legible chart/table in the source PDF. Nothing is estimated, computed, or
// back-filled. Where a source chart rendered corrupted values (impossible
// numbers like "1,411%"), the figure is stored as `pct: null` with a note —
// never a guess.
//
// Usage:
//   tsx script/seed-legacy-churches.ts
//
// Idempotency: this script always creates NEW church + legacy_snapshot rows.
// It does not check for existing rows by name, so do not run it twice without
// first deleting the previously seeded rows (see printed IDs after running).

import { storage } from "../server/storage";
import type {
  LegacySnapshotSummary,
  LegacyPathwayFigure,
  LegacyGoalFigure,
} from "../shared/schema";

// Canonical pathway/goal names and order, matching the app's own 4-goal /
// 16-pathway structure (see shared/scoring.ts), used only as labels here —
// no scoring logic is invoked for legacy data.
const PATHWAY_DEFS: { num: number; name: string; goal: string }[] = [
  { num: 1, name: "Believing God's Story", goal: "Trusting Jesus" },
  { num: 2, name: "Receiving God's Love", goal: "Trusting Jesus" },
  { num: 3, name: "My Identity", goal: "Trusting Jesus" },
  { num: 4, name: "Facing Challenges", goal: "Trusting Jesus" },
  { num: 5, name: "Responding to God's Will", goal: "Experiencing Jesus" },
  { num: 6, name: "Communicating with God", goal: "Experiencing Jesus" },
  { num: 7, name: "Growing My Faith", goal: "Experiencing Jesus" },
  { num: 8, name: "Worshiping God", goal: "Experiencing Jesus" },
  { num: 9, name: "Expressing God's Love", goal: "Reflecting Jesus" },
  { num: 10, name: "Practicing My Faith", goal: "Reflecting Jesus" },
  { num: 11, name: "Journeying with Others", goal: "Reflecting Jesus" },
  { num: 12, name: "Reconciling with Others", goal: "Reflecting Jesus" },
  { num: 13, name: "Partnering with God", goal: "Serving Jesus" },
  { num: 14, name: "Stewarding Resources", goal: "Serving Jesus" },
  { num: 15, name: "Showing Compassion", goal: "Serving Jesus" },
  { num: 16, name: "Acting Justly", goal: "Serving Jesus" },
];

function pathways(values: (number | null)[]): LegacyPathwayFigure[] {
  if (values.length !== 16) throw new Error(`Expected 16 pathway values, got ${values.length}`);
  return PATHWAY_DEFS.map((def, i) => ({ ...def, pct: values[i] }));
}

function goals(values: (number | null)[]): LegacyGoalFigure[] {
  const names = ["Trusting Jesus", "Experiencing Jesus", "Reflecting Jesus", "Serving Jesus"];
  if (values.length !== 4) throw new Error(`Expected 4 goal values, got ${values.length}`);
  return names.map((goal, i) => ({ goal, pct: values[i] }));
}

// ---------------------------------------------------------------------------
// Canyon View Vineyard Church — 11/2/2017, n=330
// Sources: SJI-Canyonview-9-Survey-Report-{1,2,3,4}.pdf (pages 1-27) +
// Group-Report-4-copy.pdf (clean replacement, pages 28-38, for Goal 3/4 and
// the 16-pathway Church Summary — the original Report-4 file had corrupted
// chart values on pages 30/34/36 like "1,168/1,120/1,150/1,206" and is
// superseded/disregarded for those pages).
// ---------------------------------------------------------------------------
const canyonView: { name: string; region: string | null; summary: LegacySnapshotSummary; respondentCount: number; sourceFileNote: string } = {
  name: "Canyon View Vineyard Church",
  region: null,
  respondentCount: 330,
  sourceFileNote:
    "SJI-Canyonview-9-Survey-Report-1.pdf, -2.pdf, -3.pdf, -4.pdf (pages 1-27); Group-Report-4-copy.pdf (clean replacement for pages 28-38 — Goal 3, Goal 4, and 16-pathway Church Summary; supersedes the corrupted charts on pages 30/34/36 of -4.pdf)",
  summary: {
    sourceLabel: "SJI 2017 Jesus Journey Report",
    reportDate: "2017-11-02",
    surveyWindow: "2017-09-29 to 2017-10-15",
    maturityDistribution: [
      { label: "Distant", pct: 0.6 },
      { label: "Exploring", pct: 1.5 },
      { label: "Believing in Jesus", pct: 9.7 },
      { label: "Trusting Jesus", pct: 41.8 },
      { label: "Jesus Centered", pct: 46.4 },
    ],
    spiritualChangeDistribution: [
      { label: "Growing significantly", pct: 57.9 },
      { label: "Growing a little", pct: 26.4 },
      { label: "About the same", pct: 11.8 },
      { label: "Fading somewhat", pct: 2.4 },
      { label: "Fading a lot", pct: 1.5 },
    ],
    goalAverages: goals([76, 70, 71, 66]), // church-wide Goal 1-4 %, per Church Summary rollup
    pathwayAverages: pathways([
      89, 93, 77, 75, // Goal 1: Trusting Jesus
      78, 74, 53, 76, // Goal 2: Experiencing Jesus
      71, 68, 69, 74, // Goal 3: Reflecting Jesus (clean replacement file)
      81, 68, 57, 58, // Goal 4: Serving Jesus (clean replacement file)
    ]),
    demographics: {
      Gender: { Female: 60, Male: 40 },
      "Age": { "16-19": 2, "20-29": 9, "30-39": 13, "40-49": 12, "50-59": 28, "60+": 35 },
      "Relationship status": {
        "Independent singles": 10,
        "Singles in a relationship": 5,
        Married: 75,
        "Married, separated": 2,
        "Civil partnership": 0,
        Divorced: 8,
      },
      "Children in household": { None: 60, "0-2": 8, "3-5": 9, "6-10": 12, "11-18": 18, "19+": 12 },
      "Race/ethnicity": { White: 91, Black: 0, "Native/First Nations": 1, Asian: 2, "East Indian": 0, Hispanic: 4, Multiple: 2 },
      "Time in church": { "<1 year": 8, "1-2 years": 12, "3-5 years": 25, "6-10 years": 22, "11+ years": 34 },
      "Worship attendance": { Weekly: 78, "A few times/month": 17, Monthly: 2, "A few times a year": 2, Infrequently: 2 },
      "Small group attendance": { Weekly: 51, "A few times/month": 17, Monthly: 5, "A few times a year": 6, Infrequently: 22 },
      Volunteering: { Weekly: 22, "A few times/month": 18, Monthly: 10, "A few times a year": 15, Infrequently: 34 },
    },
    notes: null,
  },
};

// ---------------------------------------------------------------------------
// Durango Vineyard — 10/15/2017, n=78
// Sources: SJI-Durango-Jesus-Journey-Report-1.pdf, SJI-Durango-10-Survey-
// Report-{2,3,4}.pdf. NO clean replacement file exists for Durango (unlike
// Canyon View) — Goal 3, Goal 4, and the full 16-pathway Church Summary
// chart all rendered corrupted (impossible values like "1,411%") in every
// available source file. Per "store only what the PDF's show", those
// sections are stored as null rather than estimated. Goal 1 and Goal 2 are
// clean and stored as printed.
// ---------------------------------------------------------------------------
const durango: { name: string; region: string | null; summary: LegacySnapshotSummary; respondentCount: number; sourceFileNote: string } = {
  name: "Durango Vineyard",
  region: null,
  respondentCount: 78,
  sourceFileNote:
    "SJI-Durango-Jesus-Journey-Report-1.pdf, SJI-Durango-10-Survey-Report-2.pdf, -3.pdf, -4.pdf. No clean replacement file exists (checked, unlike Canyon View) — Goal 3 (page 30), Goal 4 (page 34), and the 16-pathway Church Summary (page 36) all render corrupted impossible values (e.g. 1,411 / 1,385 / ... / 841) in every available file and are stored as null rather than estimated.",
  summary: {
    sourceLabel: "SJI 2017 Jesus Journey Report",
    reportDate: "2017-10-15",
    surveyWindow: "2017-10-04 to 2017-10-12",
    maturityDistribution: [
      { label: "Exploring", pct: 5.1 },
      { label: "Believing in Jesus", pct: 19.2 },
      { label: "Trusting Jesus", pct: 44.9 },
      { label: "Jesus Centered", pct: 30.8 },
    ],
    spiritualChangeDistribution: [
      { label: "Growing significantly", pct: 38.5 },
      { label: "Growing a little", pct: 37.2 },
      { label: "About the same", pct: 14.1 },
      { label: "Fading somewhat", pct: 7.7 },
      { label: "Fading a lot", pct: 2.6 },
    ],
    // Goal 3 and Goal 4 church-wide rollups were themselves only visible via
    // the (corrupted) Church Summary chart — no clean alternate rollup
    // number exists for them either, so both are null.
    goalAverages: goals([74, 52, null, null]),
    pathwayAverages: pathways([
      88, 87, 60, 62, // Goal 1: Trusting Jesus — clean (page 22)
      60, 56, 33, 59, // Goal 2: Experiencing Jesus — clean (page 26)
      null, null, null, null, // Goal 3: Reflecting Jesus — corrupted (page 30), no clean source
      null, null, null, null, // Goal 4: Serving Jesus — corrupted (page 34), no clean source
    ]),
    demographics: {
      Gender: { Female: 53, Male: 47 },
      Age: { "16-19": 5, "20-29": 28, "30-39": 21, "40-49": 27, "50-59": 12, "60+": 8 },
      "Relationship status": {
        "Independent singles": 26,
        "Singles in a relationship": 6,
        Married: 64,
        "Married, separated": 0,
        "Civil partnership": 0,
        Divorced: 4,
      },
      "Children in household": { None: 47, "0-2": 5, "3-5": 9, "6-10": 23, "11-18": 23, "19+": 10 },
      "Race/ethnicity": { White: 95, Black: 1, "Native/First Nations": 3, Asian: 1, "East Indian": 0, Hispanic: 0, Multiple: 0 },
      "Time in church": { "<1 year": 32, "1-2 years": 47, "3-5 years": 12, "6-10 years": 0, "11+ years": 9 },
      "Worship attendance": { Weekly: 69, "A few times/month": 24, Monthly: 4, "A few times a year": 0, Infrequently: 3 },
      "Small group attendance": { Weekly: 23, "A few times/month": 19, Monthly: 12, "A few times a year": 10, Infrequently: 36 },
      Volunteering: { Weekly: 17, "A few times/month": 24, Monthly: 21, "A few times a year": 9, Infrequently: 29 },
    },
    notes:
      "Goal 3 (Reflecting Jesus), Goal 4 (Serving Jesus), and the full 16-pathway Church Summary chart rendered with corrupted, impossible values (e.g. over 1,000%) in every available source PDF for this church. No clean replacement file was available (checked). These figures are stored as not available rather than estimated, per the governing rule to store only what the source PDF legibly shows.",
  },
};

async function seedChurch(entry: typeof canyonView) {
  const church = await storage.createLegacyChurch(entry.name, entry.region);
  const snapshot = await storage.createLegacySnapshot({
    churchId: church.id,
    respondentCount: entry.respondentCount,
    summaryJson: JSON.stringify(entry.summary),
    sourceFileNote: entry.sourceFileNote,
  });
  console.log(`Seeded ${entry.name}: church.id=${church.id} legacySnapshot.id=${snapshot.id}`);
}

async function main() {
  await seedChurch(canyonView);
  await seedChurch(durango);
  console.log("Done.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
