import type { ResponseRow } from "./schema";
import { PATHWAYS } from "./pathways";
import { SURVEY_ITEMS } from "./surveyItems";
import { MATURITY_LABELS } from "./questions";
import { classifyStoredResponse, SHORT_PATHWAY_ITEMS, PRIVACY_MINIMUM, PRIVACY_MESSAGE } from "./shortForm";
import { childrenProfile } from "./reportMetrics";

export interface SafeDistribution {
  suppressed: boolean;
  note?: string;
  values: { label: string; count: number; pct: number }[];
}
export interface CohortSection {
  variant: "full" | "distant_exploring_short";
  label: string;
  suppressed: boolean;
  respondentCount: number | null;
  pathways: { num: number; name: string; goal: string; measurement: string; items: { code: string; text: string; agreementPct: number }[] }[];
}
export interface CohortReporting {
  version: 1;
  note: string;
  respondentCount: number | null;
  dataQualityNote?: string;
  profiles: Record<string, SafeDistribution>;
  cohorts: CohortSection[];
}

// Suppress the entire distribution if any non-empty cell or unreported/missing
// complement has fewer than five people. Suppressing only one cell would let a
// reader reconstruct it by subtracting the other counts from the total.
export function safeDistribution(values: (string | null | undefined)[], population = values.length): SafeDistribution {
  const counts = new Map<string, number>();
  for (const value of values) if (value) counts.set(value, (counts.get(value) ?? 0) + 1);
  const n = Array.from(counts.values()).reduce((a, b) => a + b, 0);
  const missing = population - n;
  if (population < PRIVACY_MINIMUM || Array.from(counts.values()).some(count => count < PRIVACY_MINIMUM) || (missing > 0 && missing < PRIVACY_MINIMUM)) {
    return { suppressed: true, values: [] };
  }
  return { suppressed: false, values: Array.from(counts).map(([label, count]) => ({ label, count, pct: Math.round(count / n * 1000) / 10 })) };
}

export function splitResponseCohorts(rows: ResponseRow[]) {
  return {
    full: rows.filter(row => classifyStoredResponse(row) === "full"),
    short: rows.filter(row => classifyStoredResponse(row) === "distant_exploring_short"),
    incomplete: rows.filter(row => classifyStoredResponse(row) === "incomplete"),
  };
}

export function needsCohortReporting(rows: ResponseRow[]) {
  return rows.some(row => classifyStoredResponse(row) !== "full");
}

export function buildCohortReporting(rows: ResponseRow[]): CohortReporting {
  const split = splitResponseCohorts(rows);
  const eligible = [...split.full, ...split.short];
  // A count of the larger cohort plus the overall total would reveal a small
  // other cohort. Hide both cohort counts/results when either present cohort
  // is below the threshold. No short/full subtraction attack is possible.
  const cohortPrivacy = [split.full, split.short].some(group => group.length > 0 && group.length < PRIVACY_MINIMUM);
  const cohorts: CohortSection[] = ([
    ["full", "Full-survey participants", split.full],
    ["distant_exploring_short", "Participants who described themselves as Distant or Exploring", split.short],
  ] as const).map(([variant, label, members]) => {
    const suppressed = cohortPrivacy || members.length < PRIVACY_MINIMUM;
    return {
      variant, label, suppressed, respondentCount: suppressed ? null : members.length,
      pathways: suppressed ? [] : PATHWAYS.filter(p => variant === "full" || p.num !== 3).map(p => {
        const codes = variant === "full" ? p.items : SHORT_PATHWAY_ITEMS[p.num];
        return {
          num: p.num, name: p.name, goal: p.goal,
          measurement: codes.length === 1 ? "single_item" : "measured",
          items: codes.map(code => ({
            code, text: SURVEY_ITEMS.find(item => item.code === code)!.text,
            agreementPct: Math.round(members.filter(row => Number(row[code.toLowerCase() as keyof ResponseRow]) >= 4).length / members.length * 1000) / 10,
          })),
        };
      }),
    };
  });
  const profiles: Record<string, SafeDistribution> = {};
  for (const [field, label] of [
    ["gender", "Gender"], ["ageGroup", "Age"], ["relationshipStatus", "Relationship status"],
    ["attendanceFrequency", "Attendance"], ["tenure", "Time involved"],
    ["smallGroupFrequency", "Small-group participation"], ["volunteerFrequency", "Volunteering"],
    ["raceEthnicity", "Race / ethnicity"],
  ] as const) profiles[label] = safeDistribution(eligible.map(row => row[field]));
  const children = childrenProfile(eligible);
  const small = (n: number) => n > 0 && n < PRIVACY_MINIMUM;
  const childSuppressed = eligible.length < PRIVACY_MINIMUM || small(children.missing)
    || children.values.some(v => small(v.count) || small(eligible.length - v.count));
  profiles["Children in household"] = {
    suppressed: childSuppressed,
    values: childSuppressed ? [] : children.values,
    note: "Percentage of all completed respondents in each age band. People may select more than one band, so totals can exceed 100%.",
  };
  profiles["Journey after reflection"] = safeDistribution(eligible.map(row => row.journeyPost ? MATURITY_LABELS[row.journeyPost] : null));
  const changes = ["", "Growing significantly", "Growing a little", "About the same", "Fading somewhat", "Fading a lot"];
  profiles["Faith change"] = safeDistribution(eligible.map(row => row.spiritualChange ? changes[row.spiritualChange] : null));
  return {
    version: 1,
    note: "Pathway results are separated by survey version. Percentages show answers of 4 or 5 to each retained statement. Short-form and full-form pathway results are not directly comparable. Journey and demographic profiles combine completed responses, not pathway scores. Small or identifying breakdowns are withheld.",
    respondentCount: eligible.length < PRIVACY_MINIMUM ? null : eligible.length,
    ...(split.incomplete.length ? { dataQualityNote: "Incomplete or unrecognized response patterns were excluded from reporting." } : {}),
    profiles, cohorts,
  };
}

export { PRIVACY_MESSAGE };
