import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import path from "node:path";
import { resolveModuleDir } from "./paths";

const moduleDir = resolveModuleDir(
  typeof import.meta !== "undefined" ? import.meta.url : undefined,
  typeof __dirname !== "undefined" ? __dirname : undefined,
);
const cache = new Map<string, Buffer>();
const pending = new Map<string, Promise<Buffer>>();

/** Read-time presentation update. Never uploads, mutates storage, or uses raw rows. */
export async function projectChurchPdf(buffer: Buffer): Promise<Buffer> {
  const key = createHash("sha256").update(buffer).digest("hex");
  if (cache.has(key)) return cache.get(key)!;
  if (pending.has(key)) return pending.get(key)!;
  if (pending.size >= 4) throw new Error("Report downloads are busy. Please try again shortly.");
  const job = new Promise<Buffer>((resolve, reject) => {
    const proc = spawn("python3", ["project_church_pdf.py"], {
      cwd: path.resolve(moduleDir, "report-engine"), stdio: ["pipe", "pipe", "pipe"],
    });
    const chunks: Buffer[] = [];
    let stderr = "", size = 0;
    const timer = setTimeout(() => { proc.kill("SIGKILL"); reject(new Error("Report preparation timed out")); }, 90_000);
    proc.stdout.on("data", d => {
      size += d.length;
      if (size > 32 * 1024 * 1024) { proc.kill("SIGKILL"); reject(new Error("Report exceeds download limit")); }
      else chunks.push(d);
    });
    proc.stderr.on("data", d => { stderr = (stderr + d.toString()).slice(-4000); });
    proc.once("error", e => { clearTimeout(timer); reject(e); });
    proc.stdin.on("error", e => { clearTimeout(timer); proc.kill("SIGKILL"); reject(e); });
    proc.once("close", code => {
      clearTimeout(timer);
      if (code !== 0) return reject(new Error(`Report preparation failed: ${stderr}`));
      const output = Buffer.concat(chunks);
      if (output.subarray(0, 5).toString() !== "%PDF-") return reject(new Error("Invalid prepared report"));
      if (output.length < 8 * 1024 * 1024) {
        while (cache.size >= 4) cache.delete(cache.keys().next().value!);
        cache.set(key, output);
      }
      resolve(output);
    });
    proc.stdin.end(buffer);
  });
  pending.set(key, job);
  try { return await job; } finally { pending.delete(key); }
}
