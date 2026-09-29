import type { DebriefingReport } from "./types";

// Read-time projection only: archived analysis is never mutated or migrated.
// The old engine copied dimension findings into summary and cross-cutting lists,
// so removing the rollup table alone is not sufficient.
const legacyText = /\bdimensions?\b|relationships\s*(?:&|and)\s*growth|stated belief runs ahead|practice keeps pace with/i;
const legacySection = /^(?:Beliefs & Practices|Dimensions?|Dimension-Level View)$/i;
const omittedKeys = new Set(["dimensions", "pairedPresentation"]);

export function projectReportForDisplay(report: DebriefingReport): DebriefingReport {
  function clean(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.filter(item => {
        if (typeof item === "string") return !legacyText.test(item);
        if (!item || typeof item !== "object") return true;
        const entry = item as Record<string, unknown>;
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
