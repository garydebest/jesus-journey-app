import { SURVEY_ITEMS } from "@shared/surveyItems";
import { DEMOGRAPHICS } from "@shared/questions";

export type Step =
  | "intro"
  | "pre-maturity"
  | { kind: "item"; index: number }
  | "post-maturity"
  | "change"
  | { kind: "demo"; index: number }
  | "review"
  | "report";

export interface SurveyState {
  preMaturity?: number;
  postMaturity?: number;
  change?: number;
  items: Record<string, number>;
  demographics: Record<string, string | string[]>;
}

export function emptyState(): SurveyState {
  return { items: {}, demographics: {} };
}

export const TOTAL_ITEM_STEPS = SURVEY_ITEMS.length;
export const TOTAL_DEMO_STEPS = DEMOGRAPHICS.length;

/** Flattened step order for progress calculation: pre-maturity, 63 items, post-maturity, change, 9 demo. */
export const TOTAL_STEPS = 1 + TOTAL_ITEM_STEPS + 1 + 1 + TOTAL_DEMO_STEPS;

export function stepIndexOf(step: Step): number {
  if (step === "intro") return 0;
  if (step === "pre-maturity") return 1;
  if (typeof step === "object" && step.kind === "item") return 2 + step.index;
  if (step === "post-maturity") return 2 + TOTAL_ITEM_STEPS;
  if (step === "change") return 3 + TOTAL_ITEM_STEPS;
  if (typeof step === "object" && step.kind === "demo") return 4 + TOTAL_ITEM_STEPS + step.index;
  if (step === "review") return TOTAL_STEPS;
  return TOTAL_STEPS;
}
