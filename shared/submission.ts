import { z } from "zod";
import { surveyItemsFor } from "./shortForm";
import { ETHNICITY_PRESETS, ETHNICITY_IDS, ethnicityIds, PREFER_NOT_TO_SAY } from "./demographicPolicy";

const ethnicAnswer = z.string().refine(v => v === PREFER_NOT_TO_SAY || ETHNICITY_IDS.includes(v) ||
  Object.values(ETHNICITY_PRESETS).some(options => options.includes(v)) || ethnicityIds(v).length > 0,
  "Please choose a listed background.");

const answer = z.number().int().min(1).max(5);
export const submitResponseSchema = z.object({
  joinCode: z.string().min(1),
  items: z.record(z.string(), answer),
  journeyPre: answer,
  journeyPost: answer,
  spiritualChange: answer,
  demographics: z.object({
    gender: z.string().optional(),
    age: z.string().optional(),
    relationship: z.string().optional(),
    attendance: z.string().optional(),
    tenure: z.string().optional(),
    smallgroup: z.string().optional(),
    volunteer: z.string().optional(),
    children: z.array(z.string()).optional(),
    // Accept old clients' single text value; new clients submit a selection array.
    ethnicity: z.union([ethnicAnswer, z.array(ethnicAnswer).max(20)]).optional(),
  }).optional(),
  comment: z.string().optional(),
}).superRefine((data, ctx) => {
  const required = new Set(surveyItemsFor(data.journeyPre).map(item => item.code));
  for (const code of Array.from(required)) {
    if (!(code in data.items)) ctx.addIssue({ code: "custom", path: ["items", code], message: "Please answer every displayed statement." });
  }
  for (const code of Object.keys(data.items)) {
    if (!required.has(code)) ctx.addIssue({ code: "custom", path: ["items", code], message: "Statement is not part of this survey version." });
  }
});
