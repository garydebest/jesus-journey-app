import { safeDemographicCounts, DEMOGRAPHIC_MIN_N, disclosed } from "./demographicPolicy";

/** Copy-on-read projection also covers old snapshots without changing saved rows. */
export function projectDemographicSummary<T>(input: T): T {
  const summary = structuredClone(input) as any;
  if (!summary || typeof summary !== "object") return input;
  const population = summary.respondentCount ?? 0;
  if (summary.demographics) {
    for (const [field, counts] of Object.entries(summary.demographics)) {
      // Imported percentage-only historical summaries cannot prove category n.
      summary.demographics[field] = safeDemographicCounts(counts as Record<string, number>, population);
    }
  }
  if (summary.children) {
    const safe = safeDemographicCounts(Object.fromEntries(summary.children.values.map((v: any) => [v.label, v.count])), population, true);
    summary.children.values = summary.children.values.filter((v: any) => v.label in safe);
    summary.children.missing = 0;
  }
  if (summary.cohortReporting) summary.cohortReporting = projectCohortDemographics(summary.cohortReporting);
  return summary;
}
export function projectCohortDemographics<T>(input: T): T {
  const cohort = structuredClone(input) as any;
  if (!cohort?.profiles) return input;
  for (const [name, value] of Object.entries(cohort.profiles) as [string, any][]) {
    if (["Journey after reflection", "Faith change"].includes(name)) continue;
    const safe = safeDemographicCounts(Object.fromEntries(value.values.map((v: any) => [v.label, v.count])), cohort.respondentCount ?? 0,
      ["Children in household", "Race / ethnicity"].includes(name));
    value.values = value.values.filter((v: any) => disclosed(v.label) && v.count >= DEMOGRAPHIC_MIN_N && v.label in safe);
    value.suppressed = !value.values.length;
  }
  return cohort;
}
