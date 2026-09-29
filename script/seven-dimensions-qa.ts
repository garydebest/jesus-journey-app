import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { buildDebriefingReport } from "../shared/debriefing/engine";
import { generateGraceFellowshipSample } from "../shared/debriefing/testSyntheticData";
import { buildDebriefingPresentation } from "../shared/debriefing/presentation";
import { projectReportForDisplay } from "../shared/debriefing/reportProjection";
import { renderDebriefingPdfBuffer } from "../server/debriefingPdf";
import { projectChurchPdf } from "../server/churchPdfProjection";
import { mixedRows, makeSyntheticResponse } from "./syntheticShortForm";
import type { ResponseRow } from "../shared/schema";

mkdirSync("qa-output", { recursive: true });
const legacy = JSON.parse(readFileSync("script/fixtures/legacy-dimensions.json", "utf8"));
const original = JSON.stringify(legacy);
const projected = projectReportForDisplay(legacy);
const forbidden = /\bdimensions?\b|relationships\s*(?:&|and)\s*growth|stated belief runs ahead|practice keeps pace with/i;
assert(!forbidden.test(JSON.stringify(projected)));
assert(!("dimensions" in projected));
assert.equal(JSON.stringify(legacy), original);
assert.deepEqual(projectReportForDisplay(projected), projected);
assert.deepEqual(projected.pathwaysByGoal, legacy.pathwaysByGoal);
assert(projected.demographics.every(d => d.breakdown.every(r => r.n >= 10)));
assert.equal(projected.pathwaysByGoal.length, 4);
assert.equal(projected.pathwaysByGoal.flatMap(g => g.pathways).length, 16);
for (const input of [legacy, projected, { ...legacy, dimensions: null }, { ...legacy, dimensions: {} }]) {
  const model = buildDebriefingPresentation(input);
  assert(!forbidden.test(JSON.stringify(model)));
  assert.equal(model.sections.filter(s => s.id.startsWith("goal-")).flatMap(s => s.tables[0].rows).length, 16);
}
console.log("PASS: legacy projection, immutability, idempotence, absent/null/empty legacy fields, 4 goals / 16 pathways preserved");

const params = { waveId: "synthetic", churchId: "synthetic", churchName: "Grace Fellowship (synthetic)", waveLabel: "Report review", rows: generateGraceFellowshipSample() as ResponseRow[] };
const current = buildDebriefingReport(params);
if (existsSync("shared/debriefing/engine.baseline.ts")) {
  const baselineModule = "../shared/debriefing/engine.baseline";
  const { buildDebriefingReport: baseline } = await import(baselineModule);
  const before = baseline(params);
  for (const key of ["pathwaysByGoal", "demographics", "demographicAssessment", "maturityAndChange", "maturityStageAssessment", "bottleneckMap", "engagement"] as const) {
    assert.deepEqual(current[key], before[key], `${key} must remain unchanged`);
  }
  console.log("PASS: current goal/pathway scores, trajectories, demographics, maturity, engagement and bottlenecks match production baseline");
}
for (const rows of [params.rows, mixedRows, Array.from({ length: 15 }, (_, i) => makeSyntheticResponse(true, i)), [makeSyntheticResponse()]]) {
  const report = buildDebriefingReport({ ...params, rows: [...rows] });
  assert(!("dimensions" in report));
  assert(!forbidden.test(JSON.stringify(report)));
}
console.log("PASS: new full, mixed, short-only and privacy-suppressed reports omit legacy analysis");
current.generatedAt = "2026-09-29T05:00:00.000Z";
writeFileSync("qa-output/regional-sample-fixture.json", JSON.stringify(current, null, 2) + "\n");
writeFileSync("qa-output/current-report.json", JSON.stringify(current));
writeFileSync("qa-output/saved-report.json", JSON.stringify(projected));
writeFileSync("qa-output/saved-projection.json", JSON.stringify(projected, null, 2) + "\n");
for (const [name, report] of [["current", current], ["saved", legacy]] as const) {
  writeFileSync(`qa-output/${name}-debrief.pdf`, await renderDebriefingPdfBuffer(report));
  const result = spawnSync("python3", ["generate_debriefing_report.py"], {
    cwd: "server/report-engine", encoding: "utf8",
    input: JSON.stringify({ out_path: `../../qa-output/${name}-standalone.pdf`, report }),
  });
  assert.equal(result.status, 0, result.stdout + result.stderr);
}
const archived = readFileSync("script/fixtures/legacy-church-report.pdf");
const clean = await projectChurchPdf(archived);
writeFileSync("qa-output/saved-church.pdf", clean);
assert.deepEqual(await projectChurchPdf(clean), clean, "already-clean PDF must be byte-identical");
assert.deepEqual(readFileSync("script/fixtures/legacy-church-report.pdf"), archived);
console.log("PASS: saved/current paired and standalone PDFs; old church download projection; archive immutable; clean PDF no-op");
