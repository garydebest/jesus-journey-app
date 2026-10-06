// Phase 1 client-journey resource library. Every href here must exist in
// client/public; script/journey-resources-qa.ts fails the build check if a
// listed file is missing, so unavailable content is hidden, never linked.

export interface JourneyResource { label: string; href: string; format: "PDF" | "Word" }
const base = "/resources/client-journey";

export const JOURNEY_RESOURCES = {
  coordinatorGuide: { label: "Survey Coordinator Guide", href: `${base}/prepare/jesus-journey-survey-coordinator-guide.pdf`, format: "PDF" },
  orientationWorksheet: { label: "Orientation Preparation Worksheet", href: `${base}/prepare/jesus-journey-orientation-preparation-worksheet.pdf`, format: "PDF" },
  leadershipBriefing: { label: "Leadership Briefing Guide", href: `${base}/prepare/jesus-journey-leadership-briefing-guide.pdf`, format: "PDF" },
  readinessChecklist: { label: "Survey Readiness Checklist", href: `${base}/prepare/jesus-journey-survey-readiness-checklist.pdf`, format: "PDF" },
  launchKitPdf: { label: "Launch Communications Kit", href: `${base}/launch/jesus-journey-launch-communications-kit.pdf`, format: "PDF" },
  launchKitDocx: { label: "Launch Communications Kit, editable", href: `${base}/launch/jesus-journey-launch-communications-kit.docx`, format: "Word" },
  monitoringGuide: { label: "Response Monitoring Guide", href: `${base}/collect/jesus-journey-response-monitoring-guide.pdf`, format: "PDF" },
  closingChecklist: { label: "Survey Closing Checklist", href: `${base}/collect/jesus-journey-survey-closing-checklist.pdf`, format: "PDF" },
  debriefPrep: { label: "Report-Reading and Debrief Preparation Guide", href: `${base}/interpret/jesus-journey-results-debrief-preparation-guide.pdf`, format: "PDF" },
} satisfies Record<string, JourneyResource>;

export const PREPARE_CHECKLIST = [
  "We have booked or completed the Jesus Journey Survey Orientation.",
  "We have named a Survey Coordinator.",
  "We have confirmed the total number of adults age 16 and over who will be invited.",
  "We have selected planned opening and closing dates.",
  "We have reviewed the Survey Action Plan.",
  "We have briefed senior leaders and prepared communications.",
  "We have a paper/accessibility support plan.",
  "We understand that activation begins accepting responses immediately.",
  "We understand that the planned closing date does not automatically close the survey.",
  "We understand that normal closure requires at least 50% participation of adults age 16 and over.",
];

export const CLOSING_CHECKLIST = [
  "We have reached the required response threshold.",
  "We have reviewed participation and believe people have had a fair opportunity to respond.",
  "We have sent a final reminder.",
  "We have confirmed that key leaders are ready to receive results.",
  "We understand that closing ends response collection.",
  "We understand that the planned closing date does not close the survey automatically.",
  "We are ready to review reports and book the results debrief.",
];

export const DEBRIEF_PREP_STEPS = [
  "Read the Church Report.",
  "Read the Comments Report, if available.",
  "Note two strengths you want to celebrate.",
  "Note two questions you want to understand better.",
  "Come ready to listen, pray, and learn together.",
];
