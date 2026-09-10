// ---------------------------------------------------------------------------
// Structured shape of a Debriefing Report. This is what gets stored as
// debriefing_reports.report_json, rendered in the admin UI, and rendered to
// PDF. Every observation is an Insight — always filed as a strength or an
// opportunity, never a "weakness"/"challenge", per Gary's explicit framing.
// ---------------------------------------------------------------------------

export type InsightKind = "strength" | "opportunity";

/** How many independent analyses point the same direction — corroboration
 *  strength used to rank Executive Summary items and to mark "directional
 *  only" findings from small subgroups. */
export interface Insight {
  kind: InsightKind;
  headline: string; // one sentence, plain language
  detail: string; // the number + comparison + "so what"
  corroboration: number; // count of independent analyses supporting this (>=2 = high-confidence)
  directionalOnly: boolean; // true when driven by a subgroup below the n>=15 floor
  section: string; // which report section this came from, for traceability
}

export interface DemographicBreakdownRow {
  group: string;
  n: number;
  pctOfChurch: number;
  avgMaturity: number;
  maturityVsChurch: number; // percentage-point-equivalent delta, church average subtracted
  growingPct: number; // % reporting "growing significantly" or "growing a little"
  fadingPct: number; // % reporting "fading somewhat" or "fading a lot"
  directionalOnly: boolean;
}

export interface DemographicSection {
  id: string;
  title: string;
  breakdown: DemographicBreakdownRow[];
  insights: Insight[];
}

export interface PathwayTrajectoryPoint {
  stage: string; // maturity label
  score: number;
  n: number;
}

export interface PathwayAnalysis {
  num: number;
  name: string;
  goal: string;
  churchAverage: number;
  band: "high" | "medium" | "low";
  trajectory: PathwayTrajectoryPoint[];
  trajectoryShape: "steady-climb" | "early-loaded" | "late-loaded" | "flat" | "non-monotonic" | "insufficient-data";
  reversals: { fromStage: string; toStage: string; pointDrop: number }[];
}

export interface DimensionRollup {
  id: string;
  name: string;
  type: "belief" | "practice";
  churchAverage: number;
  rank: number;
}

export interface MaturityFunnelStage {
  fromLabel: string;
  toLabel: string;
  fromCount: number;
  toOrHigherCount: number;
  advanceRate: number; // 0-1
}

export interface MaturityChangeCrosstab {
  maturityLabel: string;
  n: number;
  growingPct: number;
  sameOrFadingPct: number;
}

export interface ReciprocityCheck {
  pathwayName: string;
  givingScore: number;
  receivingScore: number;
  gap: number;
  n: number;
  directionalOnly: boolean;
}

export interface BeliefPracticeGap {
  pathwayNum: number;
  pathwayName: string;
  beliefAvg: number | null;
  practiceAvg: number | null;
  gap: number | null;
}

export interface DebriefingReport {
  waveId: string;
  churchId: string;
  churchName: string;
  waveLabel: string;
  respondentCount: number;
  generatedAt: string;

  executiveSummary: {
    strengths: Insight[]; // top 5-7, ranked by corroboration
    opportunities: Insight[]; // top 5-7, ranked by corroboration
  };

  demographics: DemographicSection[];

  // Systematic strength/opportunity verdict for every group in a fixed,
  // named scope (every age bracket, singles vs. married, children in
  // household) — distinct from demographics[].insights, which only
  // surfaces statistical outliers. Every group in scope appears here,
  // even ones with no notable gap or zero respondents.
  demographicAssessment: Insight[];

  engagement: {
    insights: Insight[];
  };

  maturityAndChange: {
    distribution: { label: string; count: number; pct: number }[];
    averageMaturity: number;
    funnel: MaturityFunnelStage[];
    changeByMaturity: MaturityChangeCrosstab[];
    plateauAtTopFlag: boolean; // the named "Jesus Centered lowest growing rate" pattern check
    insights: Insight[];
  };

  // Systematic strength/opportunity verdict for each of the four named
  // maturity stages (Exploring, Believing, Trusting, God Centered) —
  // "Distant" is intentionally excluded. Distinct from
  // maturityAndChange.insights, which only surfaces statistical outliers.
  maturityStageAssessment: Insight[];

  pathwaysByGoal: {
    goal: string;
    goalAverage: number;
    pathways: PathwayAnalysis[];
  }[];

  dimensions: {
    rollups: DimensionRollup[];
    beliefPracticeGaps: BeliefPracticeGap[];
    insights: Insight[];
  };

  bottleneckMap: {
    weakestPathways: { name: string; goal: string; score: number }[];
    reciprocityChecks: ReciprocityCheck[];
    insights: Insight[];
  };

  crossCutting: {
    insights: Insight[];
  };

  suggestedDebriefQuestions: string[];

  dataNotes: string[]; // caveats: small-n warnings, missing data, etc.
}
