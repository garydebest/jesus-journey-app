import { z } from "zod";
import { TIMELINE_PHASES } from "./timeline";

// This is a public demo account ID, not a credential. Never infer demo access
// from a church's editable name or contact email.
export const DEMO_CHURCH_ID = "fb55072c-3b29-49e8-9bc7-ee77b1393f4a";
export const isDemoChurch = (id: string) => id === DEMO_CHURCH_ID;

export const calendarDate = z.string().refine((value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + "T12:00:00Z");
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, "Enter a valid calendar date.");

export const surveyPlanSchema = z.object({
  opensAt: calendarDate.or(z.literal("")),
  closesAt: calendarDate.or(z.literal("")),
  minSampleSize: z.number().int().min(16).max(1000000),
  overrides: z.record(z.string(), calendarDate).refine(
    (values) => Object.keys(values).every((key) =>
      TIMELINE_PHASES.some((p) => p.key === key && key !== "full_launch" && key !== "survey_closes")),
    "Unknown or anchored action-plan step.",
  ),
}).refine((plan) => !plan.opensAt || !plan.closesAt || plan.closesAt >= plan.opensAt, {
  message: "The closing date cannot be before the start date.",
});
export type SurveyPlan = z.infer<typeof surveyPlanSchema>;
export const emptySurveyPlan = (): SurveyPlan => ({ opensAt: "", closesAt: "", minSampleSize: 16, overrides: {} });

export function acceptsResponses(wave: { status: string; paymentStatus: string }) {
  return wave.paymentStatus === "paid" && ["live", "prep", "closing_soon"].includes(wave.status);
}

export interface ResponseBreakdown {
  total: number;
  gender: { label: string; count: number }[];
  age: { label: string; count: number }[];
}
