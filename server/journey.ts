// ---------------------------------------------------------------------------
// Phase 1 client-journey automation: event-triggered emails (payment,
// orientation completion, activation, reports saved, Growth Plan interest),
// a daily sweep for time-based reminders, and internal notices to
// admin@jesusjourney.life. Every message is claimed through
// church_email_events by idempotency key before sending, so retries,
// restarts and overlapping cron runs never send duplicates.
//
// Trigger functions never throw: a mail problem must never break payment,
// activation, or report closure.
// ---------------------------------------------------------------------------

import { storage } from "./storage";
import type { Church, SurveyWave } from "@shared/schema";
import { requiredResponsesForClose } from "@shared/schema";
import { acceptsResponses, isDemoChurch } from "@shared/surveyAccess";
import { sendEmailDetailed, isMailerConfigured } from "./mailer";
import { appBaseUrl, bookingConfig, internalNotificationsEmail, journeyEmailsEnabled } from "./journeyConfig";
import {
  renderClientEmail, renderInternalEmail,
  type ClientEmailType, type InternalEmailType, type TemplateContext,
} from "./journeyTemplates";

export type RecipientRole = "primary" | "coordinator" | "pastor";
interface Recipient { email: string; role: RecipientRole; name: string }

const DAY = 24 * 60 * 60 * 1000;
export const ORIENTATION_REMINDER_DAYS = [2, 7, 12]; // 48h after payment, then every 5 days, max 3
export const DEBRIEF_REMINDER_DAYS = [3, 10];
export const CLOSE_FOLLOWUP_DAYS = [0, 3, 6]; // on planned close, then every 3 days, max two follow-ups
const SWEEP_WINDOW_DAYS = 3; // tolerate missed cron runs without sending stale reminders weeks later

export const isoDay = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (iso: string, n: number) => isoDay(new Date(Date.parse(iso.slice(0, 10) + "T00:00:00Z") + n * DAY));
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b.slice(0, 10) + "T00:00:00Z") - Date.parse(a.slice(0, 10) + "T00:00:00Z")) / DAY);
const firstName = (name: string | null | undefined) => (name ?? "").trim().split(/\s+/)[0] || "friend";

function displayDate(iso: string | null | undefined): string {
  if (!iso) return "Not yet set";
  const d = new Date(iso.slice(0, 10) + "T12:00:00Z");
  if (Number.isNaN(d.getTime())) return "Not yet set";
  return d.toLocaleDateString("en-US", { timeZone: "UTC", weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

function sameEmail(a?: string | null, b?: string | null) {
  return !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** Recipient rules from the approved handoff. Duplicate addresses are sent once. */
export function recipientsFor(type: ClientEmailType, church: Church): Recipient[] {
  const primary: Recipient = { email: church.primaryContactEmail, role: "primary", name: church.primaryContactName };
  const coordinator: Recipient | null = church.surveyCoordinatorEmail
    ? { email: church.surveyCoordinatorEmail, role: "coordinator", name: church.surveyCoordinatorName || church.primaryContactName }
    : null;
  const pastor: Recipient | null = church.leadPastorEmail && church.leadPastorReceivesResults
    ? { email: church.leadPastorEmail, role: "pastor", name: church.leadPastorName || "Pastor" }
    : null;
  let list: (Recipient | null)[];
  switch (type) {
    case "purchase_confirmed":
    case "growth_interest_ack":
      list = [primary]; break;
    case "orientation_reminder":
    case "orientation_followup":
    case "debrief_reminder":
      list = [primary, coordinator]; break;
    case "survey_activated":
    case "early_checkin":
    case "midpoint_reminder":
    case "final_week":
    case "close_or_extend":
      list = [coordinator, primary]; break;
    case "reports_ready":
      list = [primary, coordinator, pastor]; break;
  }
  const out: Recipient[] = [];
  for (const r of list) if (r && !out.some((o) => sameEmail(o.email, r.email))) out.push(r);
  return out;
}

function contextFor(church: Church, wave: SurveyWave | null, recipient: Recipient, responseCount: number): TemplateContext {
  const base = appBaseUrl();
  const booking = bookingConfig();
  const target = wave ? requiredResponsesForClose(wave.minSampleSize) : 0;
  return {
    firstName: firstName(recipient.name),
    churchName: church.name,
    coordinatorName: church.surveyCoordinatorName || "Not yet recorded",
    startDate: displayDate(wave?.opensAt),
    plannedCloseDate: displayDate(wave?.closesAt),
    adultTotal: wave?.minSampleSize ?? 0,
    minimumResponseTarget: target,
    responseCount,
    responsesNeeded: Math.max(0, target - responseCount),
    dashboardUrl: `${base}/#/dashboard`,
    collectUrl: `${base}/#/dashboard?tab=collect`,
    reportsUrl: `${base}/#/dashboard?tab=your-surveys`,
    orientationUrl: booking.orientationUrl,
    debriefUrl: booking.debriefUrl,
  };
}

export interface SendOutcome { recipient: string; role: string; status: "sent" | "failed" | "skipped" | "duplicate" }

function canEmail(church: Church) {
  return journeyEmailsEnabled() && !isDemoChurch(church.id) && !church.primaryContactEmail.startsWith("legacy+");
}

/**
 * Sends one client-journey message to each applicable recipient, once per
 * (type, wave, slot, role). `slot` distinguishes repeating reminders.
 */
export async function sendClientEmail(type: ClientEmailType, church: Church, wave: SurveyWave | null, slot: string, triggeredBy: "system" | "admin" = "system"): Promise<SendOutcome[]> {
  if (!canEmail(church)) return [];
  const count = wave && wave.status !== "closed" ? await storage.countResponsesByWave(wave.id) : 0;
  const outcomes: SendOutcome[] = [];
  for (const recipient of recipientsFor(type, church)) {
    const claim = await storage.claimEmailEvent({
      churchId: church.id, waveId: wave?.id ?? null, eventType: type,
      recipientEmail: recipient.email, recipientRole: recipient.role,
      idempotencyKey: `${type}:${wave?.id ?? church.id}:${slot}:${recipient.role}`,
      triggeredBy,
    });
    if (!claim) { outcomes.push({ recipient: recipient.email, role: recipient.role, status: "duplicate" }); continue; }
    const email = renderClientEmail(type, contextFor(church, wave, recipient, count));
    const result = await sendEmailDetailed({ to: recipient.email, subject: email.subject, html: email.html, text: email.text });
    await storage.finishEmailEvent(claim.id, { status: result.status, providerMessageId: result.messageId, errorMessage: result.error });
    outcomes.push({ recipient: recipient.email, role: recipient.role, status: result.status });
    if (result.status === "failed") {
      await sendInternalEmail("internal_delivery_failed", church, wave, claim.id, `${type} to ${recipient.role} (${recipient.email}): ${result.error ?? "unknown error"}`);
    }
  }
  return outcomes;
}

export async function sendInternalEmail(type: InternalEmailType, church: Church, wave: SurveyWave | null, slot: string, detail?: string): Promise<SendOutcome | null> {
  if (!canEmail(church)) return null;
  const to = internalNotificationsEmail();
  const claim = await storage.claimEmailEvent({
    churchId: church.id, waveId: wave?.id ?? null, eventType: type,
    recipientEmail: to, recipientRole: "internal",
    idempotencyKey: `${type}:${wave?.id ?? church.id}:${slot}:internal`, triggeredBy: "system",
  });
  if (!claim) return { recipient: to, role: "internal", status: "duplicate" };
  const count = wave && wave.status !== "closed" ? await storage.countResponsesByWave(wave.id) : null;
  const snapshot = wave?.status === "closed" ? await storage.getSnapshotByWave(wave.id) : undefined;
  const target = wave ? requiredResponsesForClose(wave.minSampleSize) : 0;
  const email = renderInternalEmail(type, {
    churchName: church.name,
    waveLabel: wave?.label ?? null,
    primaryContact: `${church.primaryContactName} <${church.primaryContactEmail}>`,
    coordinator: church.surveyCoordinatorEmail ? `${church.surveyCoordinatorName ?? ""} <${church.surveyCoordinatorEmail}>`.trim() : null,
    status: wave ? journeyStatusLabel(wave) : null,
    responseLine: wave ? (snapshot ? `${snapshot.respondentCount} (closed)` : `${count ?? 0} of ${target} needed (adult total ${wave.minSampleSize})`) : null,
    plannedClose: wave?.closesAt ? displayDate(wave.closesAt) : null,
    adminUrl: `${appBaseUrl()}/#/admin`,
    detail,
  });
  const result = await sendEmailDetailed({ to, subject: email.subject, html: email.html, text: email.text });
  await storage.finishEmailEvent(claim.id, { status: result.status, providerMessageId: result.messageId, errorMessage: result.error });
  return { recipient: to, role: "internal", status: result.status };
}

export function journeyStatusLabel(wave: SurveyWave): string {
  if (wave.paymentStatus !== "paid") return "Awaiting payment";
  if (wave.status === "closed") return wave.debriefCompletedAt ? "Closed · debrief completed" : wave.debriefBookedAt ? "Closed · debrief booked" : "Closed · reports ready";
  if (acceptsResponses(wave)) return "Active · collecting responses";
  if (wave.orientationCompletedAt) return "Paid · orientation complete · not activated";
  if (wave.orientationBookedAt) return "Paid · orientation booked";
  return "Paid · orientation required";
}

async function load(waveId: string) {
  const wave = await storage.getWaveById(waveId);
  if (!wave) return null;
  const church = await storage.getChurchById(wave.churchId);
  if (!church) return null;
  return { wave, church };
}

async function safely(label: string, fn: () => Promise<unknown>) {
  try { await fn(); } catch (err: any) { console.error(`[journey] ${label} failed:`, err?.message ?? err); }
}

// ----- Event triggers ------------------------------------------------------

export const onWavePaid = (waveId: string) => safely("payment trigger", async () => {
  const ctx = await load(waveId);
  if (!ctx || ctx.wave.paymentStatus !== "paid") return;
  await sendClientEmail("purchase_confirmed", ctx.church, ctx.wave, "once");
  await sendInternalEmail("internal_new_purchase", ctx.church, ctx.wave, "once");
});

export const onOrientationCompleted = (waveId: string) => safely("orientation trigger", async () => {
  const ctx = await load(waveId);
  if (!ctx || !ctx.wave.orientationCompletedAt) return;
  await sendClientEmail("orientation_followup", ctx.church, ctx.wave, "once");
  await sendInternalEmail("internal_orientation_completed", ctx.church, ctx.wave, "once");
});

export const onSurveyActivated = (waveId: string) => safely("activation trigger", async () => {
  const ctx = await load(waveId);
  if (!ctx || !acceptsResponses(ctx.wave)) return;
  await sendClientEmail("survey_activated", ctx.church, ctx.wave, "once");
  await sendInternalEmail("internal_survey_activated", ctx.church, ctx.wave, "once");
});

/** Only called after closeSurvey has committed verified report records. */
export const onReportsReady = (waveId: string) => safely("reports trigger", async () => {
  const ctx = await load(waveId);
  if (!ctx || ctx.wave.status !== "closed") return;
  const snapshot = await storage.getSnapshotByWave(waveId);
  if (!snapshot?.reportPdfPath) return; // reports not durably saved: never announce
  await sendClientEmail("reports_ready", ctx.church, ctx.wave, "once");
  await sendInternalEmail("internal_reports_ready", ctx.church, ctx.wave, "once");
});

export const onDebriefCompleted = (waveId: string) => safely("debrief trigger", async () => {
  const ctx = await load(waveId);
  if (!ctx || !ctx.wave.debriefCompletedAt) return;
  await sendInternalEmail("internal_debrief_completed", ctx.church, ctx.wave, "once");
});

export const onGrowthPlanInterest = (churchId: string) => safely("growth interest trigger", async () => {
  const church = await storage.getChurchById(churchId);
  if (!church) return;
  const slot = isoDay(new Date()); // at most one acknowledgement per day
  await sendClientEmail("growth_interest_ack", church, null, slot);
  await sendInternalEmail("internal_growth_interest", church, null, slot);
});

// ----- Daily sweep ---------------------------------------------------------

export interface JourneySweepResult { checked: number; sent: number; skippedNoMailer: boolean; disabled: boolean; errors: string[] }

const inWindow = (today: string, due: string) => today >= due && daysBetween(due, today) <= SWEEP_WINDOW_DAYS;

/** Time-based Phase 1 reminders. Safe to run repeatedly; `now` is injectable for tests. */
export async function runJourneySweep(now = new Date()): Promise<JourneySweepResult> {
  const result: JourneySweepResult = { checked: 0, sent: 0, skippedNoMailer: false, disabled: !journeyEmailsEnabled(), errors: [] };
  if (result.disabled) return result;
  if (!isMailerConfigured()) { result.skippedNoMailer = true; return result; }
  const today = isoDay(now);
  const tally = (o: SendOutcome[] | SendOutcome | null) => { for (const x of [o].flat()) if (x?.status === "sent") result.sent++; };

  for (const wave of await storage.getAllWaves()) {
    if (isDemoChurch(wave.churchId) || wave.paymentStatus !== "paid") continue;
    result.checked++;
    try {
      const church = await storage.getChurchById(wave.churchId);
      if (!church) continue;

      // Paid, not yet oriented or booked: orientation reminders.
      if (wave.status === "not_started" && wave.paidAt && !wave.orientationCompletedAt && !wave.orientationBookedAt) {
        for (let i = 0; i < ORIENTATION_REMINDER_DAYS.length; i++) { const offset = ORIENTATION_REMINDER_DAYS[i];
          if (inWindow(today, addDays(wave.paidAt, offset))) {
            tally(await sendClientEmail("orientation_reminder", church, wave, String(i + 1)));
            if (i === ORIENTATION_REMINDER_DAYS.length - 1) tally(await sendInternalEmail("internal_orientation_followup_needed", church, wave, "once"));
          }
        }
      }

      // Active collection reminders. Closed surveys never receive these.
      if (acceptsResponses(wave) && wave.activatedAt) {
        const activated = isoDay(wave.activatedAt);
        const count = await storage.countResponsesByWave(wave.id);
        const target = requiredResponsesForClose(wave.minSampleSize);
        if (count < target && inWindow(today, addDays(activated, 3))) tally(await sendClientEmail("early_checkin", church, wave, "once"));
        if (wave.opensAt && wave.closesAt) {
          const span = daysBetween(wave.opensAt, wave.closesAt);
          const midpoint = addDays(wave.opensAt, Math.floor(span / 2));
          if (span >= 6 && midpoint >= activated && inWindow(today, midpoint)) tally(await sendClientEmail("midpoint_reminder", church, wave, `close-${wave.closesAt}`));
          const finalWeek = addDays(wave.closesAt, -5);
          if (finalWeek >= activated && inWindow(today, finalWeek)) {
            tally(await sendClientEmail("final_week", church, wave, `close-${wave.closesAt}`));
            if (count < target) tally(await sendInternalEmail("internal_low_participation", church, wave, `close-${wave.closesAt}`));
          }
          for (let i = 0; i < CLOSE_FOLLOWUP_DAYS.length; i++) { const offset = CLOSE_FOLLOWUP_DAYS[i];
            const due = addDays(wave.closesAt, offset);
            if (today >= due && daysBetween(due, today) < 3) { // each follow-up owns its own 3-day slot
              tally(await sendClientEmail("close_or_extend", church, wave, `close-${wave.closesAt}-${i + 1}`));
            }
          }
        }
      }

      // Closed with verified reports.
      if (wave.status === "closed" && wave.reportGeneratedAt) {
        const snapshot = await storage.getSnapshotByWave(wave.id);
        if (!snapshot?.reportPdfPath) continue;
        const reportsDay = wave.reportGeneratedAt.slice(0, 10);
        if (inWindow(today, reportsDay)) tally(await sendClientEmail("reports_ready", church, wave, "once")); // catch-up only
        if (!wave.debriefBookedAt && !wave.debriefCompletedAt) {
          for (let i = 0; i < DEBRIEF_REMINDER_DAYS.length; i++) { const offset = DEBRIEF_REMINDER_DAYS[i];
            if (inWindow(today, addDays(reportsDay, offset))) {
              tally(await sendClientEmail("debrief_reminder", church, wave, String(i + 1)));
              if (i === 0) tally(await sendInternalEmail("internal_debrief_booking_needed", church, wave, "once"));
            }
          }
        }
      }
    } catch (err: any) {
      result.errors.push(`Wave ${wave.id}: ${err?.message ?? String(err)}`);
    }
  }
  return result;
}

/** Admin "send / resend" for key milestone messages. Always uses a fresh idempotency key. */
export const RESENDABLE: ClientEmailType[] = ["purchase_confirmed", "orientation_reminder", "orientation_followup", "survey_activated", "reports_ready", "debrief_reminder"];

export async function adminResend(type: ClientEmailType, waveId: string): Promise<SendOutcome[]> {
  const ctx = await load(waveId);
  if (!ctx) throw new Error("Survey not found");
  if (type === "reports_ready") {
    const snapshot = await storage.getSnapshotByWave(waveId);
    if (ctx.wave.status !== "closed" || !snapshot?.reportPdfPath) throw new Error("Reports are not saved for this survey yet.");
  }
  if (type === "survey_activated" && !acceptsResponses(ctx.wave)) throw new Error("This survey is not active.");
  if (type === "orientation_followup" && !ctx.wave.orientationCompletedAt) throw new Error("Orientation has not been marked complete.");
  return sendClientEmail(type, ctx.church, ctx.wave, `resend-${Date.now()}`, "admin");
}
