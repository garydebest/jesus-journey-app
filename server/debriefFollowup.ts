// ---------------------------------------------------------------------------
// Debrief follow-up drafts (November 2026).
//
// After a results debrief, the facilitator sends a follow-up email (Handbook
// 2.10, template in Tools). This module prepares a DRAFT of that email from
// the call transcript, either delivered automatically by Fathom's webhook or
// pasted in by an administrator. A person always reviews, edits and sends it;
// nothing here sends to a church on its own.
//
// Privacy: the transcript is used only to write the draft and is never
// stored. Only the draft (themes and agreed actions) is saved.
// ---------------------------------------------------------------------------

import crypto from "node:crypto";
import { pool, storage, ensureBootstrapped } from "./storage";
import { sendEmailDetailed } from "./mailer";
import { sendInternalEmail } from "./journey";
import { getFacilitator } from "./adminAccounts";
import { appBaseUrl, internalNotificationsEmail } from "./journeyConfig";
import type { Church, SurveyWave } from "@shared/schema";

export const FOLLOWUP_SUBJECT = "Thank you, and your next steps from our Jesus Journey debrief";
export const FOLLOWUP_EVENT_TYPE = "debrief_followup";
export const FOLLOWUP_EVENT_LABEL = "Debrief follow-up (reviewed and sent by facilitator)";
const MAX_TRANSCRIPT_CHARS = 600_000;
const DEFAULT_MODEL = "gpt-6.1-terra";

export interface DebriefFollowup {
  id: string;
  waveId: string;
  churchId: string;
  source: "fathom" | "pasted";
  fathomRecordingId: string | null;
  fathomUrl: string | null;
  meetingAt: string | null;
  subject: string;
  body: string;
  reviewNotes: string | null;
  edited: boolean;
  status: "draft" | "sent";
  createdAt: string;
  updatedAt: string;
  sentAt: string | null;
  sentBy: string | null;
  sentTo: string | null;
}

// ---------------------------------------------------------------- storage --

let tableReady: Promise<void> | null = null;
export function ensureFollowupTables(): Promise<void> {
  if (!tableReady) {
    tableReady = (async () => {
      await ensureBootstrapped();
      await pool.query(`CREATE TABLE IF NOT EXISTS debrief_followups (
        id TEXT PRIMARY KEY,
        wave_id TEXT NOT NULL UNIQUE REFERENCES survey_waves(id),
        church_id TEXT NOT NULL REFERENCES churches(id),
        source TEXT NOT NULL,
        fathom_recording_id TEXT,
        fathom_url TEXT,
        meeting_at TIMESTAMPTZ,
        subject TEXT NOT NULL,
        body TEXT NOT NULL,
        review_notes TEXT,
        edited BOOLEAN NOT NULL DEFAULT false,
        status TEXT NOT NULL DEFAULT 'draft',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        sent_at TIMESTAMPTZ,
        sent_by TEXT,
        sent_to TEXT
      )`);
      // Webhook deliveries already handled (Fathom retries on failure).
      await pool.query(`CREATE TABLE IF NOT EXISTS fathom_webhook_events (
        recording_id TEXT PRIMARY KEY,
        outcome TEXT NOT NULL,
        received_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`);
      for (const t of ["debrief_followups", "fathom_webhook_events"]) {
        await pool.query(`ALTER TABLE ${t} ENABLE ROW LEVEL SECURITY`);
      }
    })().catch((err) => { tableReady = null; throw err; });
  }
  return tableReady;
}

const toFollowup = (r: any): DebriefFollowup => ({
  id: r.id, waveId: r.wave_id, churchId: r.church_id, source: r.source,
  fathomRecordingId: r.fathom_recording_id, fathomUrl: r.fathom_url,
  meetingAt: r.meeting_at ? new Date(r.meeting_at).toISOString() : null,
  subject: r.subject, body: r.body, reviewNotes: r.review_notes, edited: !!r.edited, status: r.status,
  createdAt: new Date(r.created_at).toISOString(), updatedAt: new Date(r.updated_at).toISOString(),
  sentAt: r.sent_at ? new Date(r.sent_at).toISOString() : null, sentBy: r.sent_by, sentTo: r.sent_to,
});

export async function getFollowup(waveId: string): Promise<DebriefFollowup | null> {
  await ensureFollowupTables();
  const { rows } = await pool.query(`SELECT * FROM debrief_followups WHERE wave_id = $1`, [waveId]);
  return rows[0] ? toFollowup(rows[0]) : null;
}

async function upsertDraft(d: {
  waveId: string; churchId: string; source: "fathom" | "pasted"; fathomRecordingId?: string | null; fathomUrl?: string | null;
  meetingAt?: string | null; subject: string; body: string; reviewNotes?: string | null;
}): Promise<DebriefFollowup> {
  await ensureFollowupTables();
  const { rows } = await pool.query(
    `INSERT INTO debrief_followups (id, wave_id, church_id, source, fathom_recording_id, fathom_url, meeting_at, subject, body, review_notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     ON CONFLICT (wave_id) DO UPDATE SET source = EXCLUDED.source, fathom_recording_id = EXCLUDED.fathom_recording_id,
       fathom_url = COALESCE(EXCLUDED.fathom_url, debrief_followups.fathom_url), meeting_at = COALESCE(EXCLUDED.meeting_at, debrief_followups.meeting_at),
       subject = EXCLUDED.subject, body = EXCLUDED.body, review_notes = EXCLUDED.review_notes, edited = false, updated_at = now()
     WHERE debrief_followups.status = 'draft'
     RETURNING *`,
    [crypto.randomUUID(), d.waveId, d.churchId, d.source, d.fathomRecordingId ?? null, d.fathomUrl ?? null, d.meetingAt ?? null, d.subject, d.body, d.reviewNotes ?? null],
  );
  if (!rows[0]) throw new FollowupError("This follow-up has already been sent, so it can't be replaced.", 409);
  return toFollowup(rows[0]);
}

export async function saveFollowupEdits(waveId: string, subject: string, body: string): Promise<DebriefFollowup> {
  await ensureFollowupTables();
  const s = subject.trim(); const b = body.replace(/\r\n/g, "\n").trim();
  if (!s || !b) throw new FollowupError("Subject and message can't be empty.");
  const { rows } = await pool.query(
    `UPDATE debrief_followups SET subject = $2, body = $3, edited = true, updated_at = now() WHERE wave_id = $1 AND status = 'draft' RETURNING *`,
    [waveId, s.slice(0, 300), b.slice(0, 20_000)],
  );
  if (!rows[0]) throw new FollowupError("There is no unsent draft to save.", 404);
  return toFollowup(rows[0]);
}

export class FollowupError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

// ------------------------------------------------------------ signatures --

/**
 * Verifies a Standard Webhooks signature as used by Fathom: HMAC-SHA256 over
 * `${webhook-id}.${webhook-timestamp}.${raw body}`, keyed with the base64
 * decoded secret (after the `whsec_` prefix). The signature header may list
 * several space-separated `v1,<base64>` values.
 */
export function verifyFathomSignature(
  rawBody: Buffer | string, headers: Record<string, string | string[] | undefined>, secret: string, nowSec = Math.floor(Date.now() / 1000), toleranceSec = 300,
): { valid: boolean; reason?: string } {
  const h = (k: string) => { const v = headers[k]; return Array.isArray(v) ? v[0] : v; };
  const id = h("webhook-id"); const ts = h("webhook-timestamp"); const sigHeader = h("webhook-signature");
  if (!id || !ts || !sigHeader) return { valid: false, reason: "missing headers" };
  const tsNum = Number(ts);
  if (!Number.isFinite(tsNum) || Math.abs(nowSec - tsNum) > toleranceSec) return { valid: false, reason: "timestamp outside tolerance" };
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  if (!key.length) return { valid: false, reason: "bad secret" };
  const expected = crypto.createHmac("sha256", key).update(`${id}.${ts}.${typeof rawBody === "string" ? rawBody : rawBody.toString("utf8")}`).digest();
  for (const part of sigHeader.split(" ")) {
    const [version, sig] = part.split(",", 2);
    if (version !== "v1" || !sig) continue;
    const given = Buffer.from(sig, "base64");
    if (given.length === expected.length && crypto.timingSafeEqual(given, expected)) return { valid: true };
  }
  return { valid: false, reason: "no matching signature" };
}

// --------------------------------------------------------------- matching --

export interface FathomMeeting {
  title?: string; meeting_title?: string; url?: string; share_url?: string;
  recording_id?: number | string; scheduled_start_time?: string; recording_start_time?: string; created_at?: string;
  transcript?: { speaker?: { display_name?: string; matched_calendar_invitee_email?: string | null }; text?: string; timestamp?: string }[] | null;
  default_summary?: { markdown_formatted?: string | null } | null;
  action_items?: { description?: string; assignee?: { name?: string | null; email?: string | null } | null }[] | null;
  calendar_invitees?: { name?: string | null; email?: string | null; is_external?: boolean }[] | null;
  recorded_by?: { name?: string; email?: string } | null;
}

const DEBRIEF_TITLE = /debrief/i;
const NOT_DEBRIEF_TITLE = /orientation|discovery/i;
const lc = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();

function vancouverDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/Vancouver" }); // YYYY-MM-DD
}
function dayDiff(a: string, b: string): number {
  return Math.abs(Date.parse(a.slice(0, 10) + "T12:00:00Z") - Date.parse(b.slice(0, 10) + "T12:00:00Z")) / 86_400_000;
}

export function meetingEmails(m: FathomMeeting): Set<string> {
  const out = new Set<string>();
  for (const i of m.calendar_invitees ?? []) if (i?.email) out.add(lc(i.email));
  for (const t of m.transcript ?? []) if (t?.speaker?.matched_calendar_invitee_email) out.add(lc(t.speaker.matched_calendar_invitee_email));
  const rec = lc(m.recorded_by?.email); if (rec) out.delete(rec);
  return out;
}

/**
 * Finds the church and closed survey this recording belongs to. A recording
 * matches when a church contact was invited AND either the debrief date
 * recorded on the survey is within a day of the call or the meeting title
 * says "debrief". Orientation and Discovery calls are never matched.
 */
export async function matchDebrief(m: FathomMeeting): Promise<{ church: Church; wave: SurveyWave } | { looksLikeDebrief: boolean }> {
  const title = `${m.title ?? ""} ${m.meeting_title ?? ""}`;
  const titleSaysDebrief = DEBRIEF_TITLE.test(title);
  if (NOT_DEBRIEF_TITLE.test(title) && !titleSaysDebrief) return { looksLikeDebrief: false };
  const emails = meetingEmails(m);
  const when = m.recording_start_time ?? m.scheduled_start_time ?? m.created_at ?? null;
  const meetingDay = when ? vancouverDate(when) : null;
  if (emails.size) {
    const churches = (await storage.getAllChurches()).filter((c) =>
      [c.primaryContactEmail, c.surveyCoordinatorEmail, c.leadPastorEmail].some((e) => e && emails.has(lc(e))));
    const candidates: { church: Church; wave: SurveyWave; dateMatch: boolean }[] = [];
    for (const church of churches) {
      for (const wave of await storage.getWavesByChurch(church.id)) {
        if (wave.status !== "closed" || wave.paymentStatus !== "paid") continue;
        const dateMatch = !!(meetingDay && wave.debriefBookedAt && dayDiff(meetingDay, wave.debriefBookedAt) <= 1);
        if (dateMatch || titleSaysDebrief) candidates.push({ church, wave, dateMatch });
      }
    }
    const byDate = candidates.filter((c) => c.dateMatch);
    const pool_ = byDate.length ? byDate : candidates;
    if (pool_.length) {
      // Prefer the survey that closed most recently.
      pool_.sort((a, b) => String(b.wave.closesAt ?? b.wave.createdAt ?? "").localeCompare(String(a.wave.closesAt ?? a.wave.createdAt ?? "")));
      return { church: pool_[0].church, wave: pool_[0].wave };
    }
  }
  return { looksLikeDebrief: titleSaysDebrief };
}

// ---------------------------------------------------------------- drafting --

export function aiConfigured(): boolean { return !!process.env.OPENAI_API_KEY; }
export function fathomConfigured(): boolean { return !!process.env.FATHOM_WEBHOOK_SECRET; }

export interface DraftParts {
  strengths: string[];
  questions: string[];
  nextSteps: { step: string; owner: string; date: string }[];
  growthPlanInterest: boolean;
  reviewNotes: string;
}

export function transcriptText(m: FathomMeeting): string {
  return (m.transcript ?? []).map((t) => `[${t.timestamp ?? ""}] ${t.speaker?.display_name ?? "Speaker"}: ${t.text ?? ""}`).join("\n");
}

function surveyReviewLines(json: string | null | undefined): string {
  if (!json) return "Not available.";
  try {
    const sel = JSON.parse(json);
    const goals = sel?.goals ?? {};
    const out: string[] = [];
    for (const [goal, g] of Object.entries<any>(goals)) {
      const st = (g?.strengths ?? []).map((x: any) => Array.isArray(x) ? x[1] : x?.text ?? String(x));
      const op = (g?.opportunities ?? []).map((x: any) => Array.isArray(x) ? x[1] : x?.text ?? String(x));
      out.push(`${goal}\n  Strengths: ${st.length ? st.join("; ") : "none clear"}\n  Opportunities: ${op.length ? op.join("; ") : "none clear"}`);
    }
    return out.length ? out.join("\n") : "Not available.";
  } catch { return "Not available."; }
}

const SYSTEM_PROMPT = `You help a Jesus Journey facilitator draft the follow-up email sent to a church's leaders after a results debrief call. The facilitator will review and edit your draft before anything is sent.

Return only JSON with this shape:
{"strengths": [string], "questions": [string], "nextSteps": [{"step": string, "owner": string, "date": string}], "growthPlanInterest": boolean, "reviewNotes": string}

What to write:
- strengths: two or three strengths the church's leaders said they want to celebrate, kept close to their own words. One short sentence each.
- questions: two or three questions the leaders agreed are worth investigating, phrased as questions in their words.
- nextSteps: only steps the group actually agreed in the call, each with the owner and date as stated. If the owner or date was not stated, use "[owner to confirm]" or "[date to confirm]". Never invent a step.
- growthPlanInterest: true only if the church's leaders clearly said they were interested in the Jesus Journey Growth Plan.
- reviewNotes: a short note to the facilitator (not the church) listing anything uncertain or missing that they should check before sending. Empty string if nothing.

Privacy rules (these are strict):
- Write about themes and agreed actions only.
- Never say who said what about whom. Do not name or describe any individual's comments, feelings or survey answers.
- Do not include individual survey answers, quotes about specific people, or details that could identify a participant.
- Do not mention prices.

Style: warm, plain, encouraging, Canadian spelling. If the transcript is too short or unclear to fill a section honestly, return fewer items and explain in reviewNotes.`;

type Completer = (system: string, user: string) => Promise<string>;
let completerOverride: Completer | null = null;
/** QA hook: replace the AI call with a deterministic function. */
export function setCompleterForTests(fn: Completer | null) { completerOverride = fn; }

async function complete(system: string, user: string): Promise<string> {
  if (completerOverride) return completerOverride(system, user);
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new FollowupError("Drafting isn't set up yet: OPENAI_API_KEY is missing on the server.", 503);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 180_000);
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST", signal: ctrl.signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: process.env.FOLLOWUP_AI_MODEL || DEFAULT_MODEL,
        messages: [{ role: "developer", content: system }, { role: "user", content: user }],
        response_format: { type: "json_object" },
      }),
    });
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok) throw new FollowupError(`The drafting service returned an error (${res.status}): ${json?.error?.message ?? "unknown"}`, 502);
    const content = json?.choices?.[0]?.message?.content;
    if (!content) throw new FollowupError("The drafting service returned an empty draft.", 502);
    return content;
  } finally { clearTimeout(timer); }
}

function parseParts(raw: string): DraftParts {
  let j: any;
  try { j = JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, "")); } catch { throw new FollowupError("The draft came back in an unexpected format. Please try again.", 502); }
  const strs = (v: any) => Array.isArray(v) ? v.map((x) => String(x ?? "").trim()).filter(Boolean).slice(0, 3) : [];
  return {
    strengths: strs(j.strengths),
    questions: strs(j.questions),
    nextSteps: Array.isArray(j.nextSteps) ? j.nextSteps.slice(0, 8).map((s: any) => ({
      step: String(s?.step ?? "").trim(), owner: String(s?.owner ?? "").trim() || "[owner to confirm]", date: String(s?.date ?? "").trim() || "[date to confirm]",
    })).filter((s: any) => s.step) : [],
    growthPlanInterest: j.growthPlanInterest === true,
    reviewNotes: String(j.reviewNotes ?? "").trim(),
  };
}

function firstName(full: string | null | undefined): string {
  return (full ?? "").trim().split(/\s+/)[0] ?? "";
}

export function greetingFor(church: Church): string {
  const names = [firstName(church.primaryContactName)];
  const coordEmail = lc(church.surveyCoordinatorEmail);
  if (coordEmail && coordEmail !== lc(church.primaryContactEmail)) {
    const c = firstName(church.surveyCoordinatorName);
    if (c && c !== names[0]) names.push(c);
  }
  const clean = names.filter(Boolean);
  return clean.length ? clean.join(" and ") : "friends";
}

export function composeBody(church: Church, parts: DraftParts, signer: string, meetingDate: string | null): string {
  const bullets = (xs: string[], none: string) => xs.length ? xs.map((x) => `- ${x}`).join("\n") : `- ${none}`;
  const when = meetingDate ? ` on ${new Date(meetingDate.slice(0, 10) + "T12:00:00Z").toLocaleDateString("en-CA", { timeZone: "UTC", month: "long", day: "numeric" })}` : "";
  const lines = [
    `Dear ${greetingFor(church)},`,
    "",
    `Thank you for the time you and your team gave to our debrief${when}. Your people were honest with you, and you received what they shared with real care.`,
    "",
    "Strengths you want to celebrate:",
    bullets(parts.strengths, "[add two or three strengths, in their words]"),
    "",
    "Questions worth investigating:",
    bullets(parts.questions, "[add two or three questions, in their words]"),
    "",
    "Next steps:",
    parts.nextSteps.length ? parts.nextSteps.map((s) => `- ${s.step} – ${s.owner} – ${s.date}`).join("\n") : "- [step – owner – date]",
    "",
    `Your reports, the Survey Review and the next-step guides are in the Act tab of your dashboard: ${appBaseUrl()}/#/church`,
  ];
  if (parts.growthPlanInterest) lines.push("", "Thank you for your interest in the Growth Plan. Gary will be in touch about details.");
  lines.push("", "With gratitude,", signer, "Jesus Journey");
  return lines.join("\n");
}

async function signerFor(church: Church, fallbackName?: string | null): Promise<string> {
  const f = await getFacilitator(church.assignedAdminId).catch(() => null);
  return f?.name ?? fallbackName ?? "Gary Best";
}

/** Builds and saves a draft from transcript or notes text. The text itself is not stored. */
export async function draftFromText(church: Church, wave: SurveyWave, text: string, opts: {
  source: "fathom" | "pasted"; fathomRecordingId?: string | null; fathomUrl?: string | null; meetingAt?: string | null;
  fathomSummary?: string | null; actionItems?: string[]; fallbackSigner?: string | null;
}): Promise<DebriefFollowup> {
  const body = text.trim();
  if (body.length < 200) throw new FollowupError("That's too short to draft from. Paste the full transcript or detailed notes from the call.");
  const report = await storage.getDebriefingReportByWave(wave.id).catch(() => undefined);
  const user = [
    `Church: ${church.name}`,
    `Debrief date: ${opts.meetingAt ?? wave.debriefBookedAt ?? "unknown"}`,
    "",
    "Survey Review highlights (the church's official results, by Goal):",
    surveyReviewLines((report as any)?.surveyReviewJson),
    "",
    ...(opts.fathomSummary ? ["Meeting summary from the recording tool:", opts.fathomSummary.slice(0, 20_000), ""] : []),
    ...(opts.actionItems?.length ? ["Action items noted by the recording tool:", ...opts.actionItems.map((a) => `- ${a}`), ""] : []),
    opts.source === "fathom" ? "Call transcript:" : "Transcript or notes from the call:",
    body.slice(0, MAX_TRANSCRIPT_CHARS),
  ].join("\n");
  const parts = parseParts(await complete(SYSTEM_PROMPT, user));
  const signer = await signerFor(church, opts.fallbackSigner);
  const meetingDay = opts.meetingAt ? vancouverDate(opts.meetingAt) : wave.debriefBookedAt ?? null;
  return upsertDraft({
    waveId: wave.id, churchId: church.id, source: opts.source,
    fathomRecordingId: opts.fathomRecordingId ?? null, fathomUrl: opts.fathomUrl ?? null, meetingAt: opts.meetingAt ?? null,
    subject: FOLLOWUP_SUBJECT, body: composeBody(church, parts, signer, meetingDay), reviewNotes: parts.reviewNotes || null,
  });
}

// ---------------------------------------------------------------- webhook --

async function claimRecording(recordingId: string): Promise<boolean> {
  await ensureFollowupTables();
  const { rowCount } = await pool.query(`INSERT INTO fathom_webhook_events (recording_id, outcome) VALUES ($1, 'processing') ON CONFLICT DO NOTHING`, [recordingId]);
  return (rowCount ?? 0) > 0;
}
async function finishRecording(recordingId: string, outcome: string) {
  await pool.query(`UPDATE fathom_webhook_events SET outcome = $2 WHERE recording_id = $1`, [recordingId, outcome.slice(0, 300)]);
}

async function notifyUnmatched(m: FathomMeeting, reason: string) {
  const to = internalNotificationsEmail();
  const title = m.title ?? m.meeting_title ?? "Untitled meeting";
  const link = m.share_url ?? m.url ?? "";
  const text = `A Fathom recording looks like a Jesus Journey debrief, but it couldn't be matched to a church survey.\n\nMeeting: ${title}\nWhen: ${m.recording_start_time ?? m.scheduled_start_time ?? "unknown"}\nRecording: ${link}\nReason: ${reason}\n\nTo get a draft, open the church's closed survey in Admin, go to Client journey → Debrief follow-up, and paste the transcript from Fathom.`;
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
  const html = `<p>A Fathom recording looks like a Jesus Journey debrief, but it couldn't be matched to a church survey.</p><p>Meeting: ${esc(title)}<br>When: ${esc(m.recording_start_time ?? m.scheduled_start_time ?? "unknown")}<br>Recording: ${link ? `<a href="${esc(link)}">${esc(link)}</a>` : "—"}<br>Reason: ${esc(reason)}</p><p>To get a draft, open the church's closed survey in Admin, go to Client journey → Debrief follow-up, and paste the transcript from Fathom.</p>`;
  await sendEmailDetailed({ to, subject: `[Jesus Journey] Debrief recording not matched — ${title}`, html, text }).catch(() => {});
}

/** Handles one Fathom "new meeting content ready" payload. Returns a short outcome string. */
export async function handleFathomMeeting(m: FathomMeeting): Promise<string> {
  const recordingId = String(m.recording_id ?? m.url ?? "");
  if (!recordingId) return "ignored: no recording id";
  if (!(await claimRecording(recordingId))) return "duplicate";
  let outcome = "ignored";
  try {
    const match = await matchDebrief(m);
    if (!("church" in match)) {
      if (match.looksLikeDebrief) { await notifyUnmatched(m, "No closed survey with a matching church contact and debrief date."); outcome = "unmatched debrief"; }
      else outcome = "ignored: not a debrief";
      return outcome;
    }
    const { church, wave } = match;
    const existing = await getFollowup(wave.id);
    if (existing?.status === "sent") { outcome = "skipped: follow-up already sent"; return outcome; }
    if (existing?.edited) {
      await sendInternalEmail("internal_followup_draft_ready", church, wave, `fathom:${recordingId}`,
        `A new Fathom recording arrived, but the existing follow-up draft has already been edited, so it was kept as is. Recording: ${m.share_url ?? m.url ?? "—"}`);
      outcome = "kept edited draft"; return outcome;
    }
    const text = transcriptText(m);
    try {
      await draftFromText(church, wave, text, {
        source: "fathom", fathomRecordingId: recordingId, fathomUrl: m.share_url ?? m.url ?? null,
        meetingAt: m.recording_start_time ?? m.scheduled_start_time ?? null,
        fathomSummary: m.default_summary?.markdown_formatted ?? null,
        actionItems: (m.action_items ?? []).map((a) => [a.description, a.assignee?.name ? `(${a.assignee.name})` : ""].filter(Boolean).join(" ")).filter(Boolean),
      });
      await sendInternalEmail("internal_followup_draft_ready", church, wave, `fathom:${recordingId}`,
        `A draft follow-up email was prepared from the Fathom recording. Review it, edit as needed and send it from Admin → this church's survey → Client journey → Debrief follow-up. Recording: ${m.share_url ?? m.url ?? "—"}`);
      outcome = `drafted for wave ${wave.id}`;
    } catch (err: any) {
      await sendInternalEmail("internal_followup_draft_ready", church, wave, `fathom:${recordingId}`,
        `The Fathom recording was matched to this church, but the draft couldn't be written (${err?.message ?? "unknown error"}). Open Client journey → Debrief follow-up and paste the transcript to try again.`);
      outcome = `draft failed: ${err?.message ?? err}`;
    }
    return outcome;
  } finally {
    await finishRecording(recordingId, outcome).catch(() => {});
  }
}

// ------------------------------------------------------------------ send --

function textToHtml(body: string): string {
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
  const link = (s: string) => s.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>');
  return body.split(/\n{2,}/).map((block) => {
    const lines = block.split("\n");
    const bullets = lines.filter((l) => /^\s*[-•]\s+/.test(l));
    if (bullets.length && bullets.length === lines.length) return `<ul>${lines.map((l) => `<li>${link(esc(l.replace(/^\s*[-•]\s+/, "")))}</li>`).join("")}</ul>`;
    if (bullets.length && !/^\s*[-•]\s+/.test(lines[0]) && bullets.length === lines.length - 1) {
      return `<p>${link(esc(lines[0]))}</p><ul>${lines.slice(1).map((l) => `<li>${link(esc(l.replace(/^\s*[-•]\s+/, "")))}</li>`).join("")}</ul>`;
    }
    return `<p>${lines.map((l) => link(esc(l))).join("<br>")}</p>`;
  }).join("\n");
}

export function followupRecipients(church: Church): { email: string; role: string }[] {
  const out: { email: string; role: string }[] = [{ email: church.primaryContactEmail, role: "primary" }];
  if (church.surveyCoordinatorEmail && lc(church.surveyCoordinatorEmail) !== lc(church.primaryContactEmail)) out.push({ email: church.surveyCoordinatorEmail, role: "coordinator" });
  return out.filter((r) => r.email && !r.email.startsWith("legacy+"));
}

export async function sendFollowup(church: Church, wave: SurveyWave, actorName: string | null): Promise<{ followup: DebriefFollowup; outcomes: { recipient: string; status: string; error?: string | null }[] }> {
  const f = await getFollowup(wave.id);
  if (!f) throw new FollowupError("There is no draft to send.", 404);
  if (f.status === "sent") throw new FollowupError("This follow-up was already sent.", 409);
  const recipients = followupRecipients(church);
  if (!recipients.length) throw new FollowupError("This church has no contact email to send to.");
  const html = textToHtml(f.body);
  const outcomes: { recipient: string; status: string; error?: string | null }[] = [];
  for (const r of recipients) {
    const claim = await storage.claimEmailEvent({
      churchId: church.id, waveId: wave.id, eventType: FOLLOWUP_EVENT_TYPE, recipientEmail: r.email, recipientRole: r.role,
      idempotencyKey: `${FOLLOWUP_EVENT_TYPE}:${wave.id}:${f.id}:${r.role}`, triggeredBy: "admin",
    });
    if (!claim) { outcomes.push({ recipient: r.email, status: "duplicate" }); continue; }
    const result = await sendEmailDetailed({ to: r.email, subject: f.subject, html, text: f.body });
    await storage.finishEmailEvent(claim.id, { status: result.status, providerMessageId: result.messageId, errorMessage: result.error });
    outcomes.push({ recipient: r.email, status: result.status, error: result.error ?? null });
  }
  const delivered = outcomes.filter((o) => o.status === "sent" || o.status === "duplicate");
  if (!delivered.length) throw new FollowupError(`The email couldn't be sent: ${outcomes.map((o) => o.error).filter(Boolean).join("; ") || "unknown error"}`, 502);
  const { rows } = await pool.query(
    `UPDATE debrief_followups SET status = 'sent', sent_at = now(), sent_by = $2, sent_to = $3, updated_at = now() WHERE id = $1 RETURNING *`,
    [f.id, actorName, delivered.map((o) => o.recipient).join(", ")],
  );
  return { followup: toFollowup(rows[0]), outcomes };
}
