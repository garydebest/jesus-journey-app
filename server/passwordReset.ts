// ---------------------------------------------------------------------------
// Church password reset and change.
//
// Reset links carry a random 32-byte token; only its SHA-256 hash is stored.
// Tokens expire after one hour, are single-use, and requesting a new link
// invalidates older unused ones. Responses to "forgot password" never reveal
// whether an email has an account. Successful resets sign out every existing
// session for that church.
// ---------------------------------------------------------------------------

import { createHash, randomBytes, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { pool, storage } from "./storage";
import { sendEmailDetailed } from "./mailer";
import { appBaseUrl, SUPPORT_EMAIL } from "./journeyConfig";

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
const MAX_REQUESTS_PER_HOUR = 3;
export const MIN_PASSWORD_LENGTH = 8;

let tableReady: Promise<void> | null = null;
function ensureTable(): Promise<void> {
  if (!tableReady) {
    tableReady = (async () => {
      await pool.query(`CREATE TABLE IF NOT EXISTS church_password_resets (
        id TEXT PRIMARY KEY,
        church_id TEXT NOT NULL REFERENCES churches(id),
        token_hash TEXT NOT NULL UNIQUE,
        expires_at TIMESTAMPTZ NOT NULL,
        used_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`);
      await pool.query(`CREATE INDEX IF NOT EXISTS church_password_resets_church_idx ON church_password_resets (church_id)`);
    })().catch((err) => {
      tableReady = null;
      throw err;
    });
  }
  return tableReady;
}

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Always resolves; never reveals whether the email has an account. */
export async function requestPasswordReset(email: string): Promise<void> {
  await ensureTable();
  const church = await storage.getChurchByEmail(email.trim());
  if (!church || church.passwordHash === "legacy-no-login") return;

  const { rows } = await pool.query(
    `SELECT count(*)::int AS n FROM church_password_resets WHERE church_id = $1 AND created_at > now() - interval '1 hour'`,
    [church.id],
  );
  if ((rows[0]?.n ?? 0) >= MAX_REQUESTS_PER_HOUR) return;

  await pool.query(`UPDATE church_password_resets SET used_at = now() WHERE church_id = $1 AND used_at IS NULL`, [church.id]);
  const token = randomBytes(32).toString("base64url");
  await pool.query(
    `INSERT INTO church_password_resets (id, church_id, token_hash, expires_at) VALUES ($1, $2, $3, $4)`,
    [randomUUID(), church.id, hashToken(token), new Date(Date.now() + TOKEN_TTL_MS)],
  );

  const link = `${appBaseUrl()}/#/church/reset/${token}`;
  const first = (church.primaryContactName || "").trim().split(/\s+/)[0] || "there";
  const text = [
    `Hello ${first},`,
    "",
    `We received a request to reset the password for the Jesus Journey account for ${church.name}.`,
    "",
    "To choose a new password, open this link within one hour:",
    link,
    "",
    "If you did not ask to reset your password, you can ignore this email. Your current password will keep working.",
    "",
    `Questions? Reply to this email or write to ${SUPPORT_EMAIL}.`,
    "",
    "Jesus Journey",
  ].join("\n");
  const html = `<p>Hello ${escapeHtml(first)},</p>
<p>We received a request to reset the password for the Jesus Journey account for <strong>${escapeHtml(church.name)}</strong>.</p>
<p><a href="${link}" style="display:inline-block;background:#2f6f68;color:#ffffff;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:600">Choose a new password</a></p>
<p>This link works once and expires in one hour.</p>
<p>If you did not ask to reset your password, you can ignore this email. Your current password will keep working.</p>
<p>Questions? Reply to this email or write to <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>.</p>
<p>Jesus Journey</p>`;

  const result = await sendEmailDetailed({
    to: church.primaryContactEmail,
    subject: "Reset your Jesus Journey password",
    html,
    text,
  });
  if (result.status !== "sent") console.warn(`[password-reset] Email not sent (${result.status}) for church ${church.id}`);
}

export class PasswordResetError extends Error {}

/** Consumes a reset token and sets a new password. Returns the church id. */
export async function completePasswordReset(token: string, newPassword: string): Promise<string> {
  if (!newPassword || newPassword.length < MIN_PASSWORD_LENGTH) {
    throw new PasswordResetError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  }
  await ensureTable();
  const passwordHash = await bcrypt.hash(newPassword, 10);
  const { rows } = await pool.query(
    `UPDATE church_password_resets SET used_at = now()
       WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()
       RETURNING church_id`,
    [hashToken(token || "")],
  );
  const churchId: string | undefined = rows[0]?.church_id;
  if (!churchId) throw new PasswordResetError("This reset link is invalid or has expired. Please request a new one.");
  await pool.query(`UPDATE churches SET password_hash = $1 WHERE id = $2`, [passwordHash, churchId]);
  return churchId;
}

export async function changePassword(churchId: string, currentPassword: string, newPassword: string): Promise<void> {
  const church = await storage.getChurchById(churchId);
  if (!church) throw new PasswordResetError("Account not found.");
  const ok = await bcrypt.compare(currentPassword || "", church.passwordHash);
  if (!ok) throw new PasswordResetError("Your current password is incorrect.");
  if (!newPassword || newPassword.length < MIN_PASSWORD_LENGTH) {
    throw new PasswordResetError(`New password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  }
  const passwordHash = await bcrypt.hash(newPassword, 10);
  await pool.query(`UPDATE churches SET password_hash = $1 WHERE id = $2`, [passwordHash, churchId]);
}
