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

/** Single-select topics shown in the live respondent breakdown, in display order. */
export const BREAKDOWN_TOPICS = [
  { key: "gender", title: "Gender", options: ["Male", "Female"] },
  { key: "age", title: "Age", options: ["16-19", "20-29", "30-39", "40-49", "50-59", "60 and older"] },
  { key: "relationship", title: "Relationship status", options: ["Independent single", "Single in relationship", "Married", "Married but separated", "Civil legal partnership", "Divorced"] },
  { key: "attendance", title: "Attendance at church gatherings", options: ["Every week", "A few times/month", "Monthly", "Every few months", "Infrequently or never"] },
  { key: "tenure", title: "Time involved in this church", options: ["Less than 1 year", "1-2 years", "3-5 years", "6-10 years", "11 or more years"] },
  { key: "smallGroup", title: "Small group participation", options: ["Every week", "A few times/month", "Monthly", "Every few months", "Infrequently or never"] },
  { key: "volunteer", title: "Volunteering in ministries", options: ["Every week", "A few times/month", "Monthly", "Every few months", "Infrequently or never"] },
] as const;
export type BreakdownTopicKey = (typeof BREAKDOWN_TOPICS)[number]["key"];
export type BreakdownRows = { label: string; count: number }[];

export interface ResponseBreakdown {
  suppressed?: Partial<Record<BreakdownTopicKey, boolean>>;
  total: number;
  gender: BreakdownRows;
  age: BreakdownRows;
  relationship?: BreakdownRows;
  attendance?: BreakdownRows;
  tenure?: BreakdownRows;
  smallGroup?: BreakdownRows;
  volunteer?: BreakdownRows;
}
