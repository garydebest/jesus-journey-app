// Systematic strength/opportunity assessment for a fixed, named set of
// demographic groups and maturity stages — requested by Gary specifically so
// every group in scope gets an explicit verdict, not just the ones that
// happen to clear the existing outlier-detection threshold used elsewhere in
// the engine (see demographics.ts / maturity.ts "insights" arrays).
//
// This reuses data the engine already computes (DemographicSection[] and
// the maturityAndChange block) — no new inputs, no schema changes. Every row
// in scope gets exactly one Insight, always framed as "Strength to
// Celebrate" or "Opportunity to Explore" per Gary's framing rule; a
// near-zero gap is framed as a mild strength ("holding steady, in line with
// the church average") rather than forced into an artificial opportunity.

import type { DemographicSection, MaturityChangeCrosstab, Insight } from "./types";
import { round2, meetsSampleFloor } from "./helpers";

// Which demographic sections (by id, matching demographics.ts) and, for
// "ageGroup" only, which specific groups get a systematic verdict. Other
// demographic sections (gender, attendance, tenure, race, etc.) keep their
// existing outlier-only insight behavior and are unaffected.
const AGE_GROUP_LABELS = ["16-19", "20-29", "30-39", "40-49", "50-59", "60 and older"];
const SYSTEMATIC_SECTION_IDS = new Set(["ageGroup", "singlesVsMarried", "childrenInHousehold"]);

// Only these four maturity stages get a systematic verdict, per Gary's
// request — "Distant" is intentionally excluded.
const MATURITY_STAGES_IN_SCOPE = ["Exploring", "Believing", "Trusting", "God Centered"];

const NEAR_ZERO_MATURITY_GAP = 0.15; // below this, frame as "holding steady" rather than a directional claim

function demographicVerdict(sectionTitle: string, row: {
  group: string;
  n: number;
  pctOfChurch: number;
  avgMaturity: number;
  maturityVsChurch: number;
  growingPct: number;
  fadingPct: number;
  directionalOnly: boolean;
}): Insight {
  const gap = row.maturityVsChurch;
  const isStrength = gap >= -NEAR_ZERO_MATURITY_GAP;
  const magnitude = Math.abs(gap);

  let headline: string;
  if (magnitude < NEAR_ZERO_MATURITY_GAP) {
    headline = `${row.group} is holding steady — right in line with the church-wide average in spiritual maturity.`;
  } else if (isStrength) {
    headline = `${row.group} is a strength to celebrate — running ${magnitude} points above the church average in spiritual maturity.`;
  } else {
    headline = `${row.group} is an opportunity to explore — running ${magnitude} points below the church average in spiritual maturity.`;
  }

  return {
    kind: isStrength ? "strength" : "opportunity",
    headline,
    detail: `${row.n} respondents (${row.pctOfChurch}% of the church) average ${row.avgMaturity} on the 5-point maturity scale. ${row.growingPct}% report currently growing; ${row.fadingPct}% report fading.`,
    corroboration: 1,
    directionalOnly: row.directionalOnly,
    section: `Demographic Assessment — ${sectionTitle}`,
  };
}

/** One strength/opportunity verdict per in-scope demographic group, covering
 *  every age bracket, the singles-vs-married split, and children-in-household
 *  — even groups with no respondents this wave, so leaders can see coverage
 *  gaps as clearly as strengths. */
export function buildDemographicAssessment(demographics: DemographicSection[]): Insight[] {
  const out: Insight[] = [];

  for (const section of demographics) {
    if (!SYSTEMATIC_SECTION_IDS.has(section.id)) continue;

    if (section.id === "ageGroup") {
      // Emit one verdict per known age bracket, in the survey's natural
      // order, regardless of whether this wave's respondents happened to
      // fill every bracket.
      for (const label of AGE_GROUP_LABELS) {
        const row = section.breakdown.find((b) => b.group === label);
        if (!row) {
          out.push({
            kind: "opportunity",
            headline: `No respondents in the ${label} age group this wave — an opportunity to explore reaching this group.`,
            detail: "This age bracket had zero responses, so no maturity comparison is available for it yet.",
            corroboration: 1,
            directionalOnly: true,
            section: "Demographic Assessment — Age Group",
          });
          continue;
        }
        out.push(demographicVerdict(`${label} age group`, row));
      }
    } else {
      // Singles vs. Married, Children in Household: verdict for every group
      // actually present.
      for (const row of section.breakdown) {
        out.push(demographicVerdict(row.group, row));
      }
    }
  }

  return out;
}

function maturityStageVerdict(stage: MaturityChangeCrosstab, churchAvgGrowingPct: number): Insight {
  const gap = round2(stage.growingPct - churchAvgGrowingPct);
  const isStrength = gap >= -5; // growing-rate points; small negative gaps read as steady, not a red flag
  const magnitude = Math.abs(gap);

  let headline: string;
  if (magnitude < 5) {
    headline = `The "${stage.maturityLabel}" stage is holding steady — its active-growth rate is close to the church-wide average.`;
  } else if (isStrength) {
    headline = `The "${stage.maturityLabel}" stage is a strength to celebrate — ${stage.growingPct}% report actively growing, above the church-wide average.`;
  } else {
    headline = `The "${stage.maturityLabel}" stage is an opportunity to explore — only ${stage.growingPct}% report actively growing, below the church-wide average.`;
  }

  return {
    kind: isStrength ? "strength" : "opportunity",
    headline,
    detail: `${stage.n} respondents describe themselves as "${stage.maturityLabel}." ${stage.growingPct}% report currently growing; ${stage.sameOrFadingPct}% report staying the same or fading — vs. ${round2(churchAvgGrowingPct)}% growing church-wide.`,
    corroboration: 1,
    directionalOnly: !meetsSampleFloor(stage.n),
    section: `Maturity Stage Assessment — ${stage.maturityLabel}`,
  };
}

/** One strength/opportunity verdict for each of the four named maturity
 *  stages (Exploring, Believing, Trusting, God Centered) — "Distant" is
 *  intentionally excluded per Gary's request. */
export function buildMaturityStageAssessment(changeByMaturity: MaturityChangeCrosstab[]): Insight[] {
  const allGrowingValues = changeByMaturity.map((s) => s.growingPct * s.n);
  const totalN = changeByMaturity.reduce((sum, s) => sum + s.n, 0);
  const churchAvgGrowingPct = totalN > 0 ? round2(allGrowingValues.reduce((a, b) => a + b, 0) / totalN) : 0;

  const out: Insight[] = [];
  for (const label of MATURITY_STAGES_IN_SCOPE) {
    const stage = changeByMaturity.find((s) => s.maturityLabel === label);
    if (!stage) {
      out.push({
        kind: "opportunity",
        headline: `No respondents describe themselves as "${label}" this wave — an opportunity to explore reaching this stage.`,
        detail: "This maturity stage had zero responses, so no growth-rate comparison is available for it yet.",
        corroboration: 1,
        directionalOnly: true,
        section: `Maturity Stage Assessment — ${label}`,
      });
      continue;
    }
    out.push(maturityStageVerdict(stage, churchAvgGrowingPct));
  }
  return out;
}
