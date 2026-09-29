import assert from "node:assert/strict";
import { SHORT_FORM_CODES, SHORT_PATHWAY_ITEMS, isShortForm, surveyItemsFor, shortPathwayScores, selectShortPathways, retainedAnswers, itemResponseStatus, classifyStoredResponse } from "../shared/shortForm";
import { SURVEY_ITEMS } from "../shared/surveyItems";
import { PATHWAYS } from "../shared/pathways";
import { computePathwayScores } from "../shared/scoring";
import { submitResponseSchema } from "../shared/submission";
import { buildCohortReporting, safeDistribution } from "../shared/cohortReporting";
import { computeWaveAggregate } from "../shared/aggregate";
import { buildDebriefingReport } from "../shared/debriefing/engine";
import type { ResponseRow } from "../shared/schema";
import narratives from "../shared/shortFormNarratives.json";

let checks = 0;
function check(name: string, test: () => void) { test(); checks++; console.log("PASS", name); }
export function syntheticRow(short = true, value = 4, initial = short ? 1 : 3, final = 5): ResponseRow {
  return {
    ...Object.fromEntries(SURVEY_ITEMS.map(item => [item.code.toLowerCase(), !short || SHORT_FORM_CODES.includes(item.code) ? value : null])),
    journeyPre: initial, journeyPost: final, spiritualChange: 2,
    gender: "Female", ageGroup: "30-39", attendanceFrequency: "Every week",
    tenure: "3-5 years", relationshipStatus: "Married", smallGroupFrequency: "Every week",
    volunteerFrequency: "Monthly", childrenInHousehold: '["None"]', raceEthnicity: "White/Caucasian",
    commentText: null,
  } as ResponseRow;
}
const all = Object.fromEntries(SURVEY_ITEMS.map(item => [item.code, 4]));
const short = retainedAnswers(all, 1);
const payload = (initial = 1) => ({ joinCode: "SYNTHETIC", items: retainedAnswers(all, initial), journeyPre: initial, journeyPost: 5, spiritualChange: 2 });
check("38 unique retained / 25 omitted / 63 full, including explicitly retained K3-K5", () => {
  assert.equal(SHORT_FORM_CODES.length, 38); assert.equal(new Set(SHORT_FORM_CODES).size, 38);
  assert.equal(SURVEY_ITEMS.length - SHORT_FORM_CODES.length, 25);
  assert.deepEqual(["K3", "K4", "K5"].map(code => SHORT_FORM_CODES.includes(code)), [true, true, true]);
  assert.deepEqual(Object.values(SHORT_PATHWAY_ITEMS).flat().sort(), [...SHORT_FORM_CODES].sort());
});
check("opening 1/2 short; 3/4/5 full; display order and text unchanged", () => {
  for (let initial = 1; initial <= 5; initial++) {
    assert.equal(isShortForm(initial), initial <= 2);
    const actual = surveyItemsFor(initial);
    assert.equal(actual.length, initial <= 2 ? 38 : 63);
    for (const item of actual) assert.strictEqual(item, SURVEY_ITEMS.find(x => x.code === item.code));
  }
});
check("all 15 formulas, two-decimal rounding, P3 null, P4/P5/P15 single-item", () => {
  const values = Object.fromEntries(SHORT_FORM_CODES.map((code, i) => [code, 1 + i % 5]));
  const scores = shortPathwayScores(values);
  for (const score of scores) {
    const codes = SHORT_PATHWAY_ITEMS[score.num];
    assert.equal(score.score, codes.length ? Math.round(codes.reduce((n, code) => n + values[code], 0) / codes.length * 100) / 100 : null);
  }
  assert.equal(scores[2].status, "not_measured");
  for (const n of [4, 5, 15]) assert.equal(scores[n - 1].status, "single_item");
});
check("incomplete, invalid, omitted and answered statuses stay distinct", () => {
  const missing = { ...short }; delete missing.K1;
  assert.equal(shortPathwayScores(missing)[0].score, null);
  assert.equal(shortPathwayScores(missing)[0].status, "insufficient_responses");
  assert.equal(itemResponseStatus("B6", missing, 1), "omitted_by_variant");
  assert.equal(itemResponseStatus("K1", missing, 1), "unanswered");
  assert.equal(itemResponseStatus("B1", missing, 1), "answered");
  for (const value of [0, 6, 2.5, NaN]) assert.equal(shortPathwayScores({ ...short, T5: value })[3].score, null);
});
check("three highest and three lowest distinct; tie-break lower pathway number", () => {
  const result = selectShortPathways(short);
  assert.deepEqual(result.strengths.map(p => p.num), [1, 2, 4]);
  assert.deepEqual(result.opportunities.map(p => p.num), [5, 6, 7]);
  const varied = selectShortPathways({ ...short, C1: 1, T5: 2, P2: 3, K9: 5, L5: 5, L6: 5 });
  assert.equal(varied.strengths[0].num, 16);
  assert.deepEqual(varied.opportunities.map(p => p.num), [5, 4, 15]);
});
check("branch changes remove stale omitted answers, never invent new answers", () => {
  assert.equal(Object.keys(retainedAnswers(all, 1)).length, 38);
  assert.equal(Object.keys(retainedAnswers(short, 3)).length, 38);
});
check("submission validates required questions using INITIAL not final journey", () => {
  for (let initial = 1; initial <= 5; initial++) assert(submitResponseSchema.safeParse(payload(initial)).success);
  assert(submitResponseSchema.safeParse({ ...payload(1), journeyPost: 5 }).success);
  assert(submitResponseSchema.safeParse({ ...payload(5), journeyPost: 1 }).success);
  assert(!submitResponseSchema.safeParse({ ...payload(), items: { ...short, B6: 3 } }).success);
  assert(!submitResponseSchema.safeParse({ ...payload(), items: {} }).success);
  assert(!submitResponseSchema.safeParse({ ...payload(), journeyPre: undefined }).success);
  assert(!submitResponseSchema.safeParse({ ...payload(), items: { ...short, B1: 2.5 } }).success);
});
check("historical full records with opening 1/2 remain full; partial records excluded", () => {
  assert.equal(classifyStoredResponse(syntheticRow(false, 4, 1)), "full");
  assert.equal(classifyStoredResponse(syntheticRow(true, 4, 2, 5)), "distant_exploring_short");
  assert.equal(classifyStoredResponse({ ...syntheticRow(), b1: null }), "incomplete");
  assert.equal(classifyStoredResponse({ ...syntheticRow(), b6: 4 }), "incomplete");
});
check("full scoring and all 30 approved narratives intact", () => {
  assert.equal(Object.keys(narratives).length, 15); assert(!("3" in narratives));
  for (const p of Object.values(narratives)) assert(p.strength.length > 60 && p.opportunity.length > 60);
  for (const value of [1, 2, 3, 4, 5]) {
    const scores = computePathwayScores(Object.fromEntries(SURVEY_ITEMS.map(item => [item.code, value])));
    assert.equal(scores.length, 16);
    for (const score of scores) assert.equal(score.score, value);
  }
});
check("mixed-cohort item percentages separated with no blended legacy scores", () => {
  const rows = [...Array.from({ length: 5 }, () => syntheticRow(true, 5)), ...Array.from({ length: 5 }, () => syntheticRow(false, 1))];
  const report = buildCohortReporting(rows);
  assert.equal(report.cohorts[0].pathways[0].items[0].agreementPct, 0);
  assert.equal(report.cohorts[1].pathways[0].items[0].agreementPct, 100);
  assert.equal(report.cohorts[1].pathways.length, 15);
  assert(!report.cohorts[1].pathways.some(p => p.num === 3));
  assert.equal(report.cohorts[1].pathways.flatMap(p => p.items).length, 38);
  assert.equal(report.cohorts[0].pathways.flatMap(p => p.items).length, 63);
  assert.deepEqual(computeWaveAggregate(rows).pathwayAverages, []);
});
check("agreement means 4 or 5, not averaged individual scores", () => {
  const report = buildCohortReporting([1, 2, 3, 4, 5].map(value => syntheticRow(true, value)));
  assert.equal(report.cohorts[1].pathways[0].items[0].agreementPct, 40);
});
check("0/1/4/5 thresholds and complementary cohort suppression", () => {
  for (const n of [0, 1, 4, 5]) {
    const report = buildCohortReporting(Array.from({ length: n }, () => syntheticRow()));
    assert.equal(report.cohorts[1].suppressed, n < 5);
    assert.equal(report.cohorts[1].respondentCount, n < 5 ? null : n);
  }
  const small = buildCohortReporting([syntheticRow(), ...Array.from({ length: 20 }, () => syntheticRow(false))]);
  for (const cohort of small.cohorts) { assert.equal(cohort.respondentCount, null); assert.deepEqual(cohort.pathways, []); }
});
check("demographic primary, complementary and missing-cell privacy", () => {
  assert(safeDistribution(["Male", ...Array(9).fill("Female")]).suppressed);
  assert(safeDistribution([...Array(5).fill("Female"), null]).suppressed);
  assert(!safeDistribution([...Array(5).fill("Female"), ...Array(5).fill("Male")]).suppressed);
});
check("no short/full diagnoses blended in admin debriefing", () => {
  const full = Array.from({ length: 5 }, () => syntheticRow(false, 2));
  const report = buildDebriefingReport({ waveId: "fixture", churchId: "fixture", churchName: "Synthetic", waveLabel: "Synthetic", rows: [...full, ...Array.from({ length: 5 }, () => syntheticRow(true, 5))] });
  assert(report.analysisScope?.includes("full-survey participants only"));
  assert.equal(report.respondentCount, 5);
  for (const goal of report.pathwaysByGoal) for (const pathway of goal.pathways) assert.equal(pathway.churchAverage, 2);
  const hidden = buildDebriefingReport({ waveId: "f", churchId: "f", churchName: "Synthetic", waveLabel: "Synthetic", rows: [syntheticRow()] });
  assert(hidden.analysisSuppressed); assert.deepEqual(hidden.pathwaysByGoal, []);
});
check("full-only aggregate shape unchanged, all sixteen pathways retained", () => {
  const report = computeWaveAggregate(Array.from({ length: 5 }, () => syntheticRow(false)));
  assert.equal(report.cohortReporting, undefined);
  assert.equal(report.pathwayAverages.length, PATHWAYS.length);
  assert.equal(report.pathwayAverages[2].score, 4);
});
console.log(`PASS: ${checks} short-form unit test groups`);
