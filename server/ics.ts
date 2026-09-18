// Minimal .ics (iCalendar) builder for the Survey Action Plan timeline.
// No external dependency — the format is simple enough to hand-roll for a
// handful of all-day VEVENT entries, and this avoids adding a new package
// for something this small.

import { randomUUID } from "node:crypto";
import type { ComputedPhase } from "@shared/timeline";

function foldLine(line: string): string {
  // Fold by UTF-8 octets without splitting a Unicode code point.
  const parts: string[] = [];
  let current = "";
  for (const char of line) {
    if (Buffer.byteLength(current + char, "utf8") > 75) {
      parts.push(current);
      current = " ";
    }
    current += char;
  }
  parts.push(current);
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
export function buildTimelineIcs(waveLabel: string, phases: ComputedPhase[], waveId?: string): string {
  const now = new Date();
  const stamp =
    now.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

  const events = phases
    .filter((p) => p.date)
    .map((phase) => {
      const dtStart = toIcsDate(phase.date!);
      const dtEnd = toIcsDate(addOneDay(phase.date!));
      const uid = `${waveId ?? randomUUID()}-${phase.key}@jesusjourney.life`;
      const summary = escapeText(`Jesus Journey: ${phase.title} (${waveLabel})`);
      const description = escapeText(phase.summary);
      return [
        "BEGIN:VEVENT",
        foldLine(`UID:${uid}`),
        `DTSTAMP:${stamp}`,
        `DTSTART;VALUE=DATE:${dtStart}`,
        `DTEND;VALUE=DATE:${dtEnd}`,
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
