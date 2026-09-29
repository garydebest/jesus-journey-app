import type { DebriefingReport } from "./types";
import { DEMOGRAPHIC_MIN_N, disclosed, safeDemographicCounts } from "../demographicPolicy";
import { projectCohortDemographics } from "../demographicProjection";

// Read-time projection only: archived analysis is never mutated or migrated.
// The old engine copied dimension findings into summary and cross-cutting lists,
// so removing the rollup table alone is not sufficient.
const legacyText = /\bdimensions?\b|relationships\s*(?:&|and)\s*growth|stated belief runs ahead|practice keeps pace with/i;
const legacySection = /^(?:Beliefs & Practices|Dimensions?|Dimension-Level View)$/i;
const omittedKeys = new Set(["dimensions", "pairedPresentation", "suggestedDebriefQuestions"]);

export function projectReportForDisplay(report: DebriefingReport): DebriefingReport {
  report = structuredClone(report);
  report.demographics = (report.demographics ?? []).map(section => {
    const safe = safeDemographicCounts(Object.fromEntries(section.breakdown.map(r => [r.group, r.n])),
      report.respondentCount, section.id === "raceEthnicity");
    return { ...section, breakdown: section.breakdown.filter(row => disclosed(row.group) && row.group in safe) };
  }).filter(section => section.breakdown.length);
  if (report.cohortReporting) report.cohortReporting = projectCohortDemographics(report.cohortReporting);
  const allowed = new Set(report.demographics.flatMap(d => d.breakdown.map(r => r.group)));
  function clean(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.filter(item => {
        if (typeof item === "string") return !legacyText.test(item);
        if (!item || typeof item !== "object") return true;
        const entry = item as Record<string, unknown>;
        // Legacy prose lacks reliable machine-readable denominators. Withhold
        // it rather than try to infer n from English text or rounded percentages.
        if (/^Demographic|^Engagement$/i.test(String(entry.section ?? ""))) {
          if (typeof entry.demographicN !== "number" || entry.demographicN < DEMOGRAPHIC_MIN_N ||
              !allowed.has(String(entry.demographicGroup ?? ""))) return false;
        }
        return !legacySection.test(String(entry.section ?? "")) &&
          !legacyText.test(`${entry.headline ?? ""} ${entry.detail ?? ""}`);
      }).map(clean);
    }
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(Object.entries(value).filter(([key]) => !omittedKeys.has(key))
      .map(([key, item]) => [key, key === "analysisScope" && typeof item === "string"
        ? item.replace("pathway, dimension, or bottleneck", "pathway or bottleneck")
        : clean(item)]));
  }
  return clean(report) as DebriefingReport;
}
