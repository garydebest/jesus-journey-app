import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { resolveModuleDir } from "./paths";
import { ITEM_CODES, type ResponseRow } from "@shared/schema";

// See server/paths.ts for why this can't just be `fileURLToPath(import.meta.url)`
// (breaks once script/build.ts bundles this file to CommonJS for production).
const moduleDir = resolveModuleDir(
  typeof import.meta !== "undefined" ? import.meta.url : undefined,
  typeof __dirname !== "undefined" ? __dirname : undefined,
);

const REPORT_ENGINE_DIR = path.resolve(moduleDir, "report-engine");
const REPORTS_DIR = path.resolve(moduleDir, "..", "generated-reports");

function parseChildren(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // not JSON — fall through to treat as a plain delimited string
  }
  return raw ? [raw] : [];
}

function toReportRow(row: ResponseRow): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const code of ITEM_CODES) {
    const v = (row as any)[code];
    if (typeof v === "number") out[code] = v;
  }
  out.journey_pre = row.journeyPre;
  out.journey_post = row.journeyPost;
  out.spiritual_change = row.spiritualChange;
  out.gender = row.gender;
  out.age_group = row.ageGroup;
  out.relationship_status = row.relationshipStatus;
  out.attendance_frequency = row.attendanceFrequency;
  out.tenure = row.tenure;
  out.small_group_frequency = row.smallGroupFrequency;
  out.volunteer_frequency = row.volunteerFrequency;
  out.children_in_household = parseChildren(row.childrenInHousehold);
  out.race_ethnicity = row.raceEthnicity;
  out.comment_text = row.commentText;
  return out;
}

function formatDate(d: Date): string {
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
}

export interface GenerateReportParams {
  waveId: string;
  churchName: string;
  waveLabel: string;
  waveCreatedAt: Date | string | number;
  rows: ResponseRow[];
}

export interface GenerateReportResult {
  ok: boolean;
  outPath?: string;
  error?: string;
}

/**
 * Invokes the Python "Our Journey with Jesus" report engine as a subprocess.
 * Must be called with the raw response rows BEFORE they are purged from the
 * database, since this is the only remaining opportunity to render the
 * 38-page full church PDF report.
 */
export function generateChurchReportPdf(params: GenerateReportParams): Promise<GenerateReportResult> {
  return new Promise((resolve) => {
    mkdirSync(REPORTS_DIR, { recursive: true });
    const outPath = path.join(REPORTS_DIR, `${params.waveId}.pdf`);

    const opened = new Date(params.waveCreatedAt);
    const now = new Date();
    const payload = {
      church_name: params.churchName,
      report_date: formatDate(now),
      survey_period: `${formatDate(opened)} - ${formatDate(now)}`,
      out_path: outPath,
      rows: params.rows.map(toReportRow),
    };

    const proc = spawn("python3", ["generate_report.py"], {
      cwd: REPORT_ENGINE_DIR,
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d) => (stdout += d.toString()));
    proc.stderr.on("data", (d) => (stderr += d.toString()));

    proc.on("close", (code) => {
      if (code !== 0) {
        resolve({ ok: false, error: stderr || stdout || `Python process exited with code ${code}` });
        return;
      }
      const lastLine = stdout.trim().split("\n").pop() ?? "";
      try {
        const parsed = JSON.parse(lastLine);
        if (parsed.ok) {
          resolve({ ok: true, outPath: parsed.out_path });
        } else {
          resolve({ ok: false, error: parsed.error || "Unknown report generation error" });
        }
      } catch {
        resolve({ ok: false, error: `Could not parse report generator output: ${stdout} ${stderr}` });
      }
    });

    proc.on("error", (err) => {
      resolve({ ok: false, error: String(err) });
    });

    proc.stdin.write(JSON.stringify(payload));
    proc.stdin.end();
  });
}
