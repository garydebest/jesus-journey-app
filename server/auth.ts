import { randomUUID } from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import { DASHBOARD_DEMO_TOKEN, allowsDashboardDemoRequest } from "@shared/dashboardDemo";
import { DEMO_CHURCH_ID } from "@shared/surveyAccess";

// Cookies/localStorage are blocked in the sandboxed preview iframe, so church
// auth uses a bearer token instead of cookie-based sessions. Tokens are held
// in-memory server-side; the client stores its token in React state/context
// (never localStorage) and sends it as `Authorization: Bearer <token>`.

interface SessionRecord {
  churchId: string;
  createdAt: number;
}

const sessions = new Map<string, SessionRecord>();
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 14; // 14 days

export function createSession(churchId: string): string {
  const token = randomUUID() + randomUUID();
  sessions.set(token, { churchId, createdAt: Date.now() });
  return token;
}

export function destroySession(token: string): void {
  sessions.delete(token);
}

/** Signs out every session for a church, optionally keeping one (the current) token. */
export function destroySessionsForChurch(churchId: string, exceptToken?: string): void {
  for (const [token, record] of Array.from(sessions.entries())) {
    if (record.churchId === churchId && token !== exceptToken) sessions.delete(token);
  }
}

export function getChurchIdForToken(token: string | undefined): string | undefined {
  if (!token) return undefined;
  if (token === DASHBOARD_DEMO_TOKEN) return DEMO_CHURCH_ID;
  const record = sessions.get(token);
  if (!record) return undefined;
  if (Date.now() - record.createdAt > SESSION_TTL_MS) {
    sessions.delete(token);
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

export function requireChurchAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  // Defense in depth if this middleware is ever reused outside registerRoutes.
  if (token === DASHBOARD_DEMO_TOKEN && !allowsDashboardDemoRequest(req.method, req.originalUrl.split("?")[0])) {
    return res.status(403).json({ message: "This request is not available in the public demo.", code: "DEMO_READ_ONLY" });
  }
  const churchId = getChurchIdForToken(token);
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
  adminSessions.set(token, { createdAt: Date.now(), userId: user?.id ?? null, version: user?.sessionVersion ?? 0 });
  return token;
}

export function destroyAdminSession(token: string): void {
  adminSessions.delete(token);
}

/** Signs out sessions for one administrator (optionally keeping the current token), or every legacy session when userId is null. */
export function destroyAdminSessionsFor(userId: string | null, exceptToken?: string): void {
  for (const [token, record] of Array.from(adminSessions.entries())) {
    if (record.userId === userId && token !== exceptToken) adminSessions.delete(token);
  }
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
  const record = token ? adminSessions.get(token) : undefined;
  const reject = () => res.status(401).json({ message: "Not authenticated" });
  if (!token || !record) return reject();
  if (Date.now() - record.createdAt > ADMIN_SESSION_TTL_MS) {
    adminSessions.delete(token);
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
      adminSessions.delete(token);
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
