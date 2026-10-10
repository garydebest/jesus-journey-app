// ---------------------------------------------------------------------------
// Phase 1 client-journey email templates. Copy is the approved wording from
// "Phase 1 Client Journey & Implementation Handoff" (October 5, 2026). Do not
// substitute generic copy. Booking links come only from deploy-time config.
// ---------------------------------------------------------------------------

import { BOOKING_FALLBACK_MESSAGE, SUPPORT_EMAIL } from "./journeyConfig";

export const CLIENT_EMAIL_TYPES = [
  "purchase_confirmed",
  "orientation_reminder",
  "orientation_followup",
  "survey_activated",
  "early_checkin",
  "midpoint_reminder",
  "final_week",
  "close_or_extend",
  "reports_ready",
  "debrief_reminder",
  "debrief_booked",
  "growth_interest_ack",
] as const;
export type ClientEmailType = (typeof CLIENT_EMAIL_TYPES)[number];

export const INTERNAL_EMAIL_TYPES = [
  "internal_new_purchase",
  "internal_orientation_followup_needed",
  "internal_orientation_completed",
  "internal_survey_activated",
  "internal_low_participation",
  "internal_reports_ready",
  "internal_debrief_booking_needed",
  "internal_debrief_completed",
  "internal_growth_interest",
  "internal_delivery_failed",
] as const;
export type InternalEmailType = (typeof INTERNAL_EMAIL_TYPES)[number];

export const EMAIL_TYPE_LABELS: Record<ClientEmailType | InternalEmailType, string> = {
  purchase_confirmed: "Purchase confirmation",
  orientation_reminder: "Orientation reminder",
  orientation_followup: "Orientation follow-up (launch plan)",
  survey_activated: "Survey activated",
  early_checkin: "Early check-in",
  midpoint_reminder: "Midpoint reminder",
  final_week: "Final-week reminder",
  close_or_extend: "Close or extend",
  reports_ready: "Reports ready",
  debrief_reminder: "Debrief reminder",
  debrief_booked: "Survey Review for your debrief (PDF attached)",
  growth_interest_ack: "Growth Plan interest acknowledgement",
  internal_new_purchase: "Internal: new paid survey",
  internal_orientation_followup_needed: "Internal: orientation needs follow-up",
  internal_orientation_completed: "Internal: orientation completed",
  internal_survey_activated: "Internal: survey activated",
  internal_low_participation: "Internal: low participation",
  internal_reports_ready: "Internal: reports ready",
  internal_debrief_booking_needed: "Internal: debrief booking needed",
  internal_debrief_completed: "Internal: debrief completed",
  internal_growth_interest: "Internal: Growth Plan interest",
  internal_delivery_failed: "Internal: email delivery failed",
};

export interface TemplateContext {
  firstName: string;
  churchName: string;
  coordinatorName: string;
  startDate: string;
  plannedCloseDate: string;
  adultTotal: number;
  minimumResponseTarget: number;
  responseCount: number;
  responsesNeeded: number;
  dashboardUrl: string;
  collectUrl: string;
  reportsUrl: string;
  orientationUrl: string | null;
  debriefUrl: string | null;
  debriefDate: string;
}

interface Block { kind: "p" | "list" | "button" | "booking" | "strong-p"; text?: string; items?: string[]; label?: string; href?: string | null }
export interface RenderedEmail { subject: string; preheader: string; html: string; text: string }

const BRAND = "#356a65"; // app primary teal, darkened for email contrast

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function layout(subject: string, preheader: string, greeting: string, blocks: Block[], signoff: string[]): RenderedEmail {
  const htmlBlocks = blocks.map((b) => {
    if (b.kind === "p") return `<p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;">${esc(b.text!)}</p>`;
    if (b.kind === "strong-p") return `<p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;"><strong>${esc(b.text!.split("|")[0])}</strong>${esc(b.text!.split("|")[1] ?? "")}</p>`;
    if (b.kind === "list") return `<ul style="margin:0 0 16px 0;padding-left:20px;font-size:15px;line-height:1.6;">${b.items!.map((i) => `<li style="margin:0 0 4px 0;">${esc(i)}</li>`).join("")}</ul>`;
    // button / booking
    if (!b.href) return `<p style="margin:0 0 16px 0;font-size:14px;line-height:1.6;padding:12px 16px;background:#f3f6f4;border-radius:8px;">${esc(BOOKING_FALLBACK_MESSAGE)}</p>`;
    return `<p style="margin:0 0 12px 0;"><a href="${esc(b.href)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;background:${b.kind === "booking" ? BRAND : "#ffffff"};color:${b.kind === "booking" ? "#ffffff" : BRAND};border:2px solid ${BRAND};text-decoration:none;font-weight:600;font-size:15px;padding:11px 20px;border-radius:8px;">${esc(b.label!)}</a></p>`;
  }).join("\n");
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#f7f6f2;">
<span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;">${esc(preheader)}</span>
<div style="max-width:580px;margin:0 auto;padding:24px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#28251d;">
<div style="background:#ffffff;border:1px solid #e4e1d9;border-radius:12px;padding:28px 28px 20px 28px;">
<p style="margin:0 0 20px 0;font-size:13px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:${BRAND};">Jesus Journey</p>
<p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;">${esc(greeting)}</p>
${htmlBlocks}
<p style="margin:20px 0 0 0;font-size:15px;line-height:1.6;">${signoff.map(esc).join("<br>")}</p>
</div>
<p style="margin:16px 0 0 0;font-size:12px;line-height:1.5;color:#7a7974;text-align:center;">Questions? Reply to this email or write to ${SUPPORT_EMAIL}.</p>
</div></body></html>`;
  const text = [
    greeting, "",
    ...blocks.flatMap((b) => {
      if (b.kind === "p") return [b.text!, ""];
      if (b.kind === "strong-p") return [b.text!.replace("|", ""), ""];
      if (b.kind === "list") return [...b.items!.map((i) => `• ${i}`), ""];
      return [b.href ? `${b.label}: ${b.href}` : BOOKING_FALLBACK_MESSAGE, ""];
    }),
    ...signoff, "",
    `Questions? Reply to this email or write to ${SUPPORT_EMAIL}.`,
  ].join("\n");
  return { subject, preheader, html, text };
}

const progress = (c: TemplateContext) => `Current progress: ${c.responseCount} responses; ${c.responsesNeeded} still needed to reach ${c.minimumResponseTarget}.`;

export function renderClientEmail(type: ClientEmailType, c: TemplateContext): RenderedEmail {
  const hello = `Hello ${c.firstName},`;
  switch (type) {
    case "purchase_confirmed":
      return layout("Welcome to Jesus Journey—your church survey is ready to plan", "Your next step is to book your Survey Orientation.", hello, [
        { kind: "p", text: `Thank you for purchasing a Jesus Journey Church Survey for ${c.churchName}. Your survey has been reserved, and your dashboard is ready.` },
        { kind: "strong-p", text: "Your next step is required:| book your Jesus Journey Survey Orientation. In this conversation, we will help you confirm a practical timeline, prepare your leaders, confirm the adults age 16 and over you will invite, plan broad participation, and explain reports and the results debrief." },
        { kind: "p", text: "Your participant code has been reserved, but it cannot be activated until your required orientation is complete." },
        { kind: "booking", label: "Book your orientation", href: c.orientationUrl },
        { kind: "button", label: "Open your dashboard", href: c.dashboardUrl },
      ], ["With gratitude,", "Jesus Journey"]);
    case "orientation_reminder":
      return layout("Next step: book your Jesus Journey Survey Orientation", "A strong survey begins with a clear plan.", hello, [
        { kind: "p", text: "Your Jesus Journey survey is ready for planning. Please book your required Survey Orientation before launching the survey." },
        { kind: "p", text: "Before the call, be ready to discuss your preferred launch window, approximate adults age 16 and over, leaders who will support the process, and what you hope to learn." },
        { kind: "booking", label: "Book your orientation", href: c.orientationUrl },
      ], ["Thank you,", "Jesus Journey"]);
    case "orientation_followup":
      return layout("Your Jesus Journey survey launch plan", "Here are the next steps your church agreed to.", hello, [
        { kind: "p", text: `Thank you for meeting with us. Here is the plan we confirmed for ${c.churchName}:` },
        { kind: "list", items: [
          `Survey Coordinator: ${c.coordinatorName}`,
          `Planned opening: ${c.startDate}`,
          `Planned close: ${c.plannedCloseDate}`,
          `Adults age 16+: ${c.adultTotal}`,
          `Minimum response target: ${c.minimumResponseTarget}`,
        ] },
        { kind: "p", text: "Next: complete the Readiness Checklist, download the Launch Communications Kit, brief key leaders, then confirm your action plan when you are ready to activate." },
        { kind: "button", label: "Open your dashboard", href: c.dashboardUrl },
      ], ["Jesus Journey"]);
    case "survey_activated":
      return layout("Your Jesus Journey survey is ready to launch", "Your participant code is now accepting responses.", hello, [
        { kind: "p", text: `Your survey for ${c.churchName} has been activated and is ready to receive responses. Invite every adult age 16 and over. Explain why the church is listening, reassure people that individual responses are confidential, and let them know the survey takes about 10–15 minutes.` },
        { kind: "p", text: "Your dashboard includes the participant code, survey link, slides, invitation copy, reminders, and paper-survey option." },
        { kind: "p", text: "The survey does not close automatically. Close it deliberately once you meet the required response level and your leaders are ready for results." },
        { kind: "button", label: "Open the Collect section", href: c.collectUrl },
      ], ["Jesus Journey"]);
    case "early_checkin":
      return layout(`A quick participation check-in for ${c.churchName}`, "Personal invitations can make a meaningful difference.", hello, [
        { kind: "p", text: "Your survey has been open for a few days. Current progress:" },
        { kind: "list", items: [
          `Responses: ${c.responseCount}`,
          `Minimum target: ${c.minimumResponseTarget}`,
          `Still needed: ${c.responsesNeeded}`,
          `Planned close: ${c.plannedCloseDate}`,
        ] },
        { kind: "p", text: "If needed, ask the lead pastor and ministry leaders to make a personal invitation, repeat the invitation in more than one channel, and make paper/technical help visible." },
        { kind: "button", label: "Review survey progress", href: c.dashboardUrl },
      ], ["Jesus Journey"]);
    case "midpoint_reminder":
      return layout("Midpoint reminder: help every voice be heard", "Review your response progress and encourage broad participation.", hello, [
        { kind: "p", text: "You are at the midpoint of your planned survey window. A broad response gives leaders a more trustworthy picture of the church." },
        { kind: "p", text: progress(c) },
        { kind: "button", label: "Open reminder materials", href: c.collectUrl },
      ], ["Jesus Journey"]);
    case "final_week":
      return layout("Final week: encourage participation in Jesus Journey", "Your planned close date is approaching.", hello, [
        { kind: "p", text: "Your planned survey closing date is approaching. Please make one final, clear invitation to the congregation." },
        { kind: "p", text: progress(c) },
        { kind: "p", text: "Remember: the planned date does not close the survey automatically. Your church decides when to close." },
        { kind: "button", label: "Open final-week materials", href: c.collectUrl },
      ], ["Jesus Journey"]);
    case "close_or_extend":
      return layout("Your planned survey close date has arrived", "Decide whether your church is ready to close or needs more time.", hello, [
        { kind: "p", text: `Today is the planned closing date for ${c.churchName}. Current progress: ${c.responseCount} responses; minimum target ${c.minimumResponseTarget}; still needed ${c.responsesNeeded}.` },
        { kind: "p", text: "Please decide whether to close, keep the survey open a little longer, or contact us for help. Closing ends response collection and begins report generation." },
        { kind: "button", label: "Review closing options", href: c.dashboardUrl },
      ], ["Jesus Journey"]);
    case "reports_ready":
      return layout("Your Jesus Journey survey results are ready", "Review your reports, then book a facilitated results debrief.", hello, [
        { kind: "p", text: `Your survey for ${c.churchName} has closed and your reports are ready. Read the Church Report and Comments Report before the facilitated results debrief. The goal is to listen carefully, celebrate strengths, and identify meaningful questions—not rush to solutions.` },
        { kind: "button", label: "Open your reports", href: c.reportsUrl },
        { kind: "booking", label: "Book your results debrief", href: c.debriefUrl },
      ], ["Jesus Journey"]);
    case "debrief_reminder":
      return layout("Book your Jesus Journey results debrief", "Your reports are ready; the next step is to interpret them together.", hello, [
        { kind: "p", text: "Your church reports are ready. Please schedule the next step: a Jesus Journey Survey Results Debrief. Ask participants to read the reports, note two strengths to celebrate and two questions to understand better, and come ready to listen and pray." },
        { kind: "booking", label: "Book your results debrief", href: c.debriefUrl },
      ], ["Jesus Journey"]);
    case "debrief_booked":
      return layout("Your Survey Review for the results debrief", "Your Survey Review is attached. Please read it before the debrief call.", hello, [
        { kind: "p", text: `Thank you for booking your results debrief for ${c.churchName} (${c.debriefDate}). Your Survey Review is attached as a PDF.` },
        { kind: "p", text: "The Survey Review is a short summary of your full Church Report. It shows what we discovered about ourselves, the strengths to celebrate and opportunities to investigate in each Goal, and questions for the conversation. Your full reports are in your dashboard." },
        { kind: "list", items: [
          "Share it with those who will join the call.",
          "Note two strengths to celebrate and two questions you would like to understand better.",
          "Come ready to listen and pray together. The debrief is for understanding, not for rushing to solutions.",
        ] },
        { kind: "button", label: "Open your full reports", href: c.reportsUrl },
      ], ["Jesus Journey"]);
    case "growth_interest_ack":
      return layout("Thank you for your interest in the Jesus Journey Growth Plan", "We will be in touch about next steps.", hello, [
        { kind: "p", text: "Thank you for your interest. The Jesus Journey Growth Plan is a separate paid one-year coaching program for churches seeking guided help turning survey insight into focused priorities, practical action, leadership rhythms, and meaningful progress." },
        { kind: "p", text: "We will be in touch to discuss fit, timing, and next steps." },
      ], ["Jesus Journey"]);
  }
}

export interface InternalContext {
  churchName: string;
  waveLabel: string | null;
  primaryContact: string;
  coordinator: string | null;
  status: string | null;
  responseLine: string | null;
  plannedClose: string | null;
  adminUrl: string;
  detail?: string;
}

const INTERNAL_SUBJECT: Record<InternalEmailType, string> = {
  internal_new_purchase: "New paid survey",
  internal_orientation_followup_needed: "Orientation needs follow-up",
  internal_orientation_completed: "Orientation completed",
  internal_survey_activated: "Survey activated",
  internal_low_participation: "Low participation",
  internal_reports_ready: "Reports ready",
  internal_debrief_booking_needed: "Debrief booking needed",
  internal_debrief_completed: "Debrief completed",
  internal_growth_interest: "Growth Plan interest",
  internal_delivery_failed: "Email delivery failed",
};

const INTERNAL_ACTION: Record<InternalEmailType, string> = {
  internal_new_purchase: "A church has purchased a survey. Its participant code stays inactive until orientation is marked complete in the admin view after the actual call.",
  internal_orientation_followup_needed: "Three orientation reminders have been sent and no orientation is booked or completed. Please follow up personally.",
  internal_orientation_completed: "Orientation was marked complete. The church can now confirm its plan and activate its participant code.",
  internal_survey_activated: "The church confirmed its plan. The participant code is now accepting responses.",
  internal_low_participation: "The planned close is about five days away and participation is below the 50% target. Consider a coaching call.",
  internal_reports_ready: "The survey closed and its reports were durably saved and verified. The church has been invited to book its results debrief.",
  internal_debrief_booking_needed: "Reports have been ready for three days and no debrief is recorded. A reminder was sent to the church.",
  internal_debrief_completed: "The facilitated results debrief was marked complete.",
  internal_growth_interest: "The church asked about the separate paid Growth Plan. Please follow up about fit, timing, and next steps.",
  internal_delivery_failed: "A client-journey email could not be delivered. Check the email history in the admin view and resend if needed.",
};

export function renderInternalEmail(type: InternalEmailType, c: InternalContext): RenderedEmail {
  const subject = `[Jesus Journey] ${INTERNAL_SUBJECT[type]} — ${c.churchName}`;
  const rows = [
    ["Church", c.churchName],
    ["Survey", c.waveLabel ?? "—"],
    ["Primary contact", c.primaryContact],
    ["Survey Coordinator", c.coordinator ?? "Not yet recorded"],
    ["Status", c.status ?? "—"],
    ["Responses", c.responseLine ?? "—"],
    ["Planned close", c.plannedClose ?? "—"],
    ...(c.detail ? [["Detail", c.detail]] : []),
  ];
  const html = `<!doctype html><html><body style="font-family:-apple-system,Helvetica,Arial,sans-serif;color:#28251d;max-width:600px;margin:0 auto;padding:16px;">
<p style="font-size:15px;line-height:1.5;">${esc(INTERNAL_ACTION[type])}</p>
<table style="border-collapse:collapse;font-size:14px;width:100%;">${rows.map(([k, v]) => `<tr><td style="padding:6px 10px;border:1px solid #e4e1d9;background:#f7f6f2;width:38%;">${esc(k)}</td><td style="padding:6px 10px;border:1px solid #e4e1d9;">${esc(v)}</td></tr>`).join("")}</table>
<p style="font-size:14px;"><a href="${esc(c.adminUrl)}">Open the admin view</a></p>
<p style="font-size:12px;color:#7a7974;">Automated internal notice from the Jesus Journey survey app. No survey responses or report contents are included.</p>
</body></html>`;
  const text = [INTERNAL_ACTION[type], "", ...rows.map(([k, v]) => `${k}: ${v}`), "", `Admin view: ${c.adminUrl}`].join("\n");
  return { subject, preheader: INTERNAL_SUBJECT[type], html, text };
}
