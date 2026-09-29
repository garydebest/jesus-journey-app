/** Demographic display/storage/reporting policy. No location is a response field. */
export const DEMOGRAPHIC_MIN_N = 10;
export const PREFER_NOT_TO_SAY = "Prefer not to say";
export const DEMOGRAPHIC_PRIVACY_NOTE =
  "Demographic answers are used only in aggregate church reporting. Categories with fewer than 10 respondents are not shown. Additional results may be withheld to protect confidentiality. Missing answers and Prefer not to say are excluded from comparisons.";
export type EthnicityPreset = "canada" | "usa" | "uk" | "international";
export const ETHNICITY_PRESETS: Record<EthnicityPreset, string[]> = {
  canada: ["White", "Black", "First Nations, Métis, or Inuit", "East Asian", "South Asian", "Southeast Asian", "Middle Eastern / West Asian", "Latin American", "Another background", "Multiple backgrounds", PREFER_NOT_TO_SAY],
  usa: ["White", "Black or African American", "Hispanic or Latino/a/x", "Indigenous / Native American / Alaska Native", "Asian", "Native Hawaiian or Pacific Islander", "Middle Eastern or North African", "Another background", "Multiple backgrounds", PREFER_NOT_TO_SAY],
  uk: ["White British, Irish, or other White background", "Asian or Asian British", "Black, Black British, Caribbean, or African", "Mixed or multiple ethnic backgrounds", "Arab", "Gypsy, Roma, or Traveller", "Another ethnic background", PREFER_NOT_TO_SAY],
  international: ["White / European background", "Black / African background", "Asian background", "Middle Eastern / North African background", "Latin American background", "Indigenous background", "Multiple backgrounds", "Another background", PREFER_NOT_TO_SAY],
};
export function ethnicityPresetForCountry(country: unknown): EthnicityPreset {
  const presets: Record<string, EthnicityPreset> = { CA: "canada", US: "usa", GB: "uk" };
  return presets[String(country ?? "").trim().toUpperCase()] ?? "international";
}
export function disclosed(value: unknown): value is string {
  return typeof value === "string" && !!value.trim() && !/^(prefer not to say|not answered|not_disclosed)$/i.test(value.trim());
}
/** No comma splitting: several ethnicity labels contain commas. */
export function parseMulti(raw: unknown): string[] {
  let value = raw;
  if (typeof raw === "string") {
    if (!raw.trim()) return [];
    try { value = JSON.parse(raw); } catch { value = [raw]; }
  }
  const values = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
  if (values.some(v => typeof v === "string" && !disclosed(v))) return [];
  return Array.from(new Set(values.filter(disclosed)));
}
const ETHNICITY_GROUPS: Record<string, { label: string; aliases: string[] }> = {
  white: { label: "White / European background", aliases: ["White", "White/Caucasian", "White British, Irish, or other White background", "White / European background"] },
  black: { label: "Black / African background", aliases: ["Black", "Black/African descent", "Black or African American", "Black, Black British, Caribbean, or African", "Black / African background"] },
  indigenous: { label: "Indigenous background", aliases: ["First Nations, Métis, or Inuit", "Native People/First Nations", "First Nations", "Indigenous / Native American / Alaska Native", "Indigenous background"] },
  asian: { label: "Asian background (unspecified)", aliases: ["Asian", "Asian descent", "Asian or Asian British", "Asian background"] },
  east_asian: { label: "East Asian", aliases: ["East Asian"] },
  south_asian: { label: "South Asian", aliases: ["South Asian", "East Indian descent", "Indian descent"] },
  southeast_asian: { label: "Southeast Asian", aliases: ["Southeast Asian"] },
  middle_eastern_west_asian: { label: "Middle Eastern / West Asian", aliases: ["Middle Eastern / West Asian"] },
  mena: { label: "Middle Eastern / North African", aliases: ["Middle Eastern or North African", "Middle Eastern / North African background"] },
  arab: { label: "Arab", aliases: ["Arab"] },
  latin_american: { label: "Latin American / Hispanic background", aliases: ["Latin American", "Latin American background", "Hispanic descent", "Hispanic or Latino/a/x"] },
  pacific: { label: "Native Hawaiian or Pacific Islander", aliases: ["Native Hawaiian or Pacific Islander"] },
  traveller: { label: "Gypsy, Roma, or Traveller", aliases: ["Gypsy, Roma, or Traveller"] },
  multiple: { label: "Multiple backgrounds", aliases: ["Multiple backgrounds", "Mixed or multiple ethnic backgrounds", "From multiple races"] },
  other: { label: "Another background", aliases: ["Another background", "Another ethnic background"] },
};
export const ETHNICITY_IDS = Object.keys(ETHNICITY_GROUPS);
export function ethnicityIds(raw: unknown): string[] {
  return Array.from(new Set(parseMulti(raw).map(value => ETHNICITY_IDS.find(id =>
    id === value || ETHNICITY_GROUPS[id].aliases.includes(value))).filter((id): id is string => !!id)));
}
export function ethnicityLabels(raw: unknown): string[] {
  return ethnicityIds(raw).map(id => ETHNICITY_GROUPS[id].label);
}
export function encodeEthnicity(raw: unknown): string | null {
  // Non-disclosure need not be persisted as a comparison category.
  const ids = ethnicityIds(raw);
  return ids.length ? JSON.stringify(ids) : null;
}
export function toggleExclusive(values: string[], option: string, exclusive = PREFER_NOT_TO_SAY): string[] {
  if (values.includes(option)) return values.filter(v => v !== option);
  return option === exclusive ? [option] : [...values.filter(v => v !== exclusive), option];
}
const small = (n: number) => n > 0 && n < DEMOGRAPHIC_MIN_N;
/** Withhold a single-select distribution if a residual category is inferable. */
export function safeDemographicCounts(counts: Record<string, number>, population: number, multi = false): Record<string, number> {
  const entries = Object.entries(counts).filter(([key, n]) => disclosed(key) && n > 0);
  const answered = entries.reduce((sum, [, n]) => sum + n, 0);
  if (population < DEMOGRAPHIC_MIN_N) return {};
  if (!multi && (entries.some(([, n]) => small(n)) || small(population - answered))) return {};
  return Object.fromEntries(entries.filter(([, n]) => n >= DEMOGRAPHIC_MIN_N && !small(population - n)));
}
export function demographicCounts(values: (string | null | undefined)[], population = values.length) {
  const counts: Record<string, number> = {};
  for (const value of values) if (disclosed(value)) counts[value] = (counts[value] ?? 0) + 1;
  return safeDemographicCounts(counts, population);
}
