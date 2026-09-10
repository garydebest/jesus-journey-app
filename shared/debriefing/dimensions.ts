import { DIMENSIONS } from "../itemDimensions";
import { PATHWAYS } from "../pathways";
import type { ResponseRow } from "../schema";
import type { DimensionRollup, BeliefPracticeGap, Insight } from "./types";
import { mean, round2, isMaterial } from "./helpers";

export function analyzeDimensions(rows: ResponseRow[]): {
  rollups: DimensionRollup[];
  beliefPracticeGaps: BeliefPracticeGap[];
  insights: Insight[];
} {
  const rollups: DimensionRollup[] = DIMENSIONS.map((dim) => {
    const values: number[] = [];
    for (const code of dim.items) {
      values.push(...rows.map((r) => (r as any)[code.toLowerCase()]).filter((v: any): v is number => typeof v === "number"));
    }
    return {
      id: dim.id,
      name: dim.name,
      type: dim.type,
      churchAverage: values.length > 0 ? round2(mean(values)) : 0,
      rank: 0, // filled below
    };
  });
  const sorted = [...rollups].sort((a, b) => b.churchAverage - a.churchAverage);
  sorted.forEach((r, i) => {
    const target = rollups.find((x) => x.id === r.id)!;
    target.rank = i + 1;
  });

  // Belief-vs-practice gap per pathway: for pathways whose items span both a
  // belief item and a practice item, is stated belief outrunning practiced
  // behavior (or vice versa)? Most pathways here are purely one type, so this
  // will often be null — that's expected and fine.
  const beliefCodes = new Set(DIMENSIONS.filter((d) => d.type === "belief").flatMap((d) => d.items));
  const practiceCodes = new Set(DIMENSIONS.filter((d) => d.type === "practice").flatMap((d) => d.items));

  const beliefPracticeGaps: BeliefPracticeGap[] = PATHWAYS.map((p) => {
    const beliefItems = p.items.filter((c) => beliefCodes.has(c));
    const practiceItems = p.items.filter((c) => practiceCodes.has(c));
    const beliefValues = beliefItems.flatMap((c) => rows.map((r) => (r as any)[c.toLowerCase()]).filter((v: any): v is number => typeof v === "number"));
    const practiceValues = practiceItems.flatMap((c) => rows.map((r) => (r as any)[c.toLowerCase()]).filter((v: any): v is number => typeof v === "number"));
    const beliefAvg = beliefValues.length > 0 ? round2(mean(beliefValues)) : null;
    const practiceAvg = practiceValues.length > 0 ? round2(mean(practiceValues)) : null;
    return {
      pathwayNum: p.num,
      pathwayName: p.name,
      beliefAvg,
      practiceAvg,
      gap: beliefAvg !== null && practiceAvg !== null ? round2(beliefAvg - practiceAvg) : null,
    };
  }).filter((g) => g.gap !== null);

  const insights: Insight[] = [];

  // Church-wide belief vs. practice overall roll-up (the clearest single cut).
  const beliefAll = mean(rollups.filter((r) => r.type === "belief").map((r) => r.churchAverage));
  const practiceAll = mean(rollups.filter((r) => r.type === "practice").map((r) => r.churchAverage));
  const overallGap = round2(beliefAll - practiceAll);
  if (isMaterial(overallGap)) {
    if (overallGap > 0) {
      insights.push({
        kind: "opportunity",
        headline: "Stated belief runs ahead of lived practice church-wide.",
        detail: `Belief items average ${round2(beliefAll)} vs. ${round2(practiceAll)} for practice items — a ${overallGap}-point gap. People affirm the truths more readily than they consistently live them out day to day.`,
        corroboration: 1,
        directionalOnly: false,
        section: "Beliefs & Practices",
      });
    } else {
      insights.push({
        kind: "strength",
        headline: "Practice keeps pace with — or leads — belief church-wide.",
        detail: `Practice items average ${round2(practiceAll)} vs. ${round2(beliefAll)} for belief items. People are living out the faith at least as consistently as they affirm it.`,
        corroboration: 1,
        directionalOnly: false,
        section: "Beliefs & Practices",
      });
    }
  }

  // Highest/lowest single dimension call-outs.
  const top = sorted[0];
  const bottom = sorted[sorted.length - 1];
  if (top && isMaterial(top.churchAverage - bottom.churchAverage)) {
    insights.push({
      kind: "strength",
      headline: `${top.name} is the strongest of the seven core dimensions.`,
      detail: `Church average of ${top.churchAverage} on this dimension, the highest of the seven measured.`,
      corroboration: 1,
      directionalOnly: false,
      section: "Beliefs & Practices",
    });
    insights.push({
      kind: "opportunity",
      headline: `${bottom.name} is the area with the most room to grow.`,
      detail: `Church average of ${bottom.churchAverage} on this dimension, the lowest of the seven measured.`,
      corroboration: 1,
      directionalOnly: false,
      section: "Beliefs & Practices",
    });
  }

  return { rollups, beliefPracticeGaps, insights };
}
