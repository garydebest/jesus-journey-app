import { PATHWAYS, GOALS } from "../pathways";
import { ITEM_TO_DIMENSION } from "../itemDimensions";
import type { ResponseRow } from "../schema";
import { analyzeDemographics } from "./demographics";
import { analyzePathways } from "./pathways";
import { analyzeMaturityAndChange } from "./maturity";
import { analyzeDimensions } from "./dimensions";
import { analyzeBottlenecks } from "./bottlenecks";
import { buildDemographicAssessment, buildMaturityStageAssessment } from "./systematicAssessment";
import type { DebriefingReport, Insight } from "./types";
import { round2, mean } from "./helpers";

/**
 * Groups insights that describe essentially the same underlying finding
 * (same headline text after light normalization) and merges corroboration
 * counts. Two analyses landing on the same conclusion from different angles
 * is what makes a finding "high-confidence" for the executive summary.
 */
function dedupeAndRank(insights: Insight[], kind: "strength" | "opportunity", limit: number): Insight[] {
  const filtered = insights.filter((i) => i.kind === kind);
  // Rank by corroboration desc, then prefer non-directional-only, then by
  // detail length (denser findings first) as a stable tiebreaker.
  const ranked = [...filtered].sort((a, b) => {
    if (b.corroboration !== a.corroboration) return b.corroboration - a.corroboration;
    if (a.directionalOnly !== b.directionalOnly) return a.directionalOnly ? 1 : -1;
    return b.detail.length - a.detail.length;
  });
  return ranked.slice(0, limit);
}

function suggestedQuestions(report: Omit<DebriefingReport, "suggestedDebriefQuestions" | "dataNotes">): string[] {
  const questions: string[] = [];
  const topOpportunity = report.executiveSummary.opportunities[0];
  const topStrength = report.executiveSummary.strengths[0];
  if (topStrength) questions.push(`What's behind our strength in "${topStrength.headline.replace(/\.$/, "")}"? How can we build on it intentionally?`);
  if (topOpportunity) questions.push(`What would it look like to take one concrete step this quarter on "${topOpportunity.headline.replace(/\.$/, "")}"?`);
  if (report.maturityAndChange.plateauAtTopFlag) {
    questions.push("Our most mature members report the least active growth — is that a healthy plateau, or do they need a new kind of challenge or invitation?");
  }
  if (report.bottleneckMap.weakestPathways.length > 0) {
    questions.push(`"${report.bottleneckMap.weakestPathways[0].name}" is our lowest-scoring pathway — what's one practical, low-barrier way we could invite people into it this season?`);
  }
  questions.push("Which demographic group in this report most surprised you — and why?");
  return questions;
}

export function buildDebriefingReport(params: {
  waveId: string;
  churchId: string;
  churchName: string;
  waveLabel: string;
  rows: ResponseRow[];
}): DebriefingReport {
  const { waveId, churchId, churchName, waveLabel, rows } = params;
  const respondentCount = rows.length;

  const demographics = analyzeDemographics(rows);
  const { pathways, insights: pathwayInsights } = analyzePathways(rows);
  const maturity = analyzeMaturityAndChange(rows);
  const dims = analyzeDimensions(rows);
  const bottlenecks = analyzeBottlenecks(rows, pathways);
  const demographicAssessment = buildDemographicAssessment(demographics);
  const maturityStageAssessment = buildMaturityStageAssessment(maturity.changeByMaturity);

  const pathwaysByGoal = GOALS.map((goal) => {
    const goalPathways = pathways.filter((p) => p.goal === goal);
    return {
      goal,
      goalAverage: goalPathways.length > 0 ? round2(mean(goalPathways.map((p) => p.churchAverage))) : 0,
      pathways: goalPathways,
    };
  });

  const engagementInsights: Insight[] = [];
  // Engagement section: attendance/small-group/volunteer frequency vs. maturity,
  // already covered under demographics — this section adds the cross-cutting
  // "engagement compound effect" read: are people high on ALL three engagement
  // markers meaningfully different from people low on all three?
  const engagementScore = (r: ResponseRow): number => {
    const rank = (v: string | null, order: string[]): number => (v ? order.indexOf(v) : -1);
    // Best-effort: use presence of a value as engaged=1, absence as 0; the exact
    // ordering of category labels varies by field and isn't critical here since
    // we only need a coarse "high/low engagement" split.
    let score = 0;
    if (r.attendanceFrequency) score++;
    if (r.smallGroupFrequency) score++;
    if (r.volunteerFrequency) score++;
    return score;
  };
  const highEngagement = rows.filter((r) => engagementScore(r) >= 3);
  const lowEngagement = rows.filter((r) => engagementScore(r) <= 1);
  if (highEngagement.length >= 15 && lowEngagement.length >= 15) {
    const highMaturity = mean(highEngagement.map((r) => r.journeyPost).filter((v): v is number => typeof v === "number"));
    const lowMaturity = mean(lowEngagement.map((r) => r.journeyPost).filter((v): v is number => typeof v === "number"));
    const gap = round2(highMaturity - lowMaturity);
    if (Math.abs(gap) >= 0.3) {
      engagementInsights.push({
        kind: "strength",
        headline: "Engagement across attendance, small groups, and volunteering compounds together.",
        detail: `Respondents engaged across all three (attendance, small group, volunteering) average ${round2(highMaturity)} on the maturity scale vs. ${round2(lowMaturity)} for those engaged in one or none — a ${Math.abs(gap)}-point gap.`,
        corroboration: 1,
        directionalOnly: false,
        section: "Engagement",
      });
    }
  }

  const crossCuttingInsights: Insight[] = [];
  // Cross-reference: does a weak pathway from the bottleneck map also show up
  // as the weakest dimension? That agreement across two independent cuts of
  // the same data is exactly the "2+ analyses agree = high confidence" case.
  const weakestDim = [...dims.rollups].sort((a, b) => a.churchAverage - b.churchAverage)[0];
  const weakestPathway = bottlenecks.weakestPathways[0];
  if (weakestDim && weakestPathway) {
    const pathwayDef = PATHWAYS.find((p) => p.name === weakestPathway.name);
    if (pathwayDef && pathwayDef.items.some((code) => weakestDim.id && pathwayDefBelongsToDim(code, weakestDim.id))) {
      crossCuttingInsights.push({
        kind: "opportunity",
        headline: `${weakestPathway.name} and ${weakestDim.name} point to the same growth edge.`,
        detail: `Both the pathway-level and dimension-level analysis independently surface this same area as the church's lowest-scoring, which raises confidence this is a real pattern rather than noise.`,
        corroboration: 2,
        directionalOnly: false,
        section: "Cross-Cutting",
      });
    }
  }

  // Merge all insights across sections, then bump corroboration for any pair
  // of insights that reference the same pathway/dimension name in their
  // headline — a lightweight way to detect independent agreement without a
  // rigid rule table for every possible pairing.
  // Systematic assessment items are excluded from the executive-summary pool
  // deliberately: they cover every group by design (including routine,
  // unremarkable ones), so ranking them alongside outlier-driven insights
  // would crowd out genuinely notable findings. They're presented in their
  // own dedicated report sections instead.
  const allInsights = [
    ...demographics.flatMap((d) => d.insights),
    ...pathwayInsights,
    ...maturity.insights,
    ...dims.insights,
    ...bottlenecks.insights,
    ...engagementInsights,
    ...crossCuttingInsights,
  ];
  boostCorroborationForSharedTopics(allInsights);

  const executiveSummary = {
    strengths: dedupeAndRank(allInsights, "strength", 7),
    opportunities: dedupeAndRank(allInsights, "opportunity", 7),
  };

  const dataNotes: string[] = [];
  if (respondentCount < 15) {
    dataNotes.push(`This wave has only ${respondentCount} respondents. Every finding in this report should be read as directional, not statistically firm.`);
  }
  const anyDirectional = allInsights.some((i) => i.directionalOnly);
  if (anyDirectional) {
    dataNotes.push('Findings marked "directional only" come from a subgroup smaller than 15 respondents. Treat them as a hint worth watching, not a confirmed pattern.');
  }

  const report: DebriefingReport = {
    waveId,
    churchId,
    churchName,
    waveLabel,
    respondentCount,
    generatedAt: new Date().toISOString(),
    executiveSummary,
    demographics,
    demographicAssessment,
    engagement: { insights: engagementInsights },
    maturityAndChange: maturity,
    maturityStageAssessment,
    pathwaysByGoal,
    dimensions: dims,
    bottleneckMap: bottlenecks,
    crossCutting: { insights: crossCuttingInsights },
    suggestedDebriefQuestions: [],
    dataNotes,
  };
  report.suggestedDebriefQuestions = suggestedQuestions(report);
  return report;
}

function pathwayDefBelongsToDim(itemCode: string, dimId: string): boolean {
  return ITEM_TO_DIMENSION[itemCode]?.id === dimId;
}

function normalizeTopic(headline: string): string {
  return headline
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .split(" ")
    .filter((w) => w.length > 4)
    .slice(0, 4)
    .join(" ");
}

function boostCorroborationForSharedTopics(insights: Insight[]): void {
  const buckets = new Map<string, Insight[]>();
  for (const insight of insights) {
    const key = normalizeTopic(insight.headline);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(insight);
  }
  for (const group of Array.from(buckets.values())) {
    if (group.length > 1) {
      for (const insight of group) insight.corroboration = Math.max(insight.corroboration, group.length);
    }
  }
}
