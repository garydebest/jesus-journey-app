import { createHash, randomUUID } from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import { pool } from "./storage";
import { DASHBOARD_DEMO_TOKEN, allowsDashboardDemoRequest } from "@shared/dashboardDemo";
import { DEMO_CHURCH_ID } from "@shared/surveyAccess";

// Church and administrator sign-ins use bearer tokens
// (`Authorization: Bearer <token>`); the client keeps its token in React state.
//
// Sessions are saved in the auth_sessions table so they survive deploys and
// restarts (before November 2026 they lived only in memory, so every deploy
// signed everyone out and their next click failed with "session expired").
// Only a SHA-256 hash of each token is stored. An in-memory copy avoids a
// database read on most requests; the table is the source of truth after a
// restart. Revocations update both and are awaited so a signed-out token can't
// come back after a restart.

interface SessionRecord {
  churchId: string;
  createdAt: number;
}

const sessions = new Map<string, SessionRecord>();
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 14; // 14 days

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

let tableReady: Promise<void> | null = null;
export function ensureSessionTable(): Promise<void> {
  if (!tableReady) {
    tableReady = (async () => {
      await pool.query(`CREATE TABLE IF NOT EXISTS auth_sessions (
        token_hash TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        church_id TEXT,
        admin_user_id TEXT,
        version INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL
      )`);
      await pool.query(`CREATE INDEX IF NOT EXISTS auth_sessions_church_idx ON auth_sessions (church_id)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS auth_sessions_admin_idx ON auth_sessions (admin_user_id)`);
      await purgeExpiredSessions();
    })().catch((err) => {
      tableReady = null;
      throw err;
    });
  }
  return tableReady;
}

export async function purgeExpiredSessions(): Promise<void> {
  await pool.query(
    `DELETE FROM auth_sessions WHERE (kind = 'church' AND created_at < now() - ($1 || ' milliseconds')::interval)
       OR (kind = 'admin' AND created_at < now() - ($2 || ' milliseconds')::interval)`,
    [String(SESSION_TTL_MS), String(ADMIN_SESSION_TTL_MS)],
  );
}

let lastPurge = Date.now();
function persistSession(token: string, row: { kind: "church" | "admin"; churchId?: string | null; adminUserId?: string | null; version?: number; createdAt: number }) {
  // Fire-and-forget: the in-memory copy serves this process immediately.
  ensureSessionTable()
    .then(() => pool.query(
      `INSERT INTO auth_sessions (token_hash, kind, church_id, admin_user_id, version, created_at) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (token_hash) DO NOTHING`,
      [hashToken(token), row.kind, row.churchId ?? null, row.adminUserId ?? null, row.version ?? 0, new Date(row.createdAt)],
    ))
    .then(() => {
      if (Date.now() - lastPurge > 60 * 60 * 1000) { lastPurge = Date.now(); return purgeExpiredSessions(); }
    })
    .catch((err) => console.error("[auth] could not save session:", err?.message ?? err));
}

// Shapes of the tokens createSession / createAdminSession issue. Anything else
// is refused without a database read.
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const CHURCH_TOKEN_RE = new RegExp(`^${UUID}${UUID}$`);
const ADMIN_TOKEN_RE = new RegExp(`^adm_${UUID}${UUID}$`);

async function loadSession(token: string, kind: "church" | "admin") {
  if (!(kind === "church" ? CHURCH_TOKEN_RE : ADMIN_TOKEN_RE).test(token)) return undefined;
  await ensureSessionTable();
  const { rows } = await pool.query(
    `SELECT church_id, admin_user_id, version, created_at FROM auth_sessions WHERE token_hash = $1 AND kind = $2`,
    [hashToken(token), kind],
  );
  return rows[0] as { church_id: string | null; admin_user_id: string | null; version: number; created_at: Date } | undefined;
}

export function createSession(churchId: string): string {
  const token = randomUUID() + randomUUID();
  const createdAt = Date.now();
  sessions.set(token, { churchId, createdAt });
  persistSession(token, { kind: "church", churchId, createdAt });
  return token;
}

export async function destroySession(token: string): Promise<void> {
  sessions.delete(token);
  await ensureSessionTable();
  await pool.query(`DELETE FROM auth_sessions WHERE token_hash = $1`, [hashToken(token)]);
}

/** Signs out every session for a church, optionally keeping one (the current) token. */
export async function destroySessionsForChurch(churchId: string, exceptToken?: string): Promise<void> {
  for (const [token, record] of Array.from(sessions.entries())) {
    if (record.churchId === churchId && token !== exceptToken) sessions.delete(token);
  }
  await ensureSessionTable();
  await pool.query(
    `DELETE FROM auth_sessions WHERE kind = 'church' AND church_id = $1 AND token_hash <> $2`,
    [churchId, exceptToken ? hashToken(exceptToken) : ""],
  );
}

export async function getChurchIdForToken(token: string | undefined): Promise<string | undefined> {
  if (!token) return undefined;
  if (token === DASHBOARD_DEMO_TOKEN) return DEMO_CHURCH_ID;
  let record = sessions.get(token);
  if (!record) {
    const row = await loadSession(token, "church");
    if (!row?.church_id) return undefined;
    record = { churchId: row.church_id, createdAt: new Date(row.created_at).getTime() };
    sessions.set(token, record);
  }
  if (Date.now() - record.createdAt > SESSION_TTL_MS) {
    await destroySession(token).catch(() => sessions.delete(token));
    return undefined;
  }
  return record.churchId;
}

export interface AuthedRequest extends Request {
  churchId?: string;
  isPublicDemo?: boolean;
}

// Runs before every API route, including routes that do not require auth.
// A demo capability can never create accounts, payments, or responses.
export function restrictPublicDashboardDemo(req: AuthedRequest, res: Response, next: NextFunction) {
  if (req.headers.authorization !== `Bearer ${DASHBOARD_DEMO_TOKEN}`) return next();
  res.setHeader("Cache-Control", "private, no-store");
  if (!allowsDashboardDemoRequest(req.method, req.originalUrl.split("?")[0])) {
    return res.status(403).json({ message: "The public Grace demo only allows viewing its sample reports. Real church access requires your own account and a paid survey.", code: "DEMO_READ_ONLY" });
  }
  req.isPublicDemo = true;
  next();
}

export async function requireChurchAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  // Defense in depth if this middleware is ever reused outside registerRoutes.
  if (token === DASHBOARD_DEMO_TOKEN && !allowsDashboardDemoRequest(req.method, req.originalUrl.split("?")[0])) {
    return res.status(403).json({ message: "This request is not available in the public demo.", code: "DEMO_READ_ONLY" });
  }
  let churchId: string | undefined;
  try {
    churchId = await getChurchIdForToken(token);
  } catch (err: any) {
    console.error("[auth] session lookup failed:", err?.message ?? err);
    return res.status(503).json({ message: "Sign-in check is temporarily unavailable. Please try again." });
  }
  if (!churchId) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  req.churchId = churchId;
  next();
}

// Administrator auth — a separate login flow and session space from church
// accounts. Each administrator has their own account (server/adminAccounts.ts)
// with a password and an authenticator-app code. The old shared
// ADMIN_USERNAME/ADMIN_KEY login remains only until the first owner account
// finishes two-factor setup; after that it is refused (see legacyAdminLoginAllowed).
// Tokens are bearer tokens held only in React state on the client.

export interface AdminIdentity {
  id: string;
  email: string;
  name: string;
  role: "owner" | "admin";
}

interface AdminSessionRecord {
  createdAt: number;
  userId: string | null; // null = legacy shared-password session
  version: number; // must match admin_users.session_version
}

const adminSessions = new Map<string, AdminSessionRecord>();
const ADMIN_SESSION_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours

export function getAdminUsername(): string {
  return (process.env.ADMIN_USERNAME || "admin").trim().toLowerCase();
}

export function getAdminPassword(): string {
  const key = process.env.ADMIN_KEY;
  if (process.env.NODE_ENV === "production" && (!key?.trim() || key === "jesus-journey-admin")) {
    throw new Error("Production administrator authentication is not securely configured");
  }
  return key || "jesus-journey-admin";
}

/** With no user, creates a legacy shared-password session (also used by QA scripts). */
export function createAdminSession(user?: { id: string; sessionVersion: number }): string {
  const token = "adm_" + randomUUID() + randomUUID();
  const record = { createdAt: Date.now(), userId: user?.id ?? null, version: user?.sessionVersion ?? 0 };
  adminSessions.set(token, record);
  persistSession(token, { kind: "admin", adminUserId: record.userId, version: record.version, createdAt: record.createdAt });
  return token;
}

export async function destroyAdminSession(token: string): Promise<void> {
  adminSessions.delete(token);
  await ensureSessionTable();
  await pool.query(`DELETE FROM auth_sessions WHERE token_hash = $1`, [hashToken(token)]);
}

/** Signs out sessions for one administrator (optionally keeping the current token), or every legacy session when userId is null. */
export async function destroyAdminSessionsFor(userId: string | null, exceptToken?: string): Promise<void> {
  for (const [token, record] of Array.from(adminSessions.entries())) {
    if (record.userId === userId && token !== exceptToken) adminSessions.delete(token);
  }
  await ensureSessionTable();
  await pool.query(
    `DELETE FROM auth_sessions WHERE kind = 'admin' AND admin_user_id IS NOT DISTINCT FROM $1 AND token_hash <> $2`,
    [userId, exceptToken ? hashToken(exceptToken) : ""],
  );
}

export function adminTokenFrom(req: Request): string | undefined {
  const header = req.headers.authorization;
  return header?.startsWith("Bearer ") ? header.slice(7) : undefined;
}

export interface AdminRequest extends Request {
  admin?: AdminIdentity | null; // null = legacy shared-password session
  adminToken?: string;
}

type AdminLookup = (userId: string) => Promise<(AdminIdentity & { sessionVersion: number; disabled: boolean }) | undefined>;
let lookupAdmin: AdminLookup | null = null;
/** Registered by adminAccounts.ts to avoid an import cycle. */
export function setAdminLookup(fn: AdminLookup) {
  lookupAdmin = fn;
}

export async function requireAdminAuth(req: Request, res: Response, next: NextFunction) {
  const token = adminTokenFrom(req);
  const reject = () => res.status(401).json({ message: "Not authenticated" });
  if (!token) return reject();
  let record = adminSessions.get(token);
  if (!record) {
    try {
      const row = await loadSession(token, "admin");
      if (row) {
        record = { createdAt: new Date(row.created_at).getTime(), userId: row.admin_user_id, version: row.version };
        adminSessions.set(token, record);
      }
    } catch (err: any) {
      console.error("[admin-auth] session lookup failed:", err?.message ?? err);
      return res.status(503).json({ message: "Sign-in check is temporarily unavailable. Please try again." });
    }
  }
  if (!record) return reject();
  if (Date.now() - record.createdAt > ADMIN_SESSION_TTL_MS) {
    await destroyAdminSession(token).catch(() => adminSessions.delete(token));
    return reject();
  }
  const areq = req as AdminRequest;
  areq.adminToken = token;
  if (record.userId === null) {
    areq.admin = null;
    return next();
  }
  try {
    const user = lookupAdmin ? await lookupAdmin(record.userId) : undefined;
    if (!user || user.disabled || user.sessionVersion !== record.version) {
      await destroyAdminSession(token).catch(() => adminSessions.delete(token));
      return reject();
    }
    areq.admin = { id: user.id, email: user.email, name: user.name, role: user.role };
    next();
  } catch (err: any) {
    console.error("[admin-auth] lookup failed:", err?.message ?? err);
    res.status(503).json({ message: "Sign-in check is temporarily unavailable. Please try again." });
  }
}

/** Owner-only routes. Legacy shared-password sessions count as owner until the shared login is retired. */
export function requireAdminOwner(req: Request, res: Response, next: NextFunction) {
  const admin = (req as AdminRequest).admin;
  if (admin === null || admin?.role === "owner") return next();
  return res.status(403).json({ message: "Only the account owner can do this." });
}
