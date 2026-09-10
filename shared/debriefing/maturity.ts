import { MATURITY_LABELS } from "../questions";
import type { ResponseRow } from "../schema";
import type { MaturityFunnelStage, MaturityChangeCrosstab, Insight } from "./types";
import { mean, round2, pct, meetsSampleFloor, isMaterial } from "./helpers";

const GROWING_VALUES = new Set([1, 2]);

export function analyzeMaturityAndChange(rows: ResponseRow[]): {
  distribution: { label: string; count: number; pct: number }[];
  averageMaturity: number;
  funnel: MaturityFunnelStage[];
  changeByMaturity: MaturityChangeCrosstab[];
  plateauAtTopFlag: boolean;
  insights: Insight[];
} {
  const maturityValues = rows.map((r) => r.journeyPost).filter((v): v is number => typeof v === "number");
  const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const v of maturityValues) if (v >= 1 && v <= 5) counts[v]++;
  const total = maturityValues.length;
  const distribution = [1, 2, 3, 4, 5].map((level) => ({
    label: MATURITY_LABELS[level],
    count: counts[level],
    pct: pct(counts[level], total),
  }));
  const averageMaturity = total > 0 ? round2(mean(maturityValues)) : 0;

  // Funnel: of those AT stage N or below, what % are at stage N+1 or above?
  // A simpler and more honest cut for a single-wave (non-longitudinal) survey:
  // % of each stage's population that has progressed to reach at least that stage.
  const cumulative: number[] = [];
  let running = 0;
  for (let level = 5; level >= 1; level--) {
    running += counts[level];
    cumulative[level] = running;
  }
  const funnel: MaturityFunnelStage[] = [];
  for (let level = 1; level < 5; level++) {
    const atOrBelow = cumulative[1] - (cumulative[level + 1] ?? 0);
    const atOrAbove = cumulative[level] ?? 0;
    funnel.push({
      fromLabel: MATURITY_LABELS[level],
      toLabel: MATURITY_LABELS[level + 1],
      fromCount: counts[level],
      toOrHigherCount: cumulative[level + 1] ?? 0,
      advanceRate: total > 0 ? round2((cumulative[level + 1] ?? 0) / total) : 0,
    });
  }

  // Change-by-maturity crosstab: is growth momentum ("currently growing")
  // evenly spread across maturity stages, or concentrated/absent somewhere?
  const changeByMaturity: MaturityChangeCrosstab[] = [];
  for (let level = 1; level <= 5; level++) {
    const stageRows = rows.filter((r) => r.journeyPost === level);
    const changeValues = stageRows.map((r) => r.spiritualChange).filter((v): v is number => typeof v === "number");
    if (changeValues.length === 0) continue;
    changeByMaturity.push({
      maturityLabel: MATURITY_LABELS[level],
      n: changeValues.length,
      growingPct: pct(changeValues.filter((v) => GROWING_VALUES.has(v)).length, changeValues.length),
      sameOrFadingPct: pct(changeValues.filter((v) => !GROWING_VALUES.has(v)).length, changeValues.length),
    });
  }

  const insights: Insight[] = [];

  // The specific anomaly Gary named: people at the top maturity stage
  // ("God Centered") reporting the LOWEST rate of active growth — a plateau
  // signal, since "growing" and "already arrived" can coexist in healthy
  // discipleship, but a sharp drop at the top stage is worth flagging.
  const topStage = changeByMaturity.find((c) => c.maturityLabel === "God Centered");
  const otherStages = changeByMaturity.filter((c) => c.maturityLabel !== "God Centered" && meetsSampleFloor(c.n));
  let plateauAtTopFlag = false;
  if (topStage && meetsSampleFloor(topStage.n) && otherStages.length > 0) {
    const otherAvgGrowing = mean(otherStages.map((s) => s.growingPct));
    if (isMaterial((topStage.growingPct - otherAvgGrowing) / 20) && topStage.growingPct < otherAvgGrowing) {
      plateauAtTopFlag = true;
      insights.push({
        kind: "opportunity",
        headline: "Respondents at the most mature stage report the lowest rate of active growth.",
        detail: `Only ${topStage.growingPct}% of "God Centered" respondents (n=${topStage.n}) say they're currently growing, vs. ${round2(otherAvgGrowing)}% across earlier stages. This can be a healthy plateau, or a sign that mature believers need a different kind of challenge or invitation to keep growing.`,
        corroboration: 1,
        directionalOnly: !meetsSampleFloor(topStage.n),
        section: "Maturity & Change",
      });
    }
  }

  // Distribution-shape insight: where is the church concentrated?
  const topTwo = distribution[3].pct + distribution[4].pct;
  const bottomTwo = distribution[0].pct + distribution[1].pct;
  if (topTwo >= 50) {
    insights.push({
      kind: "strength",
      headline: `${topTwo}% of respondents describe themselves as "Trusting" or "God Centered" in their walk with God.`,
      detail: `The church's respondent base is concentrated in the two most mature stages, averaging ${averageMaturity} on the 5-point maturity scale.`,
      corroboration: 1,
      directionalOnly: false,
      section: "Maturity & Change",
    });
  } else if (bottomTwo >= 30) {
    insights.push({
      kind: "opportunity",
      headline: `${bottomTwo}% of respondents describe themselves as "Distant" or "Exploring" in their walk with God.`,
      detail: `A meaningful share of the group is early in the journey — averaging ${averageMaturity} on the 5-point maturity scale church-wide.`,
      corroboration: 1,
      directionalOnly: false,
      section: "Maturity & Change",
    });
  }

  return { distribution, averageMaturity, funnel, changeByMaturity, plateauAtTopFlag, insights };
}
