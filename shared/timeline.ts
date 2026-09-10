// ---------------------------------------------------------------------------
// Survey Action Plan — the calendarized, 14-phase step-by-step plan derived
// from the guide content already on the dashboard (Prepare / Collect /
// Interpret / Act tabs: "Step-by-Step to Success", "Keys to Success",
// "Starting Our Jesus Journey Survey", "Journey Survey Monitoring", and the
// four "Act" debriefing documents).
//
// Every phase is defined as a day offset from one of two anchors:
//   - "opens"  -> the wave's opensAt date
//   - "closes" -> the wave's closesAt date
// closesAt itself defaults to opensAt + DEFAULT_SURVEY_LENGTH_DAYS (14, per
// the guide's "2 weeks to prepare, then 2 weeks to complete") but can be
// extended independently if the 50% response threshold isn't met in time.
//
// Phases anchored to "opens" (prep/launch) are never reshuffled by a closesAt
// extension. Phases anchored to "closes" (debrief/act) shift automatically
// when closesAt moves, since they are defined relative to when the survey
// actually finishes collecting responses.
// ---------------------------------------------------------------------------

export const DEFAULT_SURVEY_LENGTH_DAYS = 14;

export type TimelineAnchor = "opens" | "closes";

export interface TimelinePhaseDef {
  key: string;
  order: number;
  anchor: TimelineAnchor;
  offsetDays: number; // negative = before anchor date, positive = after
  title: string;
  summary: string;
  sourceDoc: string; // which guide document this is drawn from, for the UI to link back to
}

export const TIMELINE_PHASES: TimelinePhaseDef[] = [
  {
    key: "early_prep",
    order: 1,
    anchor: "opens",
    offsetDays: -28,
    title: "Early prep",
    summary:
      "Leadership reviews the dashboard material, prays over your church's needs, and selects a survey coordinator.",
    sourceDoc: "Step-by-Step to Success",
  },
  {
    key: "survey_prep",
    order: 2,
    anchor: "opens",
    offsetDays: -14,
    title: "Survey prep",
    summary:
      "Brief elders/deacons and ministry leaders, draft your announcement and bulletin text, and decide whether to offer a paper survey option.",
    sourceDoc: "Step-by-Step to Success",
  },
  {
    key: "announce",
    order: 3,
    anchor: "opens",
    offsetDays: -14,
    title: "Announce to the church",
    summary:
      "Publicly announce the survey is coming — bulletin, newsletter, website, and from the front — sharing the date it starts and how to take it.",
    sourceDoc: "Keys to Success",
  },
  {
    key: "leader_soft_launch",
    order: 4,
    anchor: "opens",
    offsetDays: -7,
    title: "Leaders take it first",
    summary:
      "Pastors and key leaders take the survey about a week before the full launch, so they can speak to it firsthand and encourage others.",
    sourceDoc: "Starting Our Jesus Journey Survey",
  },
  {
    key: "full_launch",
    order: 5,
    anchor: "opens",
    offsetDays: 0,
    title: "Full launch",
    summary:
      "Announce it live to the whole congregation, share the join code everywhere, and encourage small groups to take it together.",
    sourceDoc: "Starting Our Jesus Journey Survey",
  },
  {
    key: "monitoring_window",
    order: 6,
    anchor: "opens",
    offsetDays: 3,
    title: "Monitor response rate",
    summary:
      "Check the dashboard regularly for your response rate and subgroup gaps (gender, age band). Aim for 50%+ before closing.",
    sourceDoc: "Journey Survey Monitoring",
  },
  {
    key: "survey_closes",
    order: 7,
    anchor: "closes",
    offsetDays: 0,
    title: "Survey closes",
    summary:
      "Once the 50% threshold and your end date are both reached, close the survey and thank your congregation for participating.",
    sourceDoc: "Step-by-Step to Success",
  },
  {
    key: "debrief_prep",
    order: 8,
    anchor: "closes",
    offsetDays: 1,
    title: "Debriefing preparation",
    summary:
      "Senior pastor plus 1-2 key leaders spend about 4 hours working through the Church Report page by page.",
    sourceDoc: "Debriefing Preparation",
  },
  {
    key: "debrief_leadership",
    order: 9,
    anchor: "closes",
    offsetDays: 2,
    title: "Debriefing leadership session",
    summary:
      "A 4-hour session with ministry staff/key leaders — split into three groups for Experiencing, Reflecting, and Serving Jesus, then introduce the Comments Report.",
    sourceDoc: "Debriefing Leadership Sessions",
  },
  {
    key: "core_community_meeting",
    order: 10,
    anchor: "closes",
    offsetDays: 7,
    title: "Core community meeting",
    summary:
      "An invitation-only meeting with core members to review findings and gather their observations and perspective.",
    sourceDoc: "Engaging the Church",
  },
  {
    key: "whole_church_message",
    order: 11,
    anchor: "closes",
    offsetDays: 10,
    title: "Whole-church message",
    summary:
      "The following Sunday, share your three greatest strengths and three growth opportunities with the whole congregation.",
    sourceDoc: "Step-by-Step to Success",
  },
  {
    key: "town_halls",
    order: 12,
    anchor: "closes",
    offsetDays: 17,
    title: "Town halls & focus groups",
    summary:
      "Hold several open sessions so anyone who wishes can review the results and give input and discussion.",
    sourceDoc: "Engaging the Church",
  },
  {
    key: "strategic_plan",
    order: 13,
    anchor: "closes",
    offsetDays: 35,
    title: "Staff/leaders retreat & strategic plan",
    summary:
      "Digest all findings and set 12-18 month outcome-focused goals, identify high-leverage \"keys,\" and plan 6-month and 1-year check-ins.",
    sourceDoc: "Making a Plan",
  },
  {
    key: "resurvey_reminder",
    order: 14,
    anchor: "closes",
    offsetDays: 548, // ~18 months
    title: "Re-survey reminder",
    summary:
      "About 18 months out, plan to repeat the survey so you can see real movement compared to this snapshot.",
    sourceDoc: "Making a Plan",
  },
];

function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export interface ComputedPhase extends TimelinePhaseDef {
  date: string | null; // YYYY-MM-DD, or null if the anchor date isn't set yet
}

/**
 * Computes real calendar dates for every phase given opensAt/closesAt (either
 * of which may be null/undefined if not set yet — in that case phases
 * anchored to the missing date come back with date: null, so the UI can
 * render the plan as relative offsets instead ("2 weeks before your start
 * date") until real dates exist.
 */
export function computeTimelineDates(
  opensAt: string | null | undefined,
  closesAt: string | null | undefined,
): ComputedPhase[] {
  return TIMELINE_PHASES.map((phase) => {
    const anchorDate = phase.anchor === "opens" ? opensAt : closesAt;
    return {
      ...phase,
      date: anchorDate ? addDays(anchorDate, phase.offsetDays) : null,
    };
  });
}

/** Default closesAt (2 weeks after opensAt) per the guide's suggested schedule. */
export function defaultClosesAt(opensAt: string): string {
  return addDays(opensAt, DEFAULT_SURVEY_LENGTH_DAYS);
}
