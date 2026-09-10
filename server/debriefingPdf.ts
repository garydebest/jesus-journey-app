import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { resolveModuleDir } from "./paths";
import { persistReportPdf } from "./reportStorage";
import type { DebriefingReport } from "@shared/debriefing/types";

// See server/paths.ts for why this can't just be `fileURLToPath(import.meta.url)`
// (breaks once script/build.ts bundles this file to CommonJS for production).
const moduleDir = resolveModuleDir(
  typeof import.meta !== "undefined" ? import.meta.url : undefined,
  typeof __dirname !== "undefined" ? __dirname : undefined,
);

const REPORT_ENGINE_DIR = path.resolve(moduleDir, "report-engine");
const REPORTS_DIR = path.resolve(moduleDir, "..", "generated-reports");

export interface GenerateDebriefingPdfResult {
  ok: boolean;
  /** Durable Supabase Storage object key (e.g. "<waveId>-debrief.pdf"), set only when persistence succeeded. */
  storageKey?: string;
  error?: string;
}

/**
 * Invokes the Python debriefing report renderer as a subprocess, then
 * uploads the resulting PDF to Supabase Storage (same "church-reports"
 * bucket used by the client-facing report pipeline, per the build spec's
 * "reuse the existing PDF pipeline" requirement). The report JSON passed in
 * is already fully computed by shared/debriefing/engine.ts — this function
 * only renders and persists it.
 */
export function generateDebriefingReportPdf(
  waveId: string,
  report: DebriefingReport,
): Promise<GenerateDebriefingPdfResult> {
  return new Promise((resolve) => {
    mkdirSync(REPORTS_DIR, { recursive: true });
    const outPath = path.join(REPORTS_DIR, `${waveId}-debrief.pdf`);

    const payload = { out_path: outPath, report };

    const proc = spawn("python3", ["generate_debriefing_report.py"], {
      cwd: REPORT_ENGINE_DIR,
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d) => (stdout += d.toString()));
    proc.stderr.on("data", (d) => (stderr += d.toString()));

    proc.on("close", async (code) => {
      if (code !== 0) {
        resolve({ ok: false, error: stderr || stdout || `Python process exited with code ${code}` });
        return;
      }
      const lastLine = stdout.trim().split("\n").pop() ?? "";
      try {
        const parsed = JSON.parse(lastLine);
        if (!parsed.ok) {
          resolve({ ok: false, error: parsed.error || "Unknown debriefing report generation error" });
          return;
        }
        const uploaded = await persistReportPdf(waveId, parsed.out_path, `${waveId}-debrief.pdf`);
        if (!uploaded.ok) {
          console.error("Debriefing report PDF generated but failed to persist to storage for wave", waveId, uploaded.error);
          resolve({ ok: false, error: uploaded.error });
          return;
        }
        resolve({ ok: true, storageKey: uploaded.storageKey });
      } catch {
        resolve({ ok: false, error: `Could not parse debriefing report generator output: ${stdout} ${stderr}` });
      }
    });

    proc.on("error", (err) => {
      resolve({ ok: false, error: String(err) });
    });

    proc.stdin.write(JSON.stringify(payload));
    proc.stdin.end();
  });
}
