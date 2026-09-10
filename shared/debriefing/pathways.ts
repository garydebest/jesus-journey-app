import { PATHWAYS } from "../pathways";
import { MATURITY_LABELS } from "../questions";
import type { ResponseRow } from "../schema";
import { computePathwayScores } from "../scoring";
import type { PathwayAnalysis, PathwayTrajectoryPoint, Insight } from "./types";
import { mean, round2, meetsSampleFloor, isMaterial } from "./helpers";

/**
 * For each of the 16 pathways, computes the church-wide average AND the
 * trajectory of that pathway's average score across the 5 maturity stages
 * (Distant -> God Centered), using each respondent's own journeyPost stage.
 * A healthy pathway should climb monotonically with maturity stage. A dip
 * (reversal) at some stage is the anomaly Gary specifically asked about —
 * e.g. a pathway that is strong for "Trusting" respondents but unexpectedly
 * weaker for "God Centered" respondents.
 */
export function analyzePathways(rows: ResponseRow[]): { pathways: PathwayAnalysis[]; insights: Insight[] } {
  const byStage = new Map<number, ResponseRow[]>();
  for (const r of rows) {
    if (typeof r.journeyPost === "number" && r.journeyPost >= 1 && r.journeyPost <= 5) {
      if (!byStage.has(r.journeyPost)) byStage.set(r.journeyPost, []);
      byStage.get(r.journeyPost)!.push(r);
    }
  }

  // Church-wide pathway scores, from item averages across all respondents.
  const itemAverages: Record<string, number> = {};
  const ITEM_CODES_UPPER = Array.from(new Set(PATHWAYS.flatMap((p) => p.items)));
  for (const code of ITEM_CODES_UPPER) {
    const values = rows.map((r) => (r as any)[code.toLowerCase()]).filter((v): v is number => typeof v === "number");
    if (values.length > 0) itemAverages[code] = mean(values);
  }
  const churchScores = computePathwayScores(itemAverages);

  const insights: Insight[] = [];
  const analyses: PathwayAnalysis[] = churchScores.map((cs) => {
    const pathwayDef = PATHWAYS.find((p) => p.num === cs.num)!;
    const trajectory: PathwayTrajectoryPoint[] = [];
    for (let stage = 1; stage <= 5; stage++) {
      const stageRows = byStage.get(stage) ?? [];
      const stageItemAverages: Record<string, number> = {};
      for (const code of pathwayDef.items) {
        const values = stageRows.map((r) => (r as any)[code.toLowerCase()]).filter((v): v is number => typeof v === "number");
        if (values.length > 0) stageItemAverages[code] = mean(values);
      }
      const values = pathwayDef.items.map((c) => stageItemAverages[c]).filter((v) => typeof v === "number");
      trajectory.push({
        stage: MATURITY_LABELS[stage],
        score: values.length > 0 ? round2(mean(values)) : 0,
        n: stageRows.length,
      });
    }

    // Only consider stages with enough respondents when judging shape/reversals.
    const usable = trajectory.filter((t) => meetsSampleFloor(t.n));
    const reversals: PathwayAnalysis["reversals"] = [];
    for (let i = 1; i < usable.length; i++) {
      const drop = usable[i - 1].score - usable[i].score;
      if (isMaterial(drop) && drop > 0) {
        reversals.push({ fromStage: usable[i - 1].stage, toStage: usable[i].stage, pointDrop: round2(drop) });
      }
    }

    let shape: PathwayAnalysis["trajectoryShape"] = "insufficient-data";
    if (usable.length >= 3) {
      if (reversals.length > 0) {
        shape = "non-monotonic";
      } else {
        const first = usable[0].score;
        const last = usable[usable.length - 1].score;
        const totalRise = last - first;
        if (Math.abs(totalRise) < MATERIALITY_FLAT) {
          shape = "flat";
        } else {
          // early-loaded = most growth happens in the first half of the climb
          const mid = usable[Math.floor(usable.length / 2)].score;
          const firstHalfRise = mid - first;
          const secondHalfRise = last - mid;
          shape = firstHalfRise > secondHalfRise * 1.3 ? "early-loaded" : secondHalfRise > firstHalfRise * 1.3 ? "late-loaded" : "steady-climb";
        }
      }
    }

    if (reversals.length > 0) {
      insights.push({
        kind: "opportunity",
        headline: `${pathwayDef.name} dips instead of climbing steadily as people mature.`,
        detail: `Respondents further along the maturity journey score LOWER on ${pathwayDef.name} than those at an earlier stage: ${reversals
          .map((r) => `${r.fromStage} \u2192 ${r.toStage} drops ${r.pointDrop} points`)
          .join("; ")}. This is worth a closer look — it may point to a specific life stage or ministry gap.`,
        corroboration: 1,
        directionalOnly: usable.length < trajectory.length,
        section: `Pathway Trajectories — ${pathwayDef.name}`,
      });
    }

    return {
      num: cs.num,
      name: cs.name,
      goal: cs.goal,
      churchAverage: cs.score,
      band: cs.band,
      trajectory,
      trajectoryShape: shape,
      reversals,
    };
  });

  return { pathways: analyses, insights };
}

const MATERIALITY_FLAT = 0.2;
