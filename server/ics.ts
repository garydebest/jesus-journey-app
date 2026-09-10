// Minimal .ics (iCalendar) builder for the Survey Action Plan timeline.
// No external dependency — the format is simple enough to hand-roll for a
// handful of all-day VEVENT entries, and this avoids adding a new package
// for something this small.

import { randomUUID } from "node:crypto";
import type { ComputedPhase } from "@shared/timeline";

function foldLine(line: string): string {
  // RFC 5545 §3.1: lines longer than 75 octets should be folded with a
  // leading space on the continuation. Simple char-based fold is sufficient
  // here since our text is plain ASCII/UTF-8 short sentences.
  if (line.length <= 75) return line;
  const parts: string[] = [];
  let rest = line;
  while (rest.length > 75) {
    parts.push(rest.slice(0, 75));
    rest = " " + rest.slice(75);
  }
  parts.push(rest);
  return parts.join("\r\n");
}

function escapeText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function toIcsDate(isoDate: string): string {
  // All-day event date, e.g. "2026-09-09" -> "20260909"
  return isoDate.replace(/-/g, "");
}

function addOneDay(isoDate: string): string {
  const d = new Date(isoDate + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Builds an .ics calendar with one all-day VEVENT per phase that has a
 * resolved date. Phases without a date (opensAt/closesAt not set yet) are
 * silently skipped — callers should only pass phases worth exporting.
 */
export function buildTimelineIcs(waveLabel: string, phases: ComputedPhase[]): string {
  const now = new Date();
  const stamp =
    now.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

  const events = phases
    .filter((p) => p.date)
    .map((phase) => {
      const dtStart = toIcsDate(phase.date!);
      const dtEnd = toIcsDate(addOneDay(phase.date!));
      const uid = `${randomUUID()}@jesusjourney.life`;
      const summary = escapeText(`Jesus Journey: ${phase.title} (${waveLabel})`);
      const description = escapeText(phase.summary);
      return [
        "BEGIN:VEVENT",
        foldLine(`UID:${uid}`),
        `DTSTAMP:${stamp}`,
        `DTSTART:${dtStart}`,
        `DTEND:${dtEnd}`,
        foldLine(`SUMMARY:${summary}`),
        foldLine(`DESCRIPTION:${description}`),
        "END:VEVENT",
      ].join("\r\n");
    });

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Jesus Journey Survey//Action Plan//EN",
    "CALSCALE:GREGORIAN",
    ...events,
    "END:VCALENDAR",
  ].join("\r\n") + "\r\n";
}
