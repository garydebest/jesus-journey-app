// ---------------------------------------------------------------------------
// Automated survey action plan reminders.
//
// Every day, this checks every "live" or "not_started" survey wave, computes
// its 14-phase action plan (respecting manual per-phase date overrides), and
// emails the church's primary contact a heads-up REMINDER_LEAD_DAYS before
// any phase whose date falls exactly that many days out. Each phase is only
// ever emailed once per wave (tracked via survey_timeline_phases.reminderSentAt).
//
// This intentionally does NOT touch congregation-wide "have you responded
// yet" reminders — churches send those themselves through their own
// channels. This only reminds the one primary contact ahead of each of
// their own action-plan phases (e.g. "leaders take it first is in 3 days").
// ---------------------------------------------------------------------------

import { storage } from "./storage";
import { computeTimelineDates, type ComputedPhase } from "@shared/timeline";
import { sendEmail, isMailerConfigured } from "./mailer";

export const REMINDER_LEAD_DAYS = 3;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDaysIso(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function renderReminderEmail(churchName: string, contactName: string, waveLabel: string, phase: ComputedPhase) {
  const dateLabel = phase.date
    ? new Date(phase.date + "T00:00:00").toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : "soon";
  const subject = `Coming up in ${REMINDER_LEAD_DAYS} days: ${phase.title} — ${waveLabel}`;
  const text = `Hi ${contactName},

A heads-up from your Jesus Journey Survey action plan for ${waveLabel}:

${phase.title} is coming up on ${dateLabel}.

${phase.summary}

(This step is drawn from your "${phase.sourceDoc}" guide material — see your dashboard for the full document.)

— Jesus Journey Survey`;
  const html = `
    <div style="font-family: -apple-system, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #28251D;">
      <p>Hi ${escapeHtml(contactName)},</p>
      <p>A heads-up from your Jesus Journey Survey action plan for <strong>${escapeHtml(waveLabel)}</strong>:</p>
      <div style="background: #F7F6F2; border: 1px solid #D4D1CA; border-radius: 8px; padding: 16px 20px; margin: 16px 0;">
        <p style="margin: 0 0 4px 0; font-size: 13px; color: #7A7974; text-transform: uppercase; letter-spacing: 0.03em;">${escapeHtml(dateLabel)}</p>
        <h3 style="margin: 0 0 8px 0; font-size: 18px;">${escapeHtml(phase.title)}</h3>
        <p style="margin: 0; font-size: 14px; line-height: 1.5; color: #28251D;">${escapeHtml(phase.summary)}</p>
      </div>
      <p style="font-size: 13px; color: #7A7974;">This step is drawn from your "${escapeHtml(phase.sourceDoc)}" guide material — see your dashboard for the full document.</p>
      <p style="font-size: 13px; color: #7A7974;">— Jesus Journey Survey</p>
    </div>
  `;
  return { subject, text, html };
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export interface ReminderRunResult {
  checked: number;
  sent: number;
  skippedNoMailer: boolean;
  errors: string[];
}

/**
 * Runs one reminder sweep across all waves. Safe to call repeatedly (e.g.
 * once daily) — already-sent phases are skipped via reminderSentAt.
 */
export async function runReminderSweep(): Promise<ReminderRunResult> {
  const result: ReminderRunResult = { checked: 0, sent: 0, skippedNoMailer: false, errors: [] };

  if (!isMailerConfigured()) {
    result.skippedNoMailer = true;
    return result;
  }

  const today = todayIso();
  const targetDate = addDaysIso(today, REMINDER_LEAD_DAYS);

  const waves = await storage.getAllWaves();
  const activeWaves = waves.filter((w) => w.status === "live" || w.status === "not_started");

  for (const wave of activeWaves) {
    result.checked++;
    if (!wave.opensAt) continue; // no dates set yet — nothing to remind about

    try {
      const overrides = await storage.getTimelinePhaseOverrides(wave.id);
      const overrideByKey = new Map(overrides.map((o) => [o.phaseKey, o]));
      const computed = computeTimelineDates(wave.opensAt, wave.closesAt).map((phase) => ({
        ...phase,
        date: overrideByKey.get(phase.key)?.overrideDate ?? phase.date,
      }));

      const duePhases = computed.filter((phase) => phase.date === targetDate);
      if (duePhases.length === 0) continue;

      const church = await storage.getChurchById(wave.churchId);
      if (!church) continue;

      for (const phase of duePhases) {
        const already = overrideByKey.get(phase.key)?.reminderSentAt;
        if (already) continue;

        const { subject, text, html } = renderReminderEmail(church.name, church.primaryContactName, wave.label, phase);
        const ok = await sendEmail({ to: church.primaryContactEmail, subject, text, html });
        if (ok) {
          await storage.markTimelineReminderSent(wave.id, phase.key);
          result.sent++;
        } else {
          result.errors.push(`Failed to send ${phase.key} reminder for wave ${wave.id}`);
        }
      }
    } catch (err) {
      result.errors.push(`Wave ${wave.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return result;
}
