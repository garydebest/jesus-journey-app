import { computePathwayScores, computeGoalScores, type ItemResponses } from "./scoring";
import { ITEM_CODES, type ResponseRow } from "./schema";
import { MATURITY_LABELS } from "./questions";

export interface WaveAggregateSummary {
  respondentCount: number;
  generatedAt: string;
  pathwayAverages: { num: number; name: string; goal: string; score: number; band: "high" | "medium" | "low" }[];
  goalAverages: Record<string, number>;
  maturityDistribution: { level: number; label: string; count: number; pct: number }[];
  averageMaturity: number;
  demographics: {
    gender: Record<string, number>;
    ageGroup: Record<string, number>;
    attendanceFrequency: Record<string, number>;
    tenure: Record<string, number>;
  };
}

function tally(values: (string | null | undefined)[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const v of values) {
    if (!v) continue;
    out[v] = (out[v] ?? 0) + 1;
  }
  return out;
}

/**
 * Computes the durable aggregate summary for a wave from its raw responses.
 * Called once at wave-close time, before raw rows are purged. The output is
 * stored forever in aggregate_snapshots; the raw rows that produced it are not.
 */
export function computeWaveAggregate(rows: ResponseRow[]): WaveAggregateSummary {
  const n = rows.length;

  // Average each of the 63 items across all respondents, then run the shared
  // pathway/goal scoring on those averages (equivalent to averaging pathway
  // scores across respondents, since pathway score = mean of its items).
  const itemAverages: ItemResponses = {};
  for (const code of ITEM_CODES) {
    const values = rows.map((r) => (r as any)[code]).filter((v): v is number => typeof v === "number");
    if (values.length > 0) {
      itemAverages[code.toUpperCase()] = values.reduce((a, b) => a + b, 0) / values.length;
    }
  }

  const pathwayAverages = computePathwayScores(itemAverages);
  const goalAverages = computeGoalScores(pathwayAverages);

  const maturityValues = rows.map((r) => r.journeyPost).filter((v): v is number => typeof v === "number");
  const maturityCounts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const v of maturityValues) {
    if (v >= 1 && v <= 5) maturityCounts[v]++;
  }
  const maturityDistribution = [1, 2, 3, 4, 5].map((level) => ({
    level,
    label: MATURITY_LABELS[level],
    count: maturityCounts[level],
    pct: maturityValues.length > 0 ? Math.round((maturityCounts[level] / maturityValues.length) * 1000) / 10 : 0,
  }));
  const averageMaturity =
    maturityValues.length > 0
      ? Math.round((maturityValues.reduce((a, b) => a + b, 0) / maturityValues.length) * 100) / 100
      : 0;

  return {
    respondentCount: n,
    generatedAt: new Date().toISOString(),
    pathwayAverages,
    goalAverages,
    maturityDistribution,
    averageMaturity,
    demographics: {
      gender: tally(rows.map((r) => r.gender)),
      ageGroup: tally(rows.map((r) => r.ageGroup)),
      attendanceFrequency: tally(rows.map((r) => r.attendanceFrequency)),
      tenure: tally(rows.map((r) => r.tenure)),
    },
  };
}
