import assert from "node:assert/strict";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { DEMOGRAPHICS } from "../shared/questions";
import { ETHNICITY_PRESETS, ethnicityPresetForCountry, ethnicityIds, ethnicityLabels, encodeEthnicity, clearDemographic, toggleExclusive, demographicCounts, safeDemographicCounts } from "../shared/demographicPolicy";
import { submitResponseSchema } from "../shared/submission";
import { analyzeDemographics } from "../shared/debriefing/demographics";
import { buildDemographicAssessment } from "../shared/debriefing/systematicAssessment";
import { buildDebriefingReport } from "../shared/debriefing/engine";
import { projectReportForDisplay } from "../shared/debriefing/reportProjection";
import { projectDemographicSummary } from "../shared/demographicProjection";
import { computeWaveAggregate } from "../shared/aggregate";
import { buildCohortReporting } from "../shared/cohortReporting";
import { makeSyntheticResponse } from "./syntheticShortForm";
import { SURVEY_ITEMS } from "../shared/surveyItems";
import { childrenProfile } from "../shared/reportMetrics";
let checks = 0;
const check = (name: string, fn: () => void) => { fn(); checks++; console.log(`PASS ${name}`); };
const rows = (n: number) => Array.from({ length: n }, (_, i) => ({
  ...makeSyntheticResponse(false, i), gender: "Female", ageGroup: "30-39", relationshipStatus: "Married",
  attendanceFrequency: "Every week", tenure: "3-5 years", smallGroupFrequency: "Monthly",
  volunteerFrequency: "Monthly", childrenInHousehold: '["0-2 year old(s)","3-5 year old(s)"]', raceEthnicity: '["white","black"]',
  journeyPost: 4, spiritualChange: 1,
}));
const makeReport = (rs: ReturnType<typeof rows>) => buildDebriefingReport({ waveId: "synthetic", churchId: "synthetic", churchName: "Synthetic QA", waveLabel: "Privacy", rows: rs });
check("country presets and no-header fallback", () => {
  for (const [country, preset] of [["CA", "canada"], ["US", "usa"], ["GB", "uk"], ["FR", "international"], ["XX", "international"], ["T1", "international"], ["", "international"], [undefined, "international"]]) assert.equal(ethnicityPresetForCountry(country), preset);
  assert.equal(ethnicityPresetForCountry(" ca "), "canada");
  assert.deepEqual(Object.values(ETHNICITY_PRESETS).map(v => v.length), [11, 10, 8, 9]);
  Object.values(ETHNICITY_PRESETS).flat().filter(v => v !== "Prefer not to say").forEach(v => assert(ethnicityIds(v).length, v));
});
check("legacy and regional labels normalize without losing distinctions", () => {
  assert.deepEqual(ethnicityIds('["White/Caucasian","White","Black or African American"]'), ["white", "black"]);
  assert.deepEqual(ethnicityIds("East Indian descent"), ["south_asian"]);
  assert.deepEqual(ethnicityIds("Asian descent"), ["asian"]);
  assert.deepEqual(ethnicityIds("First Nations, Métis, or Inuit"), ["indigenous"]);
  assert.deepEqual(ethnicityIds("Middle Eastern / West Asian"), ["middle_eastern_west_asian"]);
  assert.deepEqual(ethnicityIds("Arab"), ["arab"]);
  assert.equal(encodeEthnicity([]), null);
  assert.equal(encodeEthnicity(["White", "Black"]), '["white","black"]');
  assert.equal(encodeEthnicity(["White", "Prefer not to say"]), null);
});
check("skip deletes previous answer on every screen; preferences exclusive", () => {
  DEMOGRAPHICS.forEach(d => {
    const state = { demographics: { [d.id]: d.type === "multi" ? [d.options[0]] : d.options[0] } };
    assert(!Object.hasOwn(clearDemographic(state, d.id).demographics, d.id));
    assert(Object.hasOwn(state.demographics, d.id));
  });
  assert.deepEqual(toggleExclusive(["White"], "Prefer not to say"), ["Prefer not to say"]);
  assert.deepEqual(toggleExclusive(["Prefer not to say"], "Black"), ["Black"]);
  assert.deepEqual(toggleExclusive(["None"], "0-2 year old(s)", "None"), ["0-2 year old(s)"]);
  const source = readFileSync("client/src/pages/DemographicQuestion.tsx", "utf8");
  assert(source.includes('data-testid="button-demo-skip"'));
  assert(!source.includes("essential"));
});
const base = { joinCode: "SYNTHETIC", journeyPre: 3, journeyPost: 4, spiritualChange: 1, items: Object.fromEntries(SURVEY_ITEMS.map(q => [q.code, 4])) };
check("optional submission, array/legacy validation, unknown location stripped", () => {
  assert(submitResponseSchema.safeParse(base).success);
  for (const ethnicity of [["White", "Black"], "White/Caucasian", [], ["Prefer not to say"]]) assert(submitResponseSchema.safeParse({ ...base, demographics: { ethnicity } }).success);
  assert(!submitResponseSchema.safeParse({ ...base, demographics: { ethnicity: ["unexpected free text"] } }).success);
  const parsed = submitResponseSchema.parse({ ...base, country: "CA", ip: "192.0.2.1", ethnicityPreset: "canada", demographics: { country: "CA", ip: "192.0.2.1" } });
  assert(!/192\.0\.2|country|ethnicityPreset/.test(JSON.stringify(parsed)));
});
for (const n of [0, 1, 5, 6, 9, 10, 11, 20]) check(`all demographic fields and derived comparisons at n=${n}`, () => {
  const input = rows(n), original = JSON.stringify(input);
  const sections = analyzeDemographics(input);
  assert.equal(sections.length > 0, n >= 10);
  if (n >= 10) {
    for (const field of ["gender", "ageGroup", "relationshipStatus", "attendanceFrequency", "tenure", "smallGroupFrequency", "volunteerFrequency", "raceEthnicity", "childrenInHousehold", "singlesVsMarried"]) assert(sections.some(s => s.id === field), field);
  }
  sections.flatMap(s => s.breakdown).forEach(r => assert(r.n >= 10));
  const report = makeReport(input);
  for (const list of [report.demographicAssessment, ...report.demographics.map(d => d.insights), report.executiveSummary.strengths, report.executiveSummary.opportunities]) {
    list.filter(i => i.section.startsWith("Demographic")).forEach(i => assert((i.demographicN ?? 0) >= 10));
  }
  if (n < 10) assert.equal(buildDemographicAssessment(sections).length, 0);
  assert.equal(JSON.stringify(input), original);
  const summary = computeWaveAggregate(input);
  Object.values(summary.demographics).forEach(counts => Object.values(counts).forEach(v => assert(v >= 10)));
  childrenProfile(input).values.forEach(v => assert(v.count >= 10));
  for (const [name, profile] of Object.entries(buildCohortReporting(input).profiles)) {
    if (!["Journey after reflection", "Faith change"].includes(name)) profile.values.forEach(v => assert(v.count >= 10));
  }
});
check("missing and nondisclosed never become report categories or no-children", () => {
  const input = rows(20).map(r => ({ ...r, gender: "Prefer not to say", raceEthnicity: '["Prefer not to say"]', childrenInHousehold: null, ageGroup: null, relationshipStatus: null, attendanceFrequency: null, tenure: null, smallGroupFrequency: null, volunteerFrequency: null }));
  assert.deepEqual(analyzeDemographics(input), []);
  const report = makeReport(input as any);
  assert.deepEqual(report.engagement.insights, []);
  assert.deepEqual(report.demographicAssessment, []);
});
check("complementary suppression and overlap use respondent counts", () => {
  assert.deepEqual(demographicCounts([...Array(10).fill("Female"), ...Array(9).fill("Male")]), {});
  assert.deepEqual(demographicCounts([...Array(10).fill("Female"), null]), {});
  assert.deepEqual(safeDemographicCounts({ A: 10, B: 9 }, 30, true), { A: 10 });
  assert.deepEqual(safeDemographicCounts({ A: 10 }, 19, true), {});
  const profile = childrenProfile(rows(10));
  assert.equal(profile.values.reduce((n, v) => n + v.pct, 0), 200);
});
check("single status small rows not reconstructed as comparison narrative", () => {
  const input = [...rows(9).map(r => ({ ...r, relationshipStatus: "Independent single" })), ...rows(20)];
  const report = makeReport(input);
  assert(!JSON.stringify(report.demographicAssessment).includes("Single"));
});
check("archived summary and prose projections are non-mutating and idempotent", () => {
  const summary = { respondentCount: 20, demographics: { gender: { Female: 11, Male: 9 } }, children: { denominator: 20, missing: 1, values: [{ label: "Rare", count: 9, pct: 45 }] } };
  const original = JSON.stringify(summary), clean = projectDemographicSummary(summary);
  assert.deepEqual(clean.demographics.gender, {}); assert.deepEqual(clean.children.values, []);
  assert.equal(JSON.stringify(summary), original);
  assert.deepEqual(projectDemographicSummary(clean), clean);
  const report = makeReport(rows(20));
  report.executiveSummary.strengths.push({ section: "Demographics — Age", kind: "strength", headline: "SENTINEL_SMALL", detail: "9 people", directionalOnly: true, corroboration: 1 });
  assert(!JSON.stringify(projectReportForDisplay(report)).includes("SENTINEL_SMALL"));
  assert(JSON.stringify(report).includes("SENTINEL_SMALL"));
  assert.deepEqual(projectReportForDisplay(projectReportForDisplay(report)), projectReportForDisplay(report));
});
mkdirSync("qa-output", { recursive: true });
writeFileSync("qa-output/regional-rows.json", JSON.stringify(rows(20), null, 2));
writeFileSync("qa-output/regional-debrief.json", JSON.stringify(makeReport(rows(20)), null, 2));
writeFileSync("qa-output/regional-cohort.json", JSON.stringify(buildCohortReporting(rows(20)), null, 2));
console.log(`${checks} regional demographic test groups passed`);
