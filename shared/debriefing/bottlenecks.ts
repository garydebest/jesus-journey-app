import type { ResponseRow } from "../schema";
import type { PathwayAnalysis, ReciprocityCheck, Insight } from "./types";
import { mean, round2, meetsSampleFloor, isMaterial } from "./helpers";

/**
 * Reciprocity checks: pairs of items within a pathway that separate "giving"
 * from "receiving" in a relationship. A one-directional pattern (strong on
 * one side, weak on the other) is the specific anomaly Gary asked about —
 * e.g. people forming relationships to help others, but not having anyone
 * they let help them (or vice versa): relational isolation despite activity.
 */
const RECIPROCITY_PAIRS: { pathwayName: string; givingCodes: string[]; receivingCodes: string[] }[] = [
  {
    pathwayName: "Journeying with Others",
    givingCodes: ["A8", "P5"], // forming relationships to help others / encouraging others
    receivingCodes: ["A7", "A9"], // having people I can be honest with / welcoming others' input into my own journey
  },
];

export function analyzeBottlenecks(
  rows: ResponseRow[],
  pathways: PathwayAnalysis[],
): { weakestPathways: { name: string; goal: string; score: number }[]; reciprocityChecks: ReciprocityCheck[]; insights: Insight[] } {
  const sorted = [...pathways].sort((a, b) => a.churchAverage - b.churchAverage);
  const weakestPathways = sorted.slice(0, 3).map((p) => ({ name: p.name, goal: p.goal, score: p.churchAverage }));

  const reciprocityChecks: ReciprocityCheck[] = RECIPROCITY_PAIRS.map((pair) => {
    const givingValues = pair.givingCodes.flatMap((c) => rows.map((r) => (r as any)[c.toLowerCase()]).filter((v: any): v is number => typeof v === "number"));
    const receivingValues = pair.receivingCodes.flatMap((c) => rows.map((r) => (r as any)[c.toLowerCase()]).filter((v: any): v is number => typeof v === "number"));
    const givingScore = givingValues.length > 0 ? round2(mean(givingValues)) : 0;
    const receivingScore = receivingValues.length > 0 ? round2(mean(receivingValues)) : 0;
    return {
      pathwayName: pair.pathwayName,
      givingScore,
      receivingScore,
      gap: round2(givingScore - receivingScore),
      n: rows.length,
      directionalOnly: !meetsSampleFloor(rows.length),
    };
  });

  const insights: Insight[] = [];

  for (const p of weakestPathways) {
    insights.push({
      kind: "opportunity",
      headline: `${p.name} is the pathway with the most room to grow church-wide.`,
      detail: `Church average of ${p.score} on a 0-5 scale, part of the "${p.goal}" goal area.`,
      corroboration: 1,
      directionalOnly: false,
      section: "Bottleneck Map",
    });
  }

  for (const check of reciprocityChecks) {
    if (!isMaterial(check.gap)) continue;
    const direction = check.gap > 0 ? "giving" : "receiving";
    const weaker = check.gap > 0 ? "receiving" : "giving";
    insights.push({
      kind: "opportunity",
      headline: `${check.pathwayName}: ${direction} runs ahead of ${weaker}.`,
      detail: `In "${check.pathwayName}," respondents score ${check.givingScore} on giving support to others vs. ${check.receivingScore} on receiving it themselves (a ${Math.abs(check.gap)}-point gap). This one-directional pattern can point to relational isolation even among people who are relationally active.`,
      corroboration: 1,
      directionalOnly: check.directionalOnly,
      section: "Bottleneck Map",
    });
  }

  return { weakestPathways, reciprocityChecks, insights };
}
