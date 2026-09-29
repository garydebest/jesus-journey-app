import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { computeWaveAggregate } from "../shared/aggregate";
import { buildCohortReporting } from "../shared/cohortReporting";
import { questionScale } from "../shared/questions";
import { SURVEY_ITEMS } from "../shared/surveyItems";
import { surveyItemsFor, SHORT_FORM_CODES } from "../shared/shortForm";
import { agreementMetrics, childrenProfile, reflectionProfile } from "../shared/reportMetrics";
import { makeSyntheticResponse, mixedRows } from "./syntheticShortForm";
import { FULL_DOCS } from "../client/src/lib/reportGuidance";

let checks = 0;
function check(name: string, run: () => void) { run(); checks++; console.log(`PASS ${name}`); }
check("all 63 prompts use instrument code, not numbering", () => {
  SURVEY_ITEMS.forEach((item, index) => {
    const scale = questionScale(item.code);
    assert.equal(scale.kind, index < 18 ? "belief" : "practice");
    assert.equal(scale.labels[0].label.includes("believe"), index < 18);
    assert.equal(scale.labels[4].label.includes("believe"), index < 18);
  });
});
check("38-item branch preserved and practice labels correct", () => {
  assert.equal(surveyItemsFor(1).length, 38);
  assert.equal(surveyItemsFor(2).length, 38);
  assert.equal(surveyItemsFor(3).length, 63);
  assert.equal(SHORT_FORM_CODES.length, 38);
  surveyItemsFor(1).filter(item => !/^[BK]/.test(item.code)).forEach(item =>
    assert.equal(questionScale(item.code).labels[4].label, "Always true"));
});
const rows = Array.from({ length: 60 }, (_, i) => {
  const row = makeSyntheticResponse(false, i);
  row.journeyPost = 1 + i % 5;
  row.journeyPre = 1 + (i + (i % 3 === 0 ? 1 : 0)) % 5;
  row.childrenInHousehold = JSON.stringify(i < 20 ? ["None"] : i < 40
    ? ["0-2 year old(s)", "3-5 year old(s)"] : ["6-10 year old(s)", "11-18 year old(s)"]);
  return row;
});
check("children denominator is people and duplicates count once", () => {
  const profile = childrenProfile(rows);
  assert.equal(profile.denominator, 60);
  assert.equal(profile.values.reduce((n, v) => n + v.count, 0), 100);
  const row = { ...rows[0], childrenInHousehold: '["0-2 year old(s)","0-2 year old(s)"]' };
  assert.equal(childrenProfile([row]).values[1].count, 1);
  assert.equal(childrenProfile([{ ...row, childrenInHousehold: "" }]).missing, 1);
});
check("percent agreement differs from 1–5 mean", () => {
  const inputs = Array.from({ length: 10 }, (_, i) => {
    const row = makeSyntheticResponse(false, i);
    SURVEY_ITEMS.forEach(item => { (row as any)[item.code.toLowerCase()] = i < 3 ? 4 : 3; });
    return row;
  });
  const metrics = agreementMetrics(inputs);
  metrics.pathways.forEach(p => assert.equal(p.pct, 30));
  Object.values(metrics.goals).forEach(v => assert.equal(v, 30));
  const aggregate = computeWaveAggregate(inputs);
  assert.equal(aggregate.pathwayAverages[0].score, 3.3); // legacy contract preserved
  assert.equal(aggregate.agreement!.pathways[0].pct, 30);
});
check("zero vs no measurements", () => {
  assert(agreementMetrics([]).pathways.every(p => p.pct === null));
  const row = makeSyntheticResponse(false);
  SURVEY_ITEMS.forEach(item => { (row as any)[item.code.toLowerCase()] = 1; });
  assert(agreementMetrics([row]).pathways.every(p => p.pct === 0));
});
check("reflection protects small counts and is not growth", () => {
  const pairs = Array.from({ length: 20 }, (_, i) => ({ ...rows[i], journeyPre: 3, journeyPost: i < 5 ? 4 : i < 15 ? 3 : 2 }));
  assert.deepEqual(reflectionProfile(pairs).values.map(v => v.pct), [25, 50, 25]);
  pairs[0].journeyPost = 3;
  assert(reflectionProfile(pairs).suppressed);
});
check("mixed layout and cohort calculations remain separate", () => {
  const result = computeWaveAggregate(mixedRows);
  assert(result.cohortReporting);
  assert.equal(result.agreement, undefined);
  assert.deepEqual(result.pathwayAverages, []);
  assert.equal(result.cohortReporting.cohorts[0].respondentCount, 30);
  assert.equal(result.cohortReporting.cohorts[1].respondentCount, 15);
});
check("mixed children uses age bands, not combinations; privacy unchanged", () => {
  const mixed = mixedRows.map((r, i) => ({ ...r, childrenInHousehold: JSON.stringify(i < 15 ? ["None"] : ["0-2 year old(s)", "3-5 year old(s)"]) }));
  const profile = buildCohortReporting(mixed).profiles["Children in household"];
  assert(!profile.suppressed);
  assert.equal(profile.values[1].count, 30);
  assert(profile.values.reduce((n, v) => n + v.pct, 0) > 100);
  mixed[0].childrenInHousehold = '["19 or older"]';
  assert(buildCohortReporting(mixed).profiles["Children in household"].suppressed);
  assert(buildCohortReporting([mixedRows[0], ...rows]).cohorts.every(c => c.suppressed));
});
check("paper instructions cover actual workflow and privacy", () => {
  for (const text of ["join code", "38 statements", "five characters", "envelope", "optional", "Do not resubmit", "volunteer"]) {
    assert(FULL_DOCS[6].html.includes(text), text);
  }
  assert(FULL_DOCS[7].html.includes("second self-assessment"));
});
mkdirSync("qa-output", { recursive: true });
writeFileSync("qa-output/dennis-summary.json", JSON.stringify(computeWaveAggregate(rows), null, 2));
writeFileSync("qa-output/dennis-rows.json", JSON.stringify(rows, null, 2));
writeFileSync("qa-output/dennis-mixed.json", JSON.stringify(buildCohortReporting(mixedRows), null, 2));
console.log(`${checks} focused TypeScript groups passed`);
