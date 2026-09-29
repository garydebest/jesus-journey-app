import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { mixedRows, makeSyntheticResponse } from "./syntheticShortForm";
import { buildCohortReporting } from "../shared/cohortReporting";
import { buildDebriefingReport } from "../shared/debriefing/engine";
import { buildDebriefingPresentation } from "../shared/debriefing/presentation";
import { ITEM_CODES } from "../shared/schema";

const dir = path.resolve("qa-output");
mkdirSync(dir, { recursive: true });
for (const [name, rows] of [
  ["mixed", mixedRows],
  ["short-only", Array.from({ length: 15 }, (_, i) => makeSyntheticResponse(true, i))],
  ["small", [makeSyntheticResponse(), ...Array.from({ length: 15 }, (_, i) => makeSyntheticResponse(false, i))]],
] as const) {
  const cohort_report = buildCohortReporting([...rows]);
  const report = buildDebriefingReport({ waveId: name, churchId: "synthetic", churchName: "Review Church (synthetic)", waveLabel: name, rows: [...rows] });
  writeFileSync(path.join(dir, `${name}-aggregate.json`), JSON.stringify(cohort_report, null, 2));
  const payload = {
    church_name: "Review Church (synthetic)", report_date: "September 28, 2026", survey_period: "Synthetic review",
    out_path: path.join(dir, `${name}-church.pdf`), comments_out_path: path.join(dir, `${name}-comments.pdf`),
    cohort_report, rows: rows.map(row => ({
      ...Object.fromEntries(ITEM_CODES.map(code => [code, row[code]])),
      journey_pre: row.journeyPre, journey_post: row.journeyPost,
      comment_text: row.commentText, gender: row.gender,
    })),
  };
  for (const [file, input] of [
    ["generate_report.py", payload],
    ["generate_debriefing_report.py", { out_path: path.join(dir, `${name}-debrief.pdf`), report: { ...report, pairedPresentation: buildDebriefingPresentation(report) } }],
  ] as const) {
    const result = spawnSync("python3", [file], { cwd: path.resolve("server/report-engine"), input: JSON.stringify(input), encoding: "utf8" });
    if (result.status !== 0) throw Error(result.stdout + result.stderr);
    console.log(name, result.stdout.trim().split("\n").pop());
  }
}
