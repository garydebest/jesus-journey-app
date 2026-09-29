import config from "./shortFormConfig.json";
import { SURVEY_ITEMS } from "./surveyItems";
import { PATHWAYS } from "./pathways";
import type { ItemResponses } from "./scoring";

export const SHORT_FORM_CODES: readonly string[] = config.retained;
export const SHORT_PATHWAY_ITEMS = config.pathways as Record<string, string[]>;
export const SHORT_FORM_NOTE = "Because of the way you described your present journey with Jesus at the beginning of the survey, this reflection is based on a shorter set of questions designed for that stage of the journey.";
export const PRIVACY_MINIMUM = 5;
export const PRIVACY_MESSAGE = "Insufficient responses to protect confidentiality";
export const isShortForm = (initial?: number | null) => initial === 1 || initial === 2;
export const validAnswer = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 5;

export function surveyItemsFor(initial?: number | null) {
  return isShortForm(initial) ? SURVEY_ITEMS.filter(item => SHORT_FORM_CODES.includes(item.code)) : SURVEY_ITEMS;
}

export function retainedAnswers(items: ItemResponses, initial?: number | null): ItemResponses {
  return Object.fromEntries(surveyItemsFor(initial).filter(item => validAnswer(items[item.code])).map(item => [item.code, items[item.code]]));
}

export type MeasurementStatus = "measured" | "single_item" | "not_measured" | "insufficient_responses";
export function shortPathwayScores(items: ItemResponses) {
  return PATHWAYS.map(pathway => {
    const codes = SHORT_PATHWAY_ITEMS[pathway.num];
    const complete = codes.length > 0 && codes.every(code => validAnswer(items[code]));
    const status: MeasurementStatus = codes.length === 0 ? "not_measured" : !complete ? "insufficient_responses" : codes.length === 1 ? "single_item" : "measured";
    return {
      num: pathway.num, name: pathway.name, goal: pathway.goal,
      itemCount: codes.length, status,
      score: complete ? Math.round(codes.reduce((sum, code) => sum + items[code], 0) / codes.length * 100) / 100 : null,
    };
  });
}

export function selectShortPathways(items: ItemResponses) {
  const eligible = shortPathwayScores(items).filter((p): p is typeof p & { score: number } => p.score !== null);
  const strengths = [...eligible].sort((a, b) => b.score - a.score || a.num - b.num).slice(0, 3);
  const selected = new Set(strengths.map(p => p.num));
  const opportunities = eligible.filter(p => !selected.has(p.num)).sort((a, b) => a.score - b.score || a.num - b.num).slice(0, 3);
  return { strengths, opportunities };
}

export function itemResponseStatus(code: string, items: ItemResponses, initial?: number | null) {
  if (isShortForm(initial) && !SHORT_FORM_CODES.includes(code)) return "omitted_by_variant";
  return validAnswer(items[code]) ? "answered" : "unanswered";
}

// No schema migration or identifying data. Existing nullable columns plus the
// initial response encode the variant and omission status. Historical 63-item
// submissions made before branching existed must remain full-form observations,
// even if their opening answer was 1 or 2.
export function classifyStoredResponse(row: { journeyPre?: number | null; [key: string]: unknown }): "full" | "distant_exploring_short" | "incomplete" {
  if (SURVEY_ITEMS.every(item => validAnswer(row[item.code.toLowerCase()]))) return "full";
  if (isShortForm(row.journeyPre) &&
    SHORT_FORM_CODES.every(code => validAnswer(row[code.toLowerCase()])) &&
    SURVEY_ITEMS.filter(item => !SHORT_FORM_CODES.includes(item.code)).every(item => row[item.code.toLowerCase()] == null)) {
    return "distant_exploring_short";
  }
  return "incomplete";
}
