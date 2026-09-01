import { randomUUID } from "node:crypto";
import type { Request, Response, NextFunction } from "express";

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

export function getChurchIdForToken(token: string | undefined): string | undefined {
  if (!token) return undefined;
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
}

export function requireChurchAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  const churchId = getChurchIdForToken(token);
  if (!churchId) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  req.churchId = churchId;
  next();
}

// Admin (Gary) auth — a separate login flow and session space from church
// accounts. The admin password is a shared secret read from an environment
// variable (never hard-coded), but the client never holds that secret after
// login: logging in exchanges it once for a short-lived admin session token,
// exactly like church auth, so the password isn't kept in page state for the
// life of the session.

const adminSessions = new Map<string, number>(); // token -> createdAt
const ADMIN_SESSION_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours

export function getAdminPassword(): string {
  return process.env.ADMIN_KEY || "jesus-journey-admin";
}

export function createAdminSession(): string {
  const token = "adm_" + randomUUID() + randomUUID();
  adminSessions.set(token, Date.now());
  return token;
}

export function destroyAdminSession(token: string): void {
  adminSessions.delete(token);
}

function isValidAdminToken(token: string | undefined): boolean {
  if (!token) return false;
  const createdAt = adminSessions.get(token);
  if (createdAt === undefined) return false;
  if (Date.now() - createdAt > ADMIN_SESSION_TTL_MS) {
    adminSessions.delete(token);
    return false;
  }
  return true;
}

export function requireAdminAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  if (!isValidAdminToken(token)) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  next();
}
