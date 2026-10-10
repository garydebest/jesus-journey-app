// ---------------------------------------------------------------------------
// Survey Review (church-facing) and Facilitator's Report (admin-only).
// Rendered once from raw response rows during survey close, uploaded and
// verified like the other reports, then served from storage. Raw rows are
// deleted at close, so these PDFs are never regenerated later.
// ---------------------------------------------------------------------------
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { resolveModuleDir } from "./paths";
import { persistReportPdf } from "./reportStorage";
import { toReportRow } from "./pdfReport";
import type { ResponseRow } from "@shared/schema";
import { needsCohortReporting } from "@shared/cohortReporting";

const moduleDir = resolveModuleDir(
  typeof import.meta !== "undefined" ? import.meta.url : undefined,
  typeof __dirname !== "undefined" ? __dirname : undefined,
);
const REPORT_ENGINE_DIR = path.resolve(moduleDir, "report-engine");

export interface SurveyReviewParams { waveId: string; churchName: string; rows: ResponseRow[] }
export interface SurveyReviewResult {
  ok: boolean;
  surveyReviewKey?: string;
  facilitatorKey?: string;
  summaryJson?: string; // aggregate selection only; no respondent-level data
  error?: string;
}

export const SURVEY_REVIEW_FILENAME = "Survey-Review.pdf";
export const FACILITATOR_FILENAME = "Facilitators-Report.pdf";

export async function generateSurveyReviewPdfs({ waveId, churchName, rows }: SurveyReviewParams): Promise<SurveyReviewResult> {
  const directory = await mkdtemp(path.join(tmpdir(), "jj-review-"));
  const churchOut = path.join(directory, "survey-review.pdf");
  const facilitatorOut = path.join(directory, "facilitator.pdf");
  try {
    const summary = await new Promise<unknown>((resolve, reject) => {
      const proc = spawn("python3", ["generate_survey_review.py"], { cwd: REPORT_ENGINE_DIR, stdio: ["pipe", "pipe", "pipe"] });
      let stdout = "", stderr = "";
      const timeout = setTimeout(() => { proc.kill("SIGKILL"); reject(new Error("Survey Review generation timed out")); }, 120_000);
      proc.stdout.on("data", d => { stdout = (stdout + d.toString()).slice(-2_000_000); });
      proc.stderr.on("data", d => { stderr = (stderr + d.toString()).slice(-100_000); });
      proc.once("error", error => { clearTimeout(timeout); reject(error); });
      proc.once("close", code => {
        clearTimeout(timeout);
        try {
          const result = JSON.parse(stdout.trim().split("\n").pop() ?? "");
          if (code !== 0 || !result.ok) throw new Error(result.error || stderr || `Renderer exited ${code}`);
          resolve(result.summary);
        } catch (error) { reject(error instanceof Error ? error : new Error(String(error))); }
      });
      proc.stdin.on("error", error => { clearTimeout(timeout); proc.kill("SIGKILL"); reject(error); });
      proc.stdin.end(JSON.stringify({ church_name: churchName, rows: rows.map(toReportRow), church_out: churchOut, facilitator_out: facilitatorOut,
        // Page references point into the 38-page full report, which is produced only when every response is a full survey.
        full_report_layout: !needsCohortReporting(rows) }));
    });
    const review = await persistReportPdf(waveId, churchOut, `${waveId}-survey-review.pdf`);
    if (!review.ok) return { ok: false, error: review.error };
    const facilitator = await persistReportPdf(waveId, facilitatorOut, `${waveId}-facilitator.pdf`);
    if (!facilitator.ok) return { ok: false, error: facilitator.error };
    return { ok: true, surveyReviewKey: review.storageKey, facilitatorKey: facilitator.storageKey, summaryJson: JSON.stringify(summary) };
  } catch (error: any) {
    return { ok: false, error: String(error?.message ?? error) };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
