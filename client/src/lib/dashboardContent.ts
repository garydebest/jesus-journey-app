// Content for the church dashboard's Prepare / Collect / Interpret / Act / Resources
// tabs. Short-form copy below is ported verbatim (or lightly summarized where the
// source used bullet lists) from the approved jj-public-site/dashboard.html mockup.
// Long-form "full document" text lives in fullDocs.generated.ts and is referenced
// here by index (see FULL_DOCS in that file) to guarantee it stays byte-identical
// to the original 2017/2019 source material.

export interface InfoCard {
  icon: "understanding" | "steps" | "keys" | "starting" | "monitoring" | "paper" | "report" | "comments" | "resource";
  title: string;
  body?: string;
  bullets?: string[];
  steps?: { label: string; text: string }[];
  statCallout?: string;
  highlight?: boolean;
  fullDocIndexes?: number[];
  ctaLabel?: string;
  ctaHref?: string;
  note?: string;
}

export const PREPARE_CARDS: InfoCard[] = [
  {
    icon: "understanding",
    title: "Understanding the Survey",
    body: "The survey looks at spiritual growth as a three-stranded cord: belief, experience, and action — woven into four Journey Goals, each broken into four pathways.",
    bullets: [
      "Starting conversation is the goal — not final answers. Results catalyze discussion, not solutions.",
      "A snapshot, not a movie: this shows where you are right now. Re-survey in ~2 years to see movement.",
      "No comparisons between churches or individuals — every community is at a different stage.",
    ],
    fullDocIndexes: [0],
  },
  {
    icon: "steps",
    title: "Step-by-Step to Success",
    steps: [
      { label: "Early prep", text: "leadership reviews the dashboard, prays over your church's needs, picks a survey coordinator." },
      { label: "Survey prep", text: "brief elders/deacons, draft announcements & bulletin text, set a 2-week promotion + 2-week collection schedule." },
      { label: "Implementation", text: "announce 2 weeks out, have leaders take it first, launch Sunday, monitor daily, thank everyone at close." },
    ],
    fullDocIndexes: [1],
  },
  {
    icon: "keys",
    title: "Keys to Success",
    highlight: true,
    statCallout: "50%+ response is representative and trustworthy. Below 25% is not reliable enough to act on.",
    bullets: [
      "Lead pastor support before, during, and after — non-negotiable.",
      "Everyone 16+ can take it — reassure people their answers are anonymous.",
      "Takes 10–15 minutes; every respondent gets a private personal report.",
      "Reporting back to the church afterward validates their participation — skipping this undermines future surveys.",
    ],
    fullDocIndexes: [2],
  },
];

export const COLLECT_CARDS: InfoCard[] = [
  {
    icon: "starting",
    title: "Starting a survey",
    steps: [
      { label: "Soft launch", text: "with leaders one week early." },
      { label: "Full launch", text: "with the whole church — announce, promote, share the join code." },
      { label: "Paper option", text: "for those without easy device access (see below)." },
    ],
    fullDocIndexes: [3],
  },
  {
    icon: "monitoring",
    title: "Monitoring & readiness",
    body: "Target a 50% response rate — the denominator is total people invited, not just those who started. Watch subgroups (gender, age band) for gaps.",
    note: "Reports unlock once you hit your end date and the 50% minimum — whichever comes later.",
    fullDocIndexes: [4, 5],
  },
  {
    icon: "paper",
    title: "Paper survey option",
    body: "For anyone who finds a screen difficult. Every question must be answered by hand, then entered online by a volunteer — blank answers can't be entered.",
    ctaLabel: "Download paper survey",
    ctaHref: "/jesus-journey-paper-survey.pdf",
    fullDocIndexes: [6],
  },
];

export const INTERPRET_CARDS: InfoCard[] = [
  {
    icon: "report",
    title: "Church Report",
    body: "Numbers & graphs",
    bullets: [
      "Check sample size first — relative to church size, before drawing any conclusions.",
      "Remember: numbers are people. Every percentage represents someone on a real journey.",
      "Review the 5 stages of spiritual maturity, then the maturity profile by group.",
      "Compare maturity and spiritual change against demographics — but go carefully when a subgroup's sample size is small.",
      "Examine each of the four Journey Goals — Trusting, Experiencing, Reflecting, and Serving Jesus — through the lens of the maturity stages.",
      "Finish by naming your three greatest strengths and three growth opportunities.",
    ],
    fullDocIndexes: [7],
  },
  {
    icon: "comments",
    title: "Comments Report",
    body: "Open-ended answers",
    bullets: [
      "Read with prayerful eyes — resist scanning only for the extremes.",
      "Look for differences by spiritual-maturity stage: what is each group asking for?",
      "Compare by gender — what themes are distinct to women vs. men?",
      "Look for recurring key words and phrases across responses.",
      "Watch for generational themes — young adults, parents, and older adults often surface different needs.",
    ],
    fullDocIndexes: [8],
  },
];

export const INTERPRET_CALLOUT = {
  title: "Guiding principle: numbers are people",
  body: "A score of 3 (\u201coften true of me\u201d) on prayer life could be a strong sign of growth for someone new to faith — or a plateau for someone who considers themselves Jesus-centered. Always read a score alongside where that person or group already is on their journey, and never compare your church's numbers to another church's.",
};

export interface ActStep {
  number: number;
  title: string;
  meta: string;
  body: string;
  fullDocIndex: number;
}

export const ACT_STEPS: ActStep[] = [
  {
    number: 1,
    title: "Debriefing preparation",
    meta: "Day 1 · Senior pastor + 1–2 key leaders · ~4 hours",
    body: "Work through the church report page by page right after the survey closes. Use the report as a checklist: sample size, demographic strengths and opportunities, the 5 stages of maturity, and the four Journey Goals — Trusting, Experiencing, Reflecting, Serving. Look first for strengths, then for growth opportunities.",
    fullDocIndex: 9,
  },
  {
    number: 2,
    title: "Debriefing leadership sessions",
    meta: "Day 2 · Ministry staff / key leaders · ~4 hours",
    body: "Walk the wider staff through the same results using yesterday's notes. Start together on Trusting Jesus, then split into three groups for Experiencing, Reflecting, and Serving Jesus. Introduce the Comments Report, then plan the next month, including core-community and town-hall meetings.",
    fullDocIndex: 10,
  },
  {
    number: 3,
    title: "Engaging the church",
    meta: "Within 1–2 weeks · Core community, then whole church",
    body: "Never build strategy from data alone — bring the actual people back in. Start with an invite-only core-community meeting (7–9pm: 45 min review, 30 min small-group discussion, 45 min report-back). Follow with town halls or focus groups, and a Sunday message naming your three greatest strengths and three growth opportunities.",
    fullDocIndex: 11,
  },
  {
    number: 4,
    title: "Making a plan",
    meta: "Following weeks · Staff / leaders retreat",
    body: "Set goals for a 12–18 month window. Focus on outcomes, not programs — programs are scaffolding, not the building. Look for high-leverage \u201ckeys,\u201d build initiatives across three strands (inviting God in, involving fellow believers, drawing on outside wisdom), and re-evaluate at 6 months and 1 year. Plan to repeat the survey in about 18 months.",
    fullDocIndex: 12,
  },
];

export interface ResourceCard {
  icon: "curriculum" | "graphics" | "message";
  title: string;
  body: string;
  ctaLabel: string;
  fullDocIndex?: number;
}

export const RESOURCE_CARDS: ResourceCard[] = [
  {
    icon: "curriculum",
    title: "Small Group Curriculum",
    body: "Discussion guides to help groups reflect on their own results together.",
    ctaLabel: "Download",
  },
  {
    icon: "graphics",
    title: "Graphic Templates",
    body: "Promotional slides and bulletin graphics for announcing your survey.",
    ctaLabel: "Download",
  },
  {
    icon: "message",
    title: "Sample Message Outline",
    body: "A minimal Sunday-message outline for sharing strengths & opportunities — built to be personalized.",
    ctaLabel: "Download",
    fullDocIndex: 13,
  },
];
