import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { buildDebriefingPresentation } from "../shared/debriefing/presentation";
import { buildDemographicAssessment, buildMaturityStageAssessment } from "../shared/debriefing/systematicAssessment";
import { renderDebriefingPdfBuffer } from "../server/debriefingPdf";
const report = JSON.parse(await readFile("server/report-engine/debriefing/sample_fixture.json", "utf8"));
const original = JSON.stringify(report);
const model = buildDebriefingPresentation(report);
assert.equal(JSON.stringify(report), original, "Presentation must not alter saved analysis");
assert.equal(model.sections.filter(s => s.id.startsWith("goal-")).flatMap(s => s.tables[0].rows).length, 16);
assert.equal(model.sections.find(s => s.id === "dimensions")!.tables[0].rows.length, 7);
assert(!JSON.stringify(model).includes("suggestedDebriefQuestions"));
assert(!JSON.stringify(model).includes("points above the church average"));
assert(model.sections.some(s => s.topics.some(t => t.strengths.length && t.opportunities.length)));
for (const d of report.demographics) {
  assert.equal(model.sections.find(s => s.id === `evidence-${d.id}`)!.tables[0].rows.length, d.breakdown.length);
}
const [a, b] = await Promise.all([renderDebriefingPdfBuffer(report), renderDebriefingPdfBuffer(report)]);
assert.equal(a, b, "Concurrent downloads must share one rendering");
assert.equal(a.subarray(0, 5).toString(), "%PDF-");
await writeFile("/tmp/grace-paired-production.pdf", a);
report.demographicAssessment = buildDemographicAssessment(report.demographics);
report.maturityStageAssessment = buildMaturityStageAssessment(report.maturityAndChange.changeByMaturity);
await writeFile("/tmp/grace-paired-current.pdf", await renderDebriefingPdfBuffer(report));
const long = structuredClone(report);
long.executiveSummary.strengths[0].detail = "Long finding with <escaped> & safe text. ".repeat(150);
await writeFile("/tmp/grace-paired-long.pdf", await renderDebriefingPdfBuffer(long));
console.log("PASS: legacy/current reports, 16 pathways, 7 dimensions, demographic tables, immutable analysis, paired topics, omitted questions, concurrent downloads, long escaped content.");
