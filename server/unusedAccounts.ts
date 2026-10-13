// ---------------------------------------------------------------------------
// Unused-account cleanup (approved by Gary Best, October 13, 2026).
//
// A church account that has NEVER purchased a survey, and that nobody has
// signed in to for six months, is deleted. Fourteen days before deletion the
// primary contact is emailed a notice; signing in resets the clock. An account
// is never deleted unless that notice was actually sent.
//
// Protected forever (never deleted automatically): the demo church, imported
// historical (legacy) accounts, and any account with a paid or refunded
// survey, any participant responses, saved reports, or historical snapshots.
// ---------------------------------------------------------------------------

import { pool, storage } from "./storage";
import { isDemoChurch } from "@shared/surveyAccess";
import { destroySessionsForChurch } from "./auth";
import { sendEmailDetailed } from "./mailer";
import { internalNotificationsEmail } from "./journeyConfig";
import type { Church } from "@shared/schema";

export const UNUSED_MONTHS = 6;
export const NOTICE_DAYS = 14;
/** Safety cap so a bug or clock problem can never remove many accounts at once. */
export const MAX_DELETIONS_PER_RUN = 10;

const DAY = 86_400_000;

function addMonths(d: Date, months: number): Date {
  const out = new Date(d.getTime());
  out.setUTCMonth(out.getUTCMonth() + months);
  return out;
}

function toDate(v: unknown): Date | null {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Most recent of registration and last sign-in. */
export function lastActiveAt(church: Pick<Church, "createdAt"> & { lastSignInAt?: unknown }): Date {
  const created = toDate(church.createdAt) ?? new Date(0);
  const signedIn = toDate(church.lastSignInAt);
  return signedIn && signedIn > created ? signedIn : created;
}

/** The earliest date the account could be deleted (ISO yyyy-mm-dd). */
export function scheduledDeletionDate(church: Pick<Church, "createdAt"> & { lastSignInAt?: unknown; unusedWarningSentAt?: unknown }): string {
  const active = lastActiveAt(church);
  let due = addMonths(active, UNUSED_MONTHS);
  const warned = toDate(church.unusedWarningSentAt);
  if (warned && warned >= active) {
    const afterNotice = new Date(warned.getTime() + NOTICE_DAYS * DAY);
    if (afterNotice > due) due = afterNotice;
  }
  return due.toISOString().slice(0, 10);
}

/** Reasons an account must never be removed automatically (empty = eligible). */
export async function protectionReasons(church: Church, client: { query: typeof pool.query } = pool): Promise<string[]> {
  const reasons: string[] = [];
  if (isDemoChurch(church.id)) reasons.push("demo account");
  if (church.primaryContactEmail.startsWith("legacy+")) reasons.push("historical account");
  const { rows } = await client.query(
    `SELECT
       EXISTS (SELECT 1 FROM survey_waves w WHERE w.church_id = $1
               AND (w.payment_status IN ('paid','refunded') OR w.paid_at IS NOT NULL
                    OR w.stripe_payment_intent_id IS NOT NULL)) AS purchased,
       EXISTS (SELECT 1 FROM respondents r JOIN survey_waves w ON w.id = r.wave_id WHERE w.church_id = $1) AS responses,
       EXISTS (SELECT 1 FROM aggregate_snapshots s WHERE s.church_id = $1) AS reports,
       EXISTS (SELECT 1 FROM debriefing_reports d WHERE d.church_id = $1) AS debriefs,
       EXISTS (SELECT 1 FROM legacy_snapshots l WHERE l.church_id = $1) AS legacy`,
    [church.id],
  );
  const r = rows[0] ?? {};
  if (r.purchased) reasons.push("has purchased a survey");
  if (r.responses) reasons.push("has participant responses");
  if (r.reports || r.debriefs) reasons.push("has saved reports");
  if (r.legacy) reasons.push("has historical records");
  return reasons;
}

/** Records a church sign-in, which resets the unused-account clock. Never throws. */
export async function recordChurchSignIn(churchId: string): Promise<void> {
  try {
    // At most one write per hour per account.
    await pool.query(`UPDATE churches SET last_sign_in_at = now() WHERE id = $1 AND (last_sign_in_at IS NULL OR last_sign_in_at < now() - interval '1 hour')`, [churchId]);
  } catch (err: any) {
    console.warn("[unused-accounts] could not record sign-in:", err?.message ?? err);
  }
}

async function logActivity(action: string, detail: string) {
  try {
    const { logAdminActivity } = await import("./adminAccounts");
    await logAdminActivity(null, action, detail, "System");
  } catch {}
}

/** Deletes one never-purchased church and its unpaid survey records, in one transaction. */
async function deleteUnusedChurch(church: Church, now: Date): Promise<boolean> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Lock and re-check inside the transaction: a sign-in or purchase that
    // happened moments ago must stop the deletion.
    const { rows } = await client.query(`SELECT * FROM churches WHERE id = $1 FOR UPDATE`, [church.id]);
    if (!rows[0]) { await client.query("ROLLBACK"); return false; }
    const fresh = { ...church, lastSignInAt: rows[0].last_sign_in_at, unusedWarningSentAt: rows[0].unused_warning_sent_at };
    if ((await protectionReasons(church, client as any)).length > 0 || new Date(scheduledDeletionDate(fresh) + "T00:00:00Z") > now) {
      await client.query("ROLLBACK");
      return false;
    }
    const waveIds = `(SELECT id FROM survey_waves WHERE church_id = $1)`;
    await client.query(`DELETE FROM survey_timeline_phases WHERE wave_id IN ${waveIds}`, [church.id]);
    await client.query(`DELETE FROM church_email_events WHERE church_id = $1`, [church.id]);
    if ((await client.query(`SELECT to_regclass('public.church_password_resets') AS t`)).rows[0].t) {
      await client.query(`DELETE FROM church_password_resets WHERE church_id = $1`, [church.id]);
    }
    await client.query(`DELETE FROM survey_waves WHERE church_id = $1`, [church.id]);
    // Any other linked record makes this fail and roll back, which is the safe outcome.
    await client.query(`DELETE FROM churches WHERE id = $1`, [church.id]);
    await client.query("COMMIT");
    destroySessionsForChurch(church.id);
    return true;
  } catch (err: any) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[unused-accounts] delete failed, nothing removed:", err?.message ?? err);
    return false;
  } finally {
    client.release();
  }
}

export interface UnusedAccountSweepResult {
  enabled: boolean;
  checked: number;
  noticesSent: number;
  deleted: number;
  skippedProtected: number;
  errors: string[];
}

export async function runUnusedAccountSweep(now = new Date()): Promise<UnusedAccountSweepResult> {
  const result: UnusedAccountSweepResult = { enabled: process.env.UNUSED_ACCOUNT_CLEANUP !== "off", checked: 0, noticesSent: 0, deleted: 0, skippedProtected: 0, errors: [] };
  if (!result.enabled) return result;
  const { sendClientEmail } = await import("./journey");
  const deletedNames: string[] = [];
  const noticeCutoff = (c: Church) => addMonths(lastActiveAt(c), UNUSED_MONTHS).getTime() - NOTICE_DAYS * DAY;

  for (const church of await storage.getAllChurches()) {
    if (now.getTime() < noticeCutoff(church)) continue;
    result.checked++;
    try {
      if ((await protectionReasons(church)).length > 0) { result.skippedProtected++; continue; }
      const active = lastActiveAt(church);
      const warned = toDate((church as any).unusedWarningSentAt);
      if (!warned || warned < active) {
        // Slot is the last-active date, so each period of inactivity gets one notice.
        const outcomes = await sendClientEmail("unused_account_warning", church, null, active.toISOString().slice(0, 10));
        if (outcomes.some((o) => o.status === "sent")) {
          await pool.query(`UPDATE churches SET unused_warning_sent_at = $2 WHERE id = $1`, [church.id, now]);
          result.noticesSent++;
          await logActivity("Sent unused-account notice", `${church.name} — deletion on ${scheduledDeletionDate({ ...church, unusedWarningSentAt: now })}`);
        }
        continue;
      }
      if (new Date(scheduledDeletionDate(church) + "T00:00:00Z").getTime() > now.getTime()) continue;
      if (result.deleted >= MAX_DELETIONS_PER_RUN) continue;
      if (await deleteUnusedChurch(church, now)) {
        result.deleted++;
        deletedNames.push(`${church.name} (registered ${lastActiveAt({ createdAt: church.createdAt }).toISOString().slice(0, 10)})`);
        await logActivity("Deleted unused account", `${church.name} — never purchased a survey; notice sent ${warned.toISOString().slice(0, 10)}`);
      }
    } catch (err: any) {
      result.errors.push(`${church.id}: ${err?.message ?? err}`);
    }
  }

  if (deletedNames.length > 0) {
    const text = `These church accounts never purchased a survey, had no sign-in for ${UNUSED_MONTHS} months, and were sent a notice ${NOTICE_DAYS} days ago. They have now been deleted:\n\n${deletedNames.map((n) => `- ${n}`).join("\n")}\n\nThey can register again at any time.`;
    await sendEmailDetailed({
      to: internalNotificationsEmail(),
      subject: `[Jesus Journey] Unused accounts deleted (${deletedNames.length})`,
      text,
      html: `<p>${text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/\n/g, "<br>")}</p>`,
    }).catch(() => {});
  }
  return result;
}

/** Welcome email with the free Discovery call link, plus an internal heads-up. Never throws. */
export async function sendSignupEmails(church: Church): Promise<void> {
  try {
    const { sendClientEmail, sendInternalEmail } = await import("./journey");
    await sendClientEmail("welcome_discovery", church, null, "signup");
    await sendInternalEmail("internal_new_signup", church, null, "signup", `Registered ${new Date().toISOString().slice(0, 10)}${church.region ? ` · ${church.region}` : ""}`);
  } catch (err: any) {
    console.error("[signup-emails] failed:", err?.message ?? err);
  }
}
