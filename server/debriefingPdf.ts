import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import path from "node:path";
import { resolveModuleDir } from "./paths";
import { persistReportPdf } from "./reportStorage";
import type { DebriefingReport } from "@shared/debriefing/types";
import { buildDebriefingPresentation, DEBRIEFING_LAYOUT_VERSION } from "@shared/debriefing/presentation";

const moduleDir = resolveModuleDir(
  typeof import.meta !== "undefined" ? import.meta.url : undefined,
  typeof __dirname !== "undefined" ? __dirname : undefined,
);
const REPORT_ENGINE_DIR = path.resolve(moduleDir, "report-engine");
export interface GenerateDebriefingPdfResult { ok: boolean; storageKey?: string; error?: string }

async function renderLocal(report: DebriefingReport): Promise<{ directory: string; outPath: string }> {
  const directory = await mkdtemp(path.join(tmpdir(), "jj-debrief-"));
  const outPath = path.join(directory, "debrief.pdf");
  try {
    const payload = { out_path: outPath, report: { ...report, pairedPresentation: buildDebriefingPresentation(report) } };
    await new Promise<void>((resolve, reject) => {
      const proc = spawn("python3", ["generate_debriefing_report.py"], {
        cwd: REPORT_ENGINE_DIR, stdio: ["pipe", "pipe", "pipe"],
      });
      let stdout = "", stderr = "";
      const timeout = setTimeout(() => { proc.kill("SIGKILL"); reject(new Error("Debriefing PDF generation timed out")); }, 90_000);
      proc.stdout.on("data", d => { stdout = (stdout + d.toString()).slice(-100_000); });
      proc.stderr.on("data", d => { stderr = (stderr + d.toString()).slice(-100_000); });
      proc.once("error", error => { clearTimeout(timeout); reject(error); });
      proc.once("close", code => {
        clearTimeout(timeout);
        if (code !== 0) return reject(new Error(stderr || stdout || `Renderer exited ${code}`));
        try {
          const result = JSON.parse(stdout.trim().split("\n").pop() ?? "");
          if (!result.ok) throw new Error(result.error || "Debriefing PDF generation failed");
          resolve();
        } catch (error) { reject(error); }
      });
      proc.stdin.on("error", error => { clearTimeout(timeout); proc.kill("SIGKILL"); reject(error); });
      proc.stdin.end(JSON.stringify(payload));
    });
    return { directory, outPath };
  } catch (error) {
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
}

// Re-render archived aggregate JSON without overwriting the archived object
// or revisiting raw responses. Bound the cache and coalesce duplicate clicks.
const cache = new Map<string, Buffer>();
const pending = new Map<string, Promise<Buffer>>();
let rendering: Promise<unknown> = Promise.resolve();
export async function renderDebriefingPdfBuffer(report: DebriefingReport): Promise<Buffer> {
  const key = createHash("sha256").update(DEBRIEFING_LAYOUT_VERSION).update(JSON.stringify(report)).digest("hex");
  const hit = cache.get(key);
  if (hit) return hit;
  const current = pending.get(key);
  if (current) return current;
  if (pending.size >= 8) throw new Error("Several debriefing downloads are being prepared. Please try again shortly.");
  const job = rendering.catch(() => {}).then(async () => {
    const { directory, outPath } = await renderLocal(report);
    try {
      const buffer = await readFile(outPath);
      if (buffer.subarray(0, 5).toString() !== "%PDF-") throw new Error("Renderer did not return a PDF");
      if (buffer.length <= 8 * 1024 * 1024) {
        while (cache.size >= 4) cache.delete(cache.keys().next().value!);
        cache.set(key, buffer);
      }
      return buffer;
    } finally { await rm(directory, { recursive: true, force: true }); }
  });
  rendering = job;
  pending.set(key, job);
  try { return await job; } finally { pending.delete(key); }
}

/** Closing still requires upload + byte-for-byte verification before raw-data deletion. */
export async function generateDebriefingReportPdf(waveId: string, report: DebriefingReport): Promise<GenerateDebriefingPdfResult> {
  let directory: string | undefined;
  try {
    const local = await renderLocal(report);
    directory = local.directory;
    const uploaded = await persistReportPdf(waveId, local.outPath, `${waveId}-debrief.pdf`);
    if (!uploaded.ok) return { ok: false, error: uploaded.error };
    return { ok: true, storageKey: uploaded.storageKey };
  } catch (error) {
    return { ok: false, error: `Debriefing generation or storage failed: ${String(error)}` };
  } finally {
    if (directory) await rm(directory, { recursive: true, force: true });
  }
}
