import { PATHWAYS } from "./pathways";

export type ItemResponses = Record<string, number>; // e.g. { B1: 4, K1: 5, ... }

export interface PathwayScore {
  num: number;
  name: string;
  goal: string;
  score: number; // 0-5, rounded to 2 decimals
  band: "high" | "medium" | "low";
}

const HIGH = 3.79;
const MED = 3.5;

function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Computes all 16 pathway scores from raw item responses.
 * Always computes fresh from raw items (never trusts any precomputed/cached value) —
 * this avoids the legacy path12-save bug found in the original ASP.NET app.
 */
export function computePathwayScores(responses: ItemResponses): PathwayScore[] {
  return PATHWAYS.map((p) => {
    const values = p.items.map((code) => responses[code]).filter((v) => typeof v === "number");
    const score = values.length > 0 ? Math.round(mean(values) * 100) / 100 : 0;
    const band: PathwayScore["band"] = score > HIGH ? "high" : score < MED ? "low" : "medium";
    return { num: p.num, name: p.name, goal: p.goal, score, band };
  });
}

export function computeGoalScores(pathwayScores: PathwayScore[]): Record<string, number> {
  const goals: Record<string, number[]> = {};
  for (const p of pathwayScores) {
    if (!goals[p.goal]) goals[p.goal] = [];
    goals[p.goal].push(p.score);
  }
  const result: Record<string, number> = {};
  for (const [goal, scores] of Object.entries(goals)) {
    result[goal] = Math.round(mean(scores) * 100) / 100;
  }
  return result;
}

export function itemIsStrength(value: number): boolean {
  return value > 3;
}

/**
 * Top three Strengths to Celebrate and three Opportunities to Explore from a
 * full-form report. Same rule as the short form: highest scores first (ties by
 * pathway number), then the lowest of the remaining pathways.
 */
export function selectTopPathways(scores: PathwayScore[]) {
  const strengths = [...scores].sort((a, b) => b.score - a.score || a.num - b.num).slice(0, 3);
  const chosen = new Set(strengths.map((p) => p.num));
  const opportunities = scores.filter((p) => !chosen.has(p.num)).sort((a, b) => a.score - b.score || a.num - b.num).slice(0, 3);
  return { strengths, opportunities };
}
