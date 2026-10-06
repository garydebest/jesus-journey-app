import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { resolveModuleDir } from "./paths";
import { fetchReportPdf, persistReportPdf } from "./reportStorage";

// Comments Wordcloud: a companion PDF derived from the saved, privacy-screened
// Comments Report. It is built on first request and cached in report storage,
// so it works for every closed survey (including those whose raw responses
// were purged) without touching the survey-close transaction or the database.
// Bump the version when the theme rules change so cached clouds regenerate.
export const WORDCLOUD_ENGINE_VERSION = "v1";

const moduleDir = resolveModuleDir(
  typeof import.meta !== "undefined" ? import.meta.url : undefined,
  typeof __dirname !== "undefined" ? __dirname : undefined,
);
const REPORT_ENGINE_DIR = path.resolve(moduleDir, "report-engine");

export function wordcloudStorageKey(waveId: string): string {
  return `${waveId}-wordcloud-${WORDCLOUD_ENGINE_VERSION}.pdf`;
}

/** Renders the wordcloud PDF from Comments Report bytes. */
export async function renderWordcloudFromCommentsPdf(commentsPdf: Buffer): Promise<{ pdf: Buffer; localPath: string; dir: string }> {
  const dir = await mkdtemp(path.join(tmpdir(), "jj-wordcloud-"));
  const source = path.join(dir, "comments.pdf");
  const out = path.join(dir, "wordcloud.pdf");
  await writeFile(source, commentsPdf);
  await new Promise<void>((resolve, reject) => {
    const proc = spawn("python3", ["generate_wordcloud.py"], { cwd: REPORT_ENGINE_DIR, stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d) => (stdout += d.toString()));
    proc.stderr.on("data", (d) => (stderr += d.toString()));
    proc.on("error", reject);
    proc.on("close", (code) => {
      const last = stdout.trim().split("\n").pop() ?? "";
      try {
        const parsed = JSON.parse(last);
        if (code === 0 && parsed.ok) return resolve();
        reject(new Error(parsed.error || `Wordcloud renderer exited with code ${code}`));
      } catch {
        reject(new Error(stderr || stdout || `Wordcloud renderer exited with code ${code}`));
      }
    });
    proc.stdin.write(JSON.stringify({ comments_pdf_path: source, out_path: out }));
    proc.stdin.end();
  });
  const pdf = await readFile(out);
  if (pdf.subarray(0, 5).toString() !== "%PDF-") throw new Error("Wordcloud renderer did not produce a PDF");
  return { pdf, localPath: out, dir };
}

const inFlight = new Map<string, Promise<Buffer | null>>();

/**
 * Returns the wave's Comments Wordcloud PDF, building and caching it from the
 * stored Comments Report when needed. Null when no Comments Report exists.
 */
export function getWordcloudPdf(waveId: string, commentsStorageKey: string): Promise<Buffer | null> {
  const existing = inFlight.get(waveId);
  if (existing) return existing;
  const job = (async () => {
    const key = wordcloudStorageKey(waveId);
    const cached = await fetchReportPdf(key);
    if (cached && cached.subarray(0, 5).toString() === "%PDF-") return cached;
    const comments = await fetchReportPdf(commentsStorageKey);
    if (!comments) return null;
    const { pdf, localPath, dir } = await renderWordcloudFromCommentsPdf(comments);
    try {
      // Caching is best effort: a storage failure still serves the fresh PDF.
      const saved = await persistReportPdf(waveId, localPath, key);
      if (!saved.ok) console.error("Comments wordcloud generated but not cached for wave", waveId, saved.error);
    } finally {
      await rm(dir, { recursive: true, force: true }).catch(() => {});
    }
    return pdf;
  })().finally(() => inFlight.delete(waveId));
  inFlight.set(waveId, job);
  return job;
}
