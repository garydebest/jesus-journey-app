import type { ResponseRow } from "../schema";
import type { DemographicBreakdownRow, DemographicSection, Insight } from "./types";
import { mean, round2, pct, meetsSampleFloor, isMaterial } from "./helpers";

interface DemoFieldDef {
  id: string;
  title: string;
  field: keyof ResponseRow;
}

// children_in_household is JSON-encoded (array), everything else here is a plain
// text category — handled separately below.
const SIMPLE_FIELDS: DemoFieldDef[] = [
  { id: "gender", title: "Gender", field: "gender" },
  { id: "ageGroup", title: "Age Group", field: "ageGroup" },
  { id: "relationshipStatus", title: "Relationship Status", field: "relationshipStatus" },
  { id: "attendanceFrequency", title: "Attendance Frequency", field: "attendanceFrequency" },
  { id: "tenure", title: "Tenure at Church", field: "tenure" },
  { id: "smallGroupFrequency", title: "Small Group Participation", field: "smallGroupFrequency" },
  { id: "volunteerFrequency", title: "Volunteering Frequency", field: "volunteerFrequency" },
  { id: "raceEthnicity", title: "Race / Ethnicity", field: "raceEthnicity" },
];

const GROWING_VALUES = new Set([1, 2]); // "growing significantly" / "growing a little"
const FADING_VALUES = new Set([4, 5]); // "fading somewhat" / "fading a lot"

function buildBreakdown(rows: ResponseRow[], groupValue: (r: ResponseRow) => string | null, churchAvgMaturity: number): DemographicBreakdownRow[] {
  const groups = new Map<string, ResponseRow[]>();
  for (const r of rows) {
    const g = groupValue(r);
    if (!g) continue;
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g)!.push(r);
  }
  const total = rows.length;
  const out: DemographicBreakdownRow[] = [];
  for (const [group, groupRows] of Array.from(groups.entries())) {
    const n = groupRows.length;
    const maturityValues = groupRows.map((r) => r.journeyPost).filter((v): v is number => typeof v === "number");
    const changeValues = groupRows.map((r) => r.spiritualChange).filter((v): v is number => typeof v === "number");
    const avgMaturity = maturityValues.length > 0 ? round2(mean(maturityValues)) : 0;
    out.push({
      group,
      n,
      pctOfChurch: pct(n, total),
      avgMaturity,
      maturityVsChurch: round2(avgMaturity - churchAvgMaturity),
      growingPct: pct(changeValues.filter((v) => GROWING_VALUES.has(v)).length, changeValues.length),
      fadingPct: pct(changeValues.filter((v) => FADING_VALUES.has(v)).length, changeValues.length),
      directionalOnly: !meetsSampleFloor(n),
    });
  }
  return out.sort((a, b) => b.n - a.n);
}

function insightsForSection(sectionTitle: string, breakdown: DemographicBreakdownRow[]): Insight[] {
  const insights: Insight[] = [];
  for (const row of breakdown) {
    if (!isMaterial(row.maturityVsChurch)) continue;
    const kind = row.maturityVsChurch > 0 ? "strength" : "opportunity";
    const direction = row.maturityVsChurch > 0 ? "above" : "below";
    insights.push({
      kind,
      headline:
        kind === "strength"
          ? `${row.group} (${sectionTitle}) is a bright spot — running ${Math.abs(row.maturityVsChurch)} points ${direction} the church average in spiritual maturity.`
          : `${row.group} (${sectionTitle}) is running ${Math.abs(row.maturityVsChurch)} points ${direction} the church average in spiritual maturity.`,
      detail: `${row.n} respondents (${row.pctOfChurch}% of the group) average ${row.avgMaturity} on the maturity scale, vs. the church-wide average. ${row.growingPct}% report they're currently growing; ${row.fadingPct}% report fading.`,
      corroboration: 1,
      directionalOnly: row.directionalOnly,
      section: `Demographics — ${sectionTitle}`,
    });
  }
  return insights;
}

export function analyzeDemographics(rows: ResponseRow[]): DemographicSection[] {
  const churchMaturity = rows.map((r) => r.journeyPost).filter((v): v is number => typeof v === "number");
  const churchAvgMaturity = churchMaturity.length > 0 ? round2(mean(churchMaturity)) : 0;

  const sections: DemographicSection[] = [];

  for (const def of SIMPLE_FIELDS) {
    const breakdown = buildBreakdown(rows, (r) => (r[def.field] as string | null) ?? null, churchAvgMaturity);
    if (breakdown.length === 0) continue;
    sections.push({
      id: def.id,
      title: def.title,
      breakdown,
      insights: insightsForSection(def.title, breakdown),
    });
  }

  // Singles vs. married — combine the two "single" relationship-status
  // options into one group, keep "Married" as its own group. Separated,
  // partnership, and divorced are intentionally left out of this grouping
  // (they still appear individually under the full "Relationship Status"
  // section above).
  const SINGLE_VALUES = new Set(["Independent single", "Single in relationship"]);
  const singlesMarriedGroups = rows.map((r) => {
    const v = r.relationshipStatus;
    if (v && SINGLE_VALUES.has(v)) return "Single";
    if (v === "Married") return "Married";
    return null;
  });
  const singlesMarriedBreakdown = buildBreakdown(
    rows.map((r, i) => ({ ...r, __smLabel: singlesMarriedGroups[i] }) as unknown as ResponseRow),
    (r) => (r as unknown as { __smLabel: string | null }).__smLabel,
    churchAvgMaturity,
  );
  if (singlesMarriedBreakdown.length > 0) {
    sections.push({
      id: "singlesVsMarried",
      title: "Singles vs. Married",
      breakdown: singlesMarriedBreakdown,
      insights: insightsForSection("Singles vs. Married", singlesMarriedBreakdown),
    });
  }

  // children_in_household is a JSON-encoded string array — decode and treat
  // "has children in household" as a boolean group rather than exploding into
  // every combination of ages.
  const childrenGroups = rows.map((r) => {
    let hasChildren = false;
    if (r.childrenInHousehold) {
      try {
        const parsed = JSON.parse(r.childrenInHousehold);
        hasChildren = Array.isArray(parsed) && parsed.length > 0 && !parsed.every((v) => String(v).toLowerCase() === "none");
      } catch {
        hasChildren = r.childrenInHousehold.length > 0 && r.childrenInHousehold.toLowerCase() !== "none";
      }
    }
    return hasChildren ? "Has children in household" : "No children in household";
  });
  const childrenBreakdown = buildBreakdown(
    rows.map((r, i) => ({ ...r, __childLabel: childrenGroups[i] }) as unknown as ResponseRow),
    (r) => (r as unknown as { __childLabel: string }).__childLabel,
    churchAvgMaturity,
  );
  if (childrenBreakdown.length > 0) {
    sections.push({
      id: "childrenInHousehold",
      title: "Children in Household",
      breakdown: childrenBreakdown,
      insights: insightsForSection("Children in Household", childrenBreakdown),
    });
  }

  return sections;
}
