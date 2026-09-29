import { ETHNICITY_PRESETS, PREFER_NOT_TO_SAY } from "./demographicPolicy";
// Maturity self-report options (used for Q1 pre-survey and Q9 post-survey restatement)
export const MATURITY_OPTIONS_PRE = [
  { value: 1, label: "I do not presently see Jesus as important to my life." },
  { value: 2, label: "I am exploring if and how Jesus fits into my life." },
  { value: 3, label: "I believe Jesus is real and I am trying to follow Jesus in some parts of my life." },
  { value: 4, label: "I am learning more and more to trust Jesus in many of the practical aspects of my life." },
  { value: 5, label: "I see Jesus as the center of my life and I am committed to becoming like Jesus in all parts of my life." },
];

export const MATURITY_OPTIONS_POST = [
  { value: 1, label: "I do not presently see Jesus as important to my life." },
  { value: 2, label: "I am exploring if and how Jesus fits into my life." },
  { value: 3, label: "I believe Jesus is important and I am trying to follow Jesus in some parts of my life." },
  { value: 4, label: "I am learning more and more to trust Jesus in many of the practical aspects of my life." },
  { value: 5, label: "I see Jesus as the center of my life and I am committed to becoming like Jesus in all parts of my life." },
];

export const MATURITY_LABELS = ["", "Distant", "Exploring", "Believing", "Trusting", "God Centered"];

export const CHANGE_OPTIONS = [
  { value: 1, label: "Growing significantly" },
  { value: 2, label: "Growing a little" },
  { value: 3, label: "About the same" },
  { value: 4, label: "Fading somewhat" },
  { value: 5, label: "Fading a lot" },
];

export const SCALE_LABELS = [
  { value: 1, label: "Never true of what I believe" },
  { value: 2, label: "Occasionally true" },
  { value: 3, label: "Quite often true" },
  { value: 4, label: "Most of the time true" },
  { value: 5, label: "Always true of what I believe" },
];

export const PRACTICE_SCALE_LABELS = [
  { value: 1, label: "Never or not yet true" },
  { value: 2, label: "Occasionally true" },
  { value: 3, label: "Quite often true" },
  { value: 4, label: "Most of the time true" },
  { value: 5, label: "Always true" },
];

// Use stable instrument codes, never the displayed short-form item number.
export function questionScale(code: string) {
  const belief = /^[BK][1-9]$/.test(code);
  return {
    prompt: belief ? "How often do you believe this to be true?" : "How true is this of you now?",
    labels: belief ? SCALE_LABELS : PRACTICE_SCALE_LABELS,
    kind: belief ? "belief" : "practice",
  };
}

export interface Demographic {
  id: string;
  question: string;
  type: "single" | "multi";
  options: string[];
}

export const DEMOGRAPHICS: Demographic[] = [
  { id: "gender", question: "Gender", type: "single", options: ["Male", "Female", PREFER_NOT_TO_SAY] },
  { id: "age", question: "Your age group", type: "single", options: ["16-19", "20-29", "30-39", "40-49", "50-59", "60 and older"] },
  { id: "relationship", question: "Relationship status", type: "single", options: ["Independent single", "Single in relationship", "Married", "Married but separated", "Civil legal partnership", "Divorced", PREFER_NOT_TO_SAY] },
  { id: "attendance", question: "How often are you now attending formal church gatherings (e.g. weekly meetings, Sunday services)?", type: "single", options: ["Every week", "A few times/month", "Monthly", "Every few months", "Infrequently or never"] },
  { id: "tenure", question: "Time involved in this church", type: "single", options: ["Less than 1 year", "1-2 years", "3-5 years", "6-10 years", "11 or more years"] },
  { id: "smallgroup", question: "How often do you gather with a small group of other Christians for encouragement on your spiritual journey?", type: "single", options: ["Every week", "A few times/month", "Monthly", "Every few months", "Infrequently or never"] },
  { id: "volunteer", question: "How often do you volunteer in one or more of the ministries of the church?", type: "single", options: ["Every week", "A few times/month", "Monthly", "Every few months", "Infrequently or never"] },
  { id: "children", question: "Presence of children in your household (check all that apply)", type: "multi", options: ["None", "0-2 year old(s)", "3-5 year old(s)", "6-10 year old(s)", "11-18 year old(s)", "19 or older"] },
  { id: "ethnicity", question: "Which ethnic, cultural, or racial background(s) best describe you? Select all that apply.", type: "multi", options: ETHNICITY_PRESETS.international },
];
