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

const moduleDir = resolveModuleDir(
  typeof import.meta !== "undefined" ? import.meta.url : undefined,
  typeof __dirname !== "undefined" ? __dirname : undefined,
);
const REPORT_ENGINE_DIR = path.resolve(moduleDir, "report-engine");

export interface SurveyReviewParams { waveId: string; churchName: string; rows: ResponseRow[]; leadersComparison?: boolean }
export interface SurveyReviewResult {
  ok: boolean;
  surveyReviewKey?: string;
  facilitatorKey?: string;
  summaryJson?: string; // aggregate selection only; no respondent-level data
  error?: string;
}

export const SURVEY_REVIEW_FILENAME = "Survey-Review.pdf";
export const FACILITATOR_FILENAME = "Facilitators-Report.pdf";
export const LEADERS_REVIEW_FILENAME = "Core-Leaders-Review.pdf";
export const LEADERS_FACILITATOR_FILENAME = "Core-Leaders-Facilitators-Report.pdf";

/** Runs one of the Survey Review renderers and saves its two PDFs under the given storage names. */
async function renderPair(script: string, payload: Record<string, unknown>, waveId: string, rows: ResponseRow[],
  names: { church: string; facilitator: string }, churchName: string): Promise<SurveyReviewResult> {
  const directory = await mkdtemp(path.join(tmpdir(), "jj-review-"));
  const churchOut = path.join(directory, "church.pdf");
  const facilitatorOut = path.join(directory, "facilitator.pdf");
  try {
    const summary = await new Promise<unknown>((resolve, reject) => {
      const proc = spawn("python3", [script], { cwd: REPORT_ENGINE_DIR, stdio: ["pipe", "pipe", "pipe"] });
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
      proc.stdin.end(JSON.stringify({ church_name: churchName, rows: rows.map(toReportRow), church_out: churchOut, facilitator_out: facilitatorOut, ...payload }));
    });
    const review = await persistReportPdf(waveId, churchOut, names.church);
    if (!review.ok) return { ok: false, error: review.error };
    const facilitator = await persistReportPdf(waveId, facilitatorOut, names.facilitator);
    if (!facilitator.ok) return { ok: false, error: facilitator.error };
    return { ok: true, surveyReviewKey: review.storageKey, facilitatorKey: facilitator.storageKey, summaryJson: JSON.stringify(summary) };
  } catch (error: any) {
    return { ok: false, error: String(error?.message ?? error) };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

export async function generateSurveyReviewPdfs({ waveId, churchName, rows, leadersComparison }: SurveyReviewParams): Promise<SurveyReviewResult> {
  return renderPair("generate_survey_review.py", {
    // Every church receives the 38-page full report, so page references always apply.
    full_report_layout: true,
    leaders_comparison: leadersComparison === true,
  }, waveId, rows, { church: `${waveId}-survey-review.pdf`, facilitator: `${waveId}-facilitator.pdf` }, churchName);
}

/**
 * Core Leaders Review: the leader-code responses of a survey that is still
 * open. Nothing is closed or deleted; regenerating overwrites the same files.
 */
export async function generateLeadersReviewPdfs({ waveId, churchName, rows }: SurveyReviewParams): Promise<SurveyReviewResult> {
  return renderPair("generate_leaders_review.py", {}, waveId, rows,
    { church: `${waveId}-leaders-review.pdf`, facilitator: `${waveId}-leaders-facilitator.pdf` }, churchName);
}
