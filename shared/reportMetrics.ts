import { PATHWAYS } from "./pathways";
import { DEMOGRAPHICS } from "./questions";
import type { ResponseRow } from "./schema";
import { safeDemographicCounts } from "./demographicPolicy";

const rounded = (v: number) => Math.round(v * 10) / 10;
export function agreementMetrics(rows: ResponseRow[]) {
  const pathways = PATHWAYS.map(pathway => {
    const percentages = pathway.items.map(code => {
      const answers = rows.map(row => row[code.toLowerCase() as keyof ResponseRow])
        .filter((v): v is number => typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 5);
      return answers.length ? 100 * answers.filter(v => v >= 4).length / answers.length : null;
    });
    const valid = percentages.filter((v): v is number => v !== null);
    // Match the Python church-report convention: pathway % rounded to 1 decimal.
    const pct = valid.length === percentages.length ? rounded(valid.reduce((a, b) => a + b, 0) / valid.length) : null;
    return { num: pathway.num, name: pathway.name, goal: pathway.goal, pct };
  });
  const goals: Record<string, number | null> = Object.fromEntries(Array.from(new Set(PATHWAYS.map(p => p.goal))).map(goal => {
    const values = pathways.filter(p => p.goal === goal).map(p => p.pct);
    return [goal, values.every((v): v is number => v !== null) ? rounded(values.reduce((a, b) => a + b, 0) / values.length) : null];
  }));
  return { pathways, goals };
}

export const CHILD_BANDS = DEMOGRAPHICS.find(d => d.id === "children")!.options;
export function parseChildren(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  let values: unknown;
  try { values = JSON.parse(raw); } catch { values = raw.split(/[|,]/).map(v => v.trim()); }
  return Array.from(new Set((Array.isArray(values) ? values : []).filter((v): v is string => typeof v === "string" && CHILD_BANDS.includes(v))));
}
export function childrenProfile(rows: ResponseRow[]) {
  const answers = rows.map(row => parseChildren(row.childrenInHousehold));
  const counts = Object.fromEntries(CHILD_BANDS.map(label => [label, answers.filter(values => values.includes(label)).length]));
  const safe = safeDemographicCounts(counts, rows.length, true);
  return {
    denominator: rows.length,
    // Do not expose exact missing counts, which can reveal a suppressed complement.
    missing: 0,
    values: Object.keys(safe).map(label => {
      const count = safe[label];
      return { label, count, pct: rows.length ? rounded(100 * count / rows.length) : 0 };
    }),
  };
}

export function reflectionProfile(rows: ResponseRow[]) {
  const valid = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 5;
  const pairs = rows.filter(row => valid(row.journeyPre) && valid(row.journeyPost));
  const counts = [
    pairs.filter(r => r.journeyPost! > r.journeyPre!).length,
    pairs.filter(r => r.journeyPost === r.journeyPre).length,
    pairs.filter(r => r.journeyPost! < r.journeyPre!).length,
  ];
  // Conservative existing five-person protection for this new display only.
  // Do not change thresholds for existing report sections in this release.
  const missing = rows.length - pairs.length;
  if (pairs.length < 5 || counts.some(n => n > 0 && n < 5) || (missing > 0 && missing < 5)) {
    return { suppressed: true, values: [] };
  }
  return { suppressed: false, values: counts.map((count, i) => ({
    label: ["Selected a later stage", "Selected the same stage", "Selected an earlier stage"][i],
    pct: rounded(100 * count / pairs.length),
  })) };
}
