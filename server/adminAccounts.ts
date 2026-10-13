// ---------------------------------------------------------------------------
// Individual administrator accounts with two-factor sign-in.
//
// - Each person signs in with their own email + password (bcrypt, 12+ chars)
//   and then a 6-digit authenticator-app code (server/totp.ts). One-time
//   recovery codes cover a lost device.
// - Setup and reset links carry a random 32-byte token; only its SHA-256 hash
//   is stored. Setup links last 72 hours, reset links 1 hour, email-change
//   links 24 hours. All are single-use; issuing a new one voids older ones.
// - "Forgot password" never reveals whether an email has an account.
// - Password, email and two-factor changes sign out the person's other
//   sessions and send a notice to the account's email address.
// - Every sign-in and every administrative action is recorded in
//   admin_activity with the person's name, so the team has an audit trail.
// - All three tables have row-level security enabled with no policies, like
//   the rest of the public schema: the Supabase REST API can never read them.
// ---------------------------------------------------------------------------

import { createHash, randomBytes, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import QRCode from "qrcode";
import { pool } from "./storage";
import { sendEmailDetailed } from "./mailer";
import { appBaseUrl, SUPPORT_EMAIL } from "./journeyConfig";
import { createAdminSession, destroyAdminSessionsFor, setAdminLookup, type AdminIdentity } from "./auth";
import { currentStep, decryptSecret, encryptSecret, generateTotpSecret, otpauthUrl, verifyTotp } from "./totp";

export const ADMIN_MIN_PASSWORD_LENGTH = 12;
const SETUP_TTL_MS = 72 * 60 * 60 * 1000;
const RESET_TTL_MS = 60 * 60 * 1000;
const EMAIL_CHANGE_TTL_MS = 24 * 60 * 60 * 1000;
const CHALLENGE_TTL_MS = 10 * 60 * 1000;
const MAX_CODE_ATTEMPTS = 5;
const MAX_LINK_REQUESTS_PER_HOUR = 3;
const RECOVERY_CODE_COUNT = 8;

export class AdminAccountError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

// --- Tables -----------------------------------------------------------------

let tablesReady: Promise<void> | null = null;
export function ensureAdminTables(): Promise<void> {
  if (!tablesReady) {
    tablesReady = (async () => {
      await pool.query(`CREATE TABLE IF NOT EXISTS admin_users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('owner','admin')),
        password_hash TEXT,
        totp_secret_enc TEXT,
        totp_enabled_at TIMESTAMPTZ,
        totp_last_step BIGINT NOT NULL DEFAULT 0,
        recovery_codes_json TEXT,
        session_version INTEGER NOT NULL DEFAULT 0,
        disabled_at TIMESTAMPTZ,
        last_sign_in_at TIMESTAMPTZ,
        password_changed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`);
      await pool.query(`CREATE TABLE IF NOT EXISTS admin_tokens (
        id TEXT PRIMARY KEY,
        admin_user_id TEXT NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
        purpose TEXT NOT NULL CHECK (purpose IN ('setup','reset','email_change')),
        token_hash TEXT NOT NULL UNIQUE,
        new_email TEXT,
        expires_at TIMESTAMPTZ NOT NULL,
        used_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`);
      await pool.query(`CREATE INDEX IF NOT EXISTS admin_tokens_user_idx ON admin_tokens (admin_user_id)`);
      await pool.query(`CREATE TABLE IF NOT EXISTS admin_activity (
        id TEXT PRIMARY KEY,
        admin_user_id TEXT,
        admin_name TEXT NOT NULL,
        action TEXT NOT NULL,
        detail TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`);
      await pool.query(`CREATE INDEX IF NOT EXISTS admin_activity_created_idx ON admin_activity (created_at DESC)`);
      // Deny-by-default for the Supabase REST API, matching every other public table.
      for (const t of ["admin_users", "admin_tokens", "admin_activity"]) {
        await pool.query(`ALTER TABLE ${t} ENABLE ROW LEVEL SECURITY`);
      }
    })().catch((err) => {
      tablesReady = null;
      throw err;
    });
  }
  return tablesReady;
}

// --- Rows -------------------------------------------------------------------

interface AdminRow {
  id: string;
  email: string;
  name: string;
  role: "owner" | "admin";
  password_hash: string | null;
  totp_secret_enc: string | null;
  totp_enabled_at: Date | null;
  totp_last_step: string | number;
  recovery_codes_json: string | null;
  session_version: number;
  disabled_at: Date | null;
  last_sign_in_at: Date | null;
  password_changed_at: Date | null;
  created_at: Date;
}

const normEmail = (e: unknown) => String(e ?? "").trim().toLowerCase();
const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");
const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const firstName = (name: string) => (name || "").trim().split(/\s+/)[0] || "there";
const identity = (r: AdminRow): AdminIdentity => ({ id: r.id, email: r.email, name: r.name, role: r.role });

async function getById(id: string): Promise<AdminRow | undefined> {
  await ensureAdminTables();
  const { rows } = await pool.query(`SELECT * FROM admin_users WHERE id = $1`, [id]);
  return rows[0];
}
async function getByEmail(email: string): Promise<AdminRow | undefined> {
  await ensureAdminTables();
  const { rows } = await pool.query(`SELECT * FROM admin_users WHERE email = $1`, [normEmail(email)]);
  return rows[0];
}

setAdminLookup(async (id) => {
  const r = await getById(id);
  return r ? { ...identity(r), sessionVersion: r.session_version, disabled: !!r.disabled_at } : undefined;
});

async function bumpSessions(userId: string): Promise<number> {
  const { rows } = await pool.query(
    `UPDATE admin_users SET session_version = session_version + 1 WHERE id = $1 RETURNING session_version`,
    [userId],
  );
  destroyAdminSessionsFor(userId);
  return rows[0].session_version;
}

function validatePassword(pw: string, email: string) {
  if (typeof pw !== "string" || pw.length < ADMIN_MIN_PASSWORD_LENGTH) {
    throw new AdminAccountError(`Password must be at least ${ADMIN_MIN_PASSWORD_LENGTH} characters.`);
  }
  if (pw.length > 200) throw new AdminAccountError("Password is too long.");
  if (pw.toLowerCase() === email.toLowerCase()) throw new AdminAccountError("Password can't be your email address.");
}

// --- Activity log -----------------------------------------------------------

export async function logAdminActivity(who: AdminIdentity | null | undefined, action: string, detail?: string | null, actorLabel?: string) {
  try {
    await ensureAdminTables();
    await pool.query(
      `INSERT INTO admin_activity (id, admin_user_id, admin_name, action, detail) VALUES ($1, $2, $3, $4, $5)`,
      [randomUUID(), who?.id ?? null, who ? `${who.name} (${who.email})` : actorLabel ?? "Shared admin login", action, detail ?? null],
    );
  } catch (err: any) {
    console.error("[admin-activity] could not record:", err?.message ?? err);
  }
}

export async function listAdminActivity(limit = 200) {
  await ensureAdminTables();
  const { rows } = await pool.query(
    `SELECT a.created_at AS "at", a.admin_name AS "who", a.action, a.detail
       FROM admin_activity a ORDER BY a.created_at DESC LIMIT $1`,
    [Math.min(Math.max(1, limit), 500)],
  );
  return rows;
}

// --- Legacy shared login -----------------------------------------------------

let legacyCache: { at: number; allowed: boolean } | null = null;
/** The shared ADMIN_KEY login works only until an active owner has finished two-factor setup. */
export async function legacyAdminLoginAllowed(): Promise<boolean> {
  if (legacyCache && Date.now() - legacyCache.at < 30_000) return legacyCache.allowed;
  await ensureAdminTables();
  const { rows } = await pool.query(
    `SELECT 1 FROM admin_users WHERE role = 'owner' AND totp_enabled_at IS NOT NULL AND disabled_at IS NULL LIMIT 1`,
  );
  legacyCache = { at: Date.now(), allowed: rows.length === 0 };
  return legacyCache.allowed;
}
function retireLegacyLogin() {
  legacyCache = { at: Date.now(), allowed: false };
  destroyAdminSessionsFor(null); // sign out every shared-password session
}

// --- Email helpers ----------------------------------------------------------

async function sendAdminEmail(to: string, subject: string, paragraphs: string[], button?: { label: string; url: string }) {
  const text = [...paragraphs, ...(button ? ["", `${button.label}: ${button.url}`] : []), "", `Questions? Write to ${SUPPORT_EMAIL}.`, "", "Jesus Journey"].join("\n\n").replace(/\n{3,}/g, "\n\n");
  const html =
    paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join("\n") +
    (button
      ? `\n<p><a href="${button.url}" style="display:inline-block;background:#2f6f68;color:#ffffff;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:600">${escapeHtml(button.label)}</a></p>`
      : "") +
    `\n<p>Questions? Write to <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>.</p>\n<p>Jesus Journey</p>`;
  const result = await sendEmailDetailed({ to, subject, html, text });
  if (result.status !== "sent") console.warn(`[admin-accounts] email "${subject}" not sent (${result.status})`);
  return result.status === "sent";
}

async function issueToken(userId: string, purpose: "setup" | "reset" | "email_change", ttlMs: number, newEmail?: string) {
  await pool.query(`UPDATE admin_tokens SET used_at = now() WHERE admin_user_id = $1 AND purpose = $2 AND used_at IS NULL`, [userId, purpose]);
  const token = randomBytes(32).toString("base64url");
  await pool.query(
    `INSERT INTO admin_tokens (id, admin_user_id, purpose, token_hash, new_email, expires_at) VALUES ($1, $2, $3, $4, $5, $6)`,
    [randomUUID(), userId, purpose, hashToken(token), newEmail ?? null, new Date(Date.now() + ttlMs)],
  );
  return token;
}

async function linkRequestsLastHour(userId: string): Promise<number> {
  const { rows } = await pool.query(
    `SELECT count(*)::int AS n FROM admin_tokens WHERE admin_user_id = $1 AND purpose IN ('setup','reset') AND created_at > now() - interval '1 hour'`,
    [userId],
  );
  return rows[0]?.n ?? 0;
}

async function sendSetupOrResetLink(user: AdminRow): Promise<boolean> {
  const isSetup = !user.password_hash;
  const token = await issueToken(user.id, isSetup ? "setup" : "reset", isSetup ? SETUP_TTL_MS : RESET_TTL_MS);
  const url = `${appBaseUrl()}/#/admin/reset/${token}`;
  if (isSetup) {
    return sendAdminEmail(user.email, "Set up your Jesus Journey administrator account", [
      `Hello ${firstName(user.name)},`,
      "You've been given an administrator account for the Jesus Journey survey. To finish setting it up, choose a password using the button below. Then sign in and add the account to an authenticator app (such as the Passwords app on iPhone or iPad, Google Authenticator or Microsoft Authenticator) for two-factor sign-in.",
      "This link works once and expires in 72 hours.",
    ], { label: "Set up my account", url });
  }
  return sendAdminEmail(user.email, "Reset your Jesus Journey administrator password", [
    `Hello ${firstName(user.name)},`,
    "We received a request to reset the password for your Jesus Journey administrator account.",
    "This link works once and expires in one hour. You'll still need your authenticator code to sign in.",
    "If you didn't ask for this, you can ignore this email. Your current password will keep working.",
  ], { label: "Choose a new password", url });
}

// --- Forgot password / first-time setup ------------------------------------

/** Always resolves without revealing whether the email has an account. */
export async function requestAdminPasswordLink(email: string): Promise<void> {
  const user = await getByEmail(email);
  if (!user || user.disabled_at) return;
  if ((await linkRequestsLastHour(user.id)) >= MAX_LINK_REQUESTS_PER_HOUR) return;
  await sendSetupOrResetLink(user);
}

export async function describeAdminLink(token: string): Promise<{ purpose: "setup" | "reset"; name: string } | null> {
  await ensureAdminTables();
  const { rows } = await pool.query(
    `SELECT t.purpose, u.name FROM admin_tokens t JOIN admin_users u ON u.id = t.admin_user_id
      WHERE t.token_hash = $1 AND t.used_at IS NULL AND t.expires_at > now() AND t.purpose IN ('setup','reset') AND u.disabled_at IS NULL`,
    [hashToken(String(token || ""))],
  );
  return rows[0] ? { purpose: rows[0].purpose, name: rows[0].name } : null;
}

export async function completeAdminPasswordLink(token: string, password: string): Promise<AdminIdentity> {
  await ensureAdminTables();
  const { rows } = await pool.query(
    `SELECT t.id AS token_id, t.purpose, u.* FROM admin_tokens t JOIN admin_users u ON u.id = t.admin_user_id
      WHERE t.token_hash = $1 AND t.used_at IS NULL AND t.expires_at > now() AND t.purpose IN ('setup','reset') AND u.disabled_at IS NULL`,
    [hashToken(String(token || ""))],
  );
  const row = rows[0];
  if (!row) throw new AdminAccountError("This link is invalid or has expired. Please request a new one from the sign-in page.");
  validatePassword(password, row.email);
  const claimed = await pool.query(`UPDATE admin_tokens SET used_at = now() WHERE id = $1 AND used_at IS NULL RETURNING id`, [row.token_id]);
  if (!claimed.rowCount) throw new AdminAccountError("This link has already been used. Please request a new one.");
  const hash = await bcrypt.hash(password, 12);
  await pool.query(`UPDATE admin_users SET password_hash = $1, password_changed_at = now() WHERE id = $2`, [hash, row.id]);
  await bumpSessions(row.id);
  const who = identity(row);
  await logAdminActivity(who, row.purpose === "setup" ? "Set up account password" : "Reset password by email link");
  if (row.purpose === "reset") {
    await sendAdminEmail(row.email, "Your Jesus Journey administrator password was changed", [
      `Hello ${firstName(row.name)},`,
      "The password for your Jesus Journey administrator account was just reset, and any other signed-in devices were signed out.",
      `If this wasn't you, contact ${SUPPORT_EMAIL} straight away.`,
    ]);
  }
  return who;
}

// --- Sign-in (password, then code) -------------------------------------------

interface Challenge {
  userId: string;
  expires: number;
  attempts: number;
  pendingSecret?: string; // during first-time two-factor setup
}
const challenges = new Map<string, Challenge>();
function newChallenge(c: Omit<Challenge, "expires" | "attempts">): string {
  for (const [k, v] of Array.from(challenges.entries())) if (v.expires < Date.now()) challenges.delete(k);
  const id = randomBytes(24).toString("base64url");
  challenges.set(id, { ...c, expires: Date.now() + CHALLENGE_TTL_MS, attempts: 0 });
  return id;
}
function takeChallenge(id: string): Challenge {
  const c = challenges.get(String(id || ""));
  if (!c || c.expires < Date.now()) {
    challenges.delete(String(id || ""));
    throw new AdminAccountError("Your sign-in has timed out. Please start again.", 401);
  }
  return c;
}

export type LoginStep =
  | { step: "code"; challenge: string; name: string }
  | { step: "enroll"; challenge: string; name: string; email: string; secret: string; otpauthUrl: string; qrSvg: string };

// A fixed bcrypt hash so unknown emails take the same time as real ones.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password-" + randomUUID(), 12);

/** Step 1. Returns null for any wrong email/password, without saying which. */
export async function beginAdminLogin(email: string, password: string): Promise<LoginStep | null> {
  const user = await getByEmail(email);
  const ok = await bcrypt.compare(String(password ?? ""), user?.password_hash || DUMMY_HASH);
  if (!user || !user.password_hash || !ok || user.disabled_at) return null;
  if (user.totp_enabled_at && user.totp_secret_enc) {
    return { step: "code", challenge: newChallenge({ userId: user.id }), name: user.name };
  }
  const secret = generateTotpSecret();
  const url = otpauthUrl(secret, user.email);
  const qrSvg = await QRCode.toString(url, { type: "svg", margin: 1, width: 220, errorCorrectionLevel: "M" });
  return { step: "enroll", challenge: newChallenge({ userId: user.id, pendingSecret: secret }), name: user.name, email: user.email, secret, otpauthUrl: url, qrSvg };
}

function makeRecoveryCodes(): { plain: string[]; stored: string } {
  const plain = Array.from({ length: RECOVERY_CODE_COUNT }, () => {
    const raw = randomBytes(5).toString("hex"); // 10 hex chars, 40 bits
    return `${raw.slice(0, 5)}-${raw.slice(5)}`;
  });
  return { plain, stored: JSON.stringify(plain.map((c) => hashToken(c))) };
}

async function startSession(user: AdminRow, action: string) {
  await pool.query(`UPDATE admin_users SET last_sign_in_at = now() WHERE id = $1`, [user.id]);
  const token = createAdminSession({ id: user.id, sessionVersion: user.session_version });
  await logAdminActivity(identity(user), action);
  return token;
}

/** Step 2 (first time). Confirms the authenticator works, turns on two-factor and issues recovery codes. */
export async function completeAdminEnrollment(challengeId: string, code: string) {
  const c = takeChallenge(challengeId);
  if (!c.pendingSecret) throw new AdminAccountError("Two-factor setup isn't in progress. Please start again.", 401);
  if (++c.attempts > MAX_CODE_ATTEMPTS) {
    challenges.delete(challengeId);
    throw new AdminAccountError("Too many incorrect codes. Please sign in again.", 401);
  }
  const step = verifyTotp(c.pendingSecret, code);
  if (step === null) throw new AdminAccountError("That code didn't match. Check the code in your authenticator app and try again.");
  const user = await getById(c.userId);
  if (!user || user.disabled_at) throw new AdminAccountError("Account not available.", 401);
  const recovery = makeRecoveryCodes();
  await pool.query(
    `UPDATE admin_users SET totp_secret_enc = $1, totp_enabled_at = now(), totp_last_step = $2, recovery_codes_json = $3 WHERE id = $4`,
    [encryptSecret(c.pendingSecret), step, recovery.stored, user.id],
  );
  challenges.delete(challengeId);
  if (user.role === "owner") retireLegacyLogin();
  await logAdminActivity(identity(user), "Turned on two-factor sign-in");
  await sendAdminEmail(user.email, "Two-factor sign-in is on for your Jesus Journey account", [
    `Hello ${firstName(user.name)},`,
    "Two-factor sign-in was just turned on for your Jesus Journey administrator account. From now on you'll enter a code from your authenticator app each time you sign in.",
    `If this wasn't you, contact ${SUPPORT_EMAIL} straight away.`,
  ]);
  const token = await startSession(user, "Signed in");
  return { token, admin: identity(user), recoveryCodes: recovery.plain };
}

/** Step 2 (normal). Accepts a 6-digit code or a one-time recovery code. */
export async function completeAdminCode(challengeId: string, code: string) {
  const c = takeChallenge(challengeId);
  if (c.pendingSecret) throw new AdminAccountError("Please finish two-factor setup first.", 401);
  if (++c.attempts > MAX_CODE_ATTEMPTS) {
    challenges.delete(challengeId);
    throw new AdminAccountError("Too many incorrect codes. Please sign in again.", 401);
  }
  const user = await getById(c.userId);
  if (!user || user.disabled_at || !user.totp_secret_enc) throw new AdminAccountError("Account not available.", 401);
  const given = String(code ?? "").trim().toLowerCase();
  let usedRecovery = false;
  if (/^\d{6}$/.test(given.replace(/\s+/g, ""))) {
    const step = verifyTotp(decryptSecret(user.totp_secret_enc), given);
    if (step === null || step <= Number(user.totp_last_step)) {
      throw new AdminAccountError("That code didn't match. Codes change every 30 seconds, so try the newest one.");
    }
    // Conditional update so two simultaneous requests can't both use the same code.
    const upd = await pool.query(`UPDATE admin_users SET totp_last_step = $1 WHERE id = $2 AND totp_last_step < $1`, [step, user.id]);
    if (!upd.rowCount) throw new AdminAccountError("That code was already used. Wait for the next one.");
  } else {
    const hashes: string[] = JSON.parse(user.recovery_codes_json || "[]");
    const h = hashToken(given.replace(/\s+/g, ""));
    if (!hashes.includes(h)) throw new AdminAccountError("That code didn't match. Enter the 6-digit code from your authenticator app, or one of your recovery codes.");
    const remaining = hashes.filter((x) => x !== h);
    const upd = await pool.query(
      `UPDATE admin_users SET recovery_codes_json = $1 WHERE id = $2 AND recovery_codes_json = $3`,
      [JSON.stringify(remaining), user.id, user.recovery_codes_json],
    );
    if (!upd.rowCount) throw new AdminAccountError("Please try again.");
    usedRecovery = true;
    await sendAdminEmail(user.email, "A recovery code was used on your Jesus Journey account", [
      `Hello ${firstName(user.name)},`,
      `Someone signed in to your Jesus Journey administrator account with a one-time recovery code. ${remaining.length} recovery code${remaining.length === 1 ? "" : "s"} left.`,
      `If this wasn't you, contact ${SUPPORT_EMAIL} straight away.`,
    ]);
  }
  challenges.delete(challengeId);
  const token = await startSession(user, usedRecovery ? "Signed in with a recovery code" : "Signed in");
  return { token, admin: identity(user) };
}

// --- My account ---------------------------------------------------------------

export async function getAdminProfile(userId: string) {
  const u = await getById(userId);
  if (!u) throw new AdminAccountError("Account not found.", 404);
  return {
    ...identity(u),
    twoFactorEnabled: !!u.totp_enabled_at,
    recoveryCodesRemaining: JSON.parse(u.recovery_codes_json || "[]").length,
    lastSignInAt: u.last_sign_in_at,
    passwordChangedAt: u.password_changed_at,
  };
}

async function requireCurrentPassword(u: AdminRow, currentPassword: string) {
  const ok = u.password_hash ? await bcrypt.compare(String(currentPassword ?? ""), u.password_hash) : false;
  if (!ok) throw new AdminAccountError("Your current password is incorrect.");
}

/** Returns a fresh session token for the current device; every other session is signed out. */
export async function changeAdminPassword(userId: string, currentPassword: string, newPassword: string) {
  const u = await getById(userId);
  if (!u) throw new AdminAccountError("Account not found.", 404);
  await requireCurrentPassword(u, currentPassword);
  validatePassword(newPassword, u.email);
  if (await bcrypt.compare(newPassword, u.password_hash!)) throw new AdminAccountError("Choose a password different from your current one.");
  await pool.query(`UPDATE admin_users SET password_hash = $1, password_changed_at = now() WHERE id = $2`, [await bcrypt.hash(newPassword, 12), userId]);
  const version = await bumpSessions(userId);
  await logAdminActivity(identity(u), "Changed password");
  await sendAdminEmail(u.email, "Your Jesus Journey administrator password was changed", [
    `Hello ${firstName(u.name)},`,
    "The password for your Jesus Journey administrator account was just changed, and any other signed-in devices were signed out.",
    `If this wasn't you, contact ${SUPPORT_EMAIL} straight away.`,
  ]);
  return createAdminSession({ id: userId, sessionVersion: version });
}

export async function requestAdminEmailChange(userId: string, currentPassword: string, newEmailRaw: string) {
  const u = await getById(userId);
  if (!u) throw new AdminAccountError("Account not found.", 404);
  await requireCurrentPassword(u, currentPassword);
  const newEmail = normEmail(newEmailRaw);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) throw new AdminAccountError("Please enter a valid email address.");
  if (newEmail === u.email) throw new AdminAccountError("That's already your sign-in email.");
  if (await getByEmail(newEmail)) throw new AdminAccountError("Another administrator already uses that email.");
  const token = await issueToken(userId, "email_change", EMAIL_CHANGE_TTL_MS, newEmail);
  await sendAdminEmail(newEmail, "Confirm your new Jesus Journey sign-in email", [
    `Hello ${firstName(u.name)},`,
    "Please confirm that you want to use this address to sign in to your Jesus Journey administrator account. Until you confirm, your old address keeps working.",
    "This link works once and expires in 24 hours.",
  ], { label: "Confirm my new email", url: `${appBaseUrl()}/#/admin/confirm-email/${token}` });
  await sendAdminEmail(u.email, "Your Jesus Journey sign-in email is being changed", [
    `Hello ${firstName(u.name)},`,
    `A request was made to change the sign-in email for your Jesus Journey administrator account to ${newEmail}. It will change only when the new address is confirmed.`,
    `If this wasn't you, change your password and contact ${SUPPORT_EMAIL} straight away.`,
  ]);
  await logAdminActivity(identity(u), "Requested sign-in email change", `to ${newEmail}`);
}

export async function confirmAdminEmailChange(token: string) {
  await ensureAdminTables();
  const { rows } = await pool.query(
    `UPDATE admin_tokens SET used_at = now()
      WHERE token_hash = $1 AND purpose = 'email_change' AND used_at IS NULL AND expires_at > now()
      RETURNING admin_user_id, new_email`,
    [hashToken(String(token || ""))],
  );
  const row = rows[0];
  if (!row) throw new AdminAccountError("This link is invalid or has expired. You can request a new one from My account.");
  const u = await getById(row.admin_user_id);
  if (!u || u.disabled_at) throw new AdminAccountError("Account not available.");
  if (await getByEmail(row.new_email)) throw new AdminAccountError("Another administrator already uses that email.");
  const oldEmail = u.email;
  await pool.query(`UPDATE admin_users SET email = $1 WHERE id = $2`, [row.new_email, u.id]);
  await bumpSessions(u.id);
  await logAdminActivity({ ...identity(u), email: row.new_email }, "Changed sign-in email", `from ${oldEmail}`);
  const notice = [
    `Hello ${firstName(u.name)},`,
    `The sign-in email for your Jesus Journey administrator account is now ${row.new_email}. Please sign in again with the new address.`,
    `If this wasn't you, contact ${SUPPORT_EMAIL} straight away.`,
  ];
  await sendAdminEmail(oldEmail, "Your Jesus Journey sign-in email was changed", notice);
  await sendAdminEmail(row.new_email, "Your Jesus Journey sign-in email was changed", notice);
}

export async function regenerateRecoveryCodes(userId: string, currentPassword: string) {
  const u = await getById(userId);
  if (!u || !u.totp_enabled_at) throw new AdminAccountError("Two-factor sign-in isn't set up.");
  await requireCurrentPassword(u, currentPassword);
  const recovery = makeRecoveryCodes();
  await pool.query(`UPDATE admin_users SET recovery_codes_json = $1 WHERE id = $2`, [recovery.stored, userId]);
  await logAdminActivity(identity(u), "Created new recovery codes");
  await sendAdminEmail(u.email, "New recovery codes for your Jesus Journey account", [
    `Hello ${firstName(u.name)},`,
    "New one-time recovery codes were just created for your Jesus Journey administrator account. Your old recovery codes no longer work.",
    `If this wasn't you, contact ${SUPPORT_EMAIL} straight away.`,
  ]);
  return recovery.plain;
}

// --- Team management (owner) --------------------------------------------------

export async function listAdminTeam() {
  await ensureAdminTables();
  const { rows } = await pool.query(`SELECT * FROM admin_users ORDER BY role DESC, created_at`);
  return (rows as AdminRow[]).map((u) => ({
    ...identity(u),
    status: u.disabled_at ? "removed" : !u.password_hash ? "invited" : !u.totp_enabled_at ? "password set, two-factor pending" : "active",
    twoFactorEnabled: !!u.totp_enabled_at,
    lastSignInAt: u.last_sign_in_at,
    createdAt: u.created_at,
  }));
}

export async function addAdminMember(actor: AdminIdentity | null, nameRaw: string, emailRaw: string, roleRaw: string) {
  const name = String(nameRaw ?? "").trim().slice(0, 120);
  const email = normEmail(emailRaw);
  const role = roleRaw === "owner" ? "owner" : "admin";
  if (!name) throw new AdminAccountError("Please enter the person's name.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new AdminAccountError("Please enter a valid email address.");
  if (await getByEmail(email)) throw new AdminAccountError("That email already has an administrator account.");
  const id = randomUUID();
  await pool.query(`INSERT INTO admin_users (id, email, name, role) VALUES ($1, $2, $3, $4)`, [id, email, name, role]);
  const sent = await sendSetupOrResetLink((await getById(id))!);
  await logAdminActivity(actor, "Added administrator", `${name} (${email}), ${role}`);
  return { id, emailSent: sent };
}

async function memberForOwnerAction(actor: AdminIdentity | null, id: string) {
  const u = await getById(id);
  if (!u) throw new AdminAccountError("Administrator not found.", 404);
  if (actor && actor.id === id) throw new AdminAccountError("Use My account to change your own sign-in.");
  return u;
}

export async function resendAdminSetup(actor: AdminIdentity | null, id: string) {
  const u = await memberForOwnerAction(actor, id);
  if (u.disabled_at) throw new AdminAccountError("This person's access has been removed.");
  const sent = await sendSetupOrResetLink(u);
  await logAdminActivity(actor, u.password_hash ? "Sent password reset link" : "Re-sent setup email", `${u.name} (${u.email})`);
  return { emailSent: sent };
}

export async function resetAdminTwoFactor(actor: AdminIdentity | null, id: string) {
  const u = await memberForOwnerAction(actor, id);
  await pool.query(
    `UPDATE admin_users SET totp_secret_enc = NULL, totp_enabled_at = NULL, totp_last_step = 0, recovery_codes_json = NULL WHERE id = $1`,
    [id],
  );
  await bumpSessions(id);
  legacyCache = null;
  await logAdminActivity(actor, "Reset two-factor sign-in", `${u.name} (${u.email})`);
  await sendAdminEmail(u.email, "Two-factor sign-in was reset on your Jesus Journey account", [
    `Hello ${firstName(u.name)},`,
    "The account owner reset two-factor sign-in on your Jesus Journey administrator account (for example, after a lost phone). Next time you sign in with your password, you'll be asked to add the account to your authenticator app again.",
    `If you didn't expect this, contact ${SUPPORT_EMAIL}.`,
  ]);
}

export async function setAdminRemoved(actor: AdminIdentity | null, id: string, removed: boolean) {
  const u = await memberForOwnerAction(actor, id);
  if (removed && u.role === "owner") {
    const { rows } = await pool.query(`SELECT count(*)::int AS n FROM admin_users WHERE role = 'owner' AND disabled_at IS NULL AND id <> $1`, [id]);
    if ((rows[0]?.n ?? 0) === 0) throw new AdminAccountError("You can't remove the only owner.");
  }
  await pool.query(`UPDATE admin_users SET disabled_at = ${removed ? "now()" : "NULL"} WHERE id = $1`, [id]);
  if (removed) await bumpSessions(id);
  legacyCache = null;
  await logAdminActivity(actor, removed ? "Removed administrator access" : "Restored administrator access", `${u.name} (${u.email})`);
}

/** For first-time provisioning from a trusted script; does not send email. */
export async function provisionAdmin(name: string, email: string, role: "owner" | "admin") {
  await ensureAdminTables();
  const existing = await getByEmail(email);
  if (existing) return existing.id;
  const id = randomUUID();
  await pool.query(`INSERT INTO admin_users (id, email, name, role) VALUES ($1, $2, $3, $4)`, [id, normEmail(email), name.trim(), role]);
  return id;
}

export { currentStep };
