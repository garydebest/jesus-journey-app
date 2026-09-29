import { SURVEY_ITEMS } from "../shared/surveyItems";
import { SHORT_FORM_CODES } from "../shared/shortForm";
import type { ResponseRow } from "../shared/schema";

export function makeSyntheticResponse(short = true, index = 0): ResponseRow {
  return {
    ...Object.fromEntries(SURVEY_ITEMS.map((item, j) => [item.code.toLowerCase(), short && !SHORT_FORM_CODES.includes(item.code) ? null : 1 + (j + index) % 5])),
    journeyPre: short ? 1 + index % 2 : 3 + index % 3,
    journeyPost: 3 + index % 3, spiritualChange: 1 + index % 3,
    gender: index % 2 ? "Male" : "Female",
    ageGroup: index % 2 ? "30-39" : "40-49", relationshipStatus: "Married",
    attendanceFrequency: "Every week", tenure: "3-5 years",
    smallGroupFrequency: "Monthly", volunteerFrequency: "Monthly",
    childrenInHousehold: '["None"]', raceEthnicity: "White/Caucasian",
    commentText: "More opportunities to learn and pray together would help.",
    respondentId: `synthetic-${short ? "short" : "full"}-${index}`, waveId: "synthetic",
    createdAt: new Date("2026-09-28T00:00:00Z"),
  } as ResponseRow;
}

export const mixedRows = [
  ...Array.from({ length: 15 }, (_, i) => makeSyntheticResponse(true, i)),
  ...Array.from({ length: 30 }, (_, i) => makeSyntheticResponse(false, i)),
];
