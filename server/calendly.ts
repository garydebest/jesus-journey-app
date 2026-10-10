// Calendly webhook: when a church books the "Debriefing Call", record the
// booking date on its closed survey and send the Survey Review (once).
//
// Matching: the app adds utm_content=<waveId> to every debrief booking link,
// and Calendly returns it in the webhook's `tracking`. If that is missing
// (for example, the link was forwarded or copied), the invitee's email is
// matched to the church's primary contact. Anything unmatched is reported to
// the internal notifications address so it can be recorded by hand.
import crypto from "node:crypto";
import { storage } from "./storage";
import { onDebriefBooked } from "./journey";
import { sendEmailDetailed } from "./mailer";
import { internalNotificationsEmail } from "./journeyConfig";
import type { SurveyWave } from "@shared/schema";

export function verifyCalendlySignature(rawBody: Buffer, header: string | undefined, key: string, toleranceSeconds = 300): { valid: boolean; reason?: string } {
  if (!header) return { valid: false, reason: "missing Calendly-Webhook-Signature header" };
  const parts = Object.fromEntries(header.split(",").map((kv) => { const i = kv.indexOf("="); return [kv.slice(0, i).trim(), kv.slice(i + 1).trim()]; }));
  const t = parts["t"], v1 = parts["v1"];
  if (!t || !v1) return { valid: false, reason: "malformed signature header" };
  const expected = crypto.createHmac("sha256", key).update(`${t}.${rawBody.toString("utf8")}`, "utf8").digest("hex");
  const a = Buffer.from(expected, "utf8"), b = Buffer.from(v1, "utf8");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return { valid: false, reason: "signature mismatch" };
  if (Math.abs(Date.now() / 1000 - Number(t)) > toleranceSeconds) return { valid: false, reason: "timestamp outside tolerance" };
  return { valid: true };
}

/** Debrief bookings only: a configured event type URI, or an event named like "Debriefing Call". */
export function isDebriefEvent(scheduledEvent: any): boolean {
  const configured = process.env.CALENDLY_DEBRIEF_EVENT_TYPE_URI?.trim();
  if (configured) return scheduledEvent?.event_type === configured;
  return /debrief/i.test(String(scheduledEvent?.name ?? ""));
}

/** The meeting's calendar date (YYYY-MM-DD) in the invitee's own time zone. */
export function meetingDate(startTime: string, timeZone?: string | null): string | null {
  const d = new Date(startTime);
  if (Number.isNaN(d.getTime())) return null;
  for (const tz of [timeZone, "America/Vancouver"]) {
    if (!tz) continue;
    try { return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d); } catch { /* invalid zone */ }
  }
  return null;
}

async function findWave(p: any): Promise<SurveyWave | undefined> {
  const tagged = String(p?.tracking?.utm_content ?? "").trim();
  if (tagged) {
    const wave = await storage.getWaveById(tagged);
    if (wave) return wave;
  }
  const email = String(p?.email ?? "").trim().toLowerCase();
  if (!email) return undefined;
  const church = await storage.getChurchByEmail(email);
  if (!church) return undefined;
  const closed = (await storage.getWavesByChurch(church.id))
    .filter((w) => w.status === "closed" && !w.debriefCompletedAt)
    .sort((a, b) => String(b.closedAt ?? "").localeCompare(String(a.closedAt ?? "")));
  return closed[0];
}

async function notifyInternal(subject: string, lines: string[]) {
  const text = lines.join("\n");
  await sendEmailDetailed({ to: internalNotificationsEmail(), subject, text, html: `<p>${lines.map((l) => l.replace(/&/g, "&amp;").replace(/</g, "&lt;")).join("<br>")}</p>` });
}

export type CalendlyOutcome = "ignored" | "booked" | "rescheduled" | "canceled" | "unmatched";

export async function handleCalendlyEvent(body: any): Promise<CalendlyOutcome> {
  const p = body?.payload;
  const ev = p?.scheduled_event;
  if (!p || !ev || !isDebriefEvent(ev)) return "ignored";
  const who = `${p.name ?? "Unknown"} <${p.email ?? "no email"}>`;
  const when = ev.start_time ? new Date(ev.start_time).toUTCString() : "unknown time";

  if (body.event === "invitee.created") {
    const date = meetingDate(ev.start_time, p.timezone);
    const wave = await findWave(p);
    if (!wave || !date) {
      await notifyInternal("Calendly debrief booking needs matching", [
        `A Debriefing Call was booked by ${who} for ${when}, but it could not be matched to a church survey.`,
        "Please record the debrief date in the admin panel for the right church; saving it sends the Survey Review.",
      ]);
      return "unmatched";
    }
    const first = !wave.debriefBookedAt;
    await storage.updateWaveJourney(wave.id, { debriefBookedAt: date });
    // Sends once per survey (idempotent). Before close, onReportsReady sends it later.
    if (first && wave.status === "closed") await onDebriefBooked(wave.id);
    return first ? "booked" : "rescheduled";
  }

  if (body.event === "invitee.canceled") {
    if (p.rescheduled) return "ignored"; // a new invitee.created follows with the new time
    const wave = await findWave(p);
    if (wave?.debriefBookedAt && !wave.debriefCompletedAt) await storage.updateWaveJourney(wave.id, { debriefBookedAt: null });
    await notifyInternal("Calendly debrief canceled", [
      `${who} canceled the Debriefing Call that was set for ${when}.`,
      wave ? "The debrief date was cleared, so the church can book again from its dashboard." : "It could not be matched to a church survey.",
    ]);
    return "canceled";
  }
  return "ignored";
}
