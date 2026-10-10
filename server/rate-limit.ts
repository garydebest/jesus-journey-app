import type { Request, Response } from "express";
import { timingSafeEqual, createHash } from "node:crypto";

/**
 * Small in-memory limiter for sign-in and password-reset endpoints.
 * The app runs as a single Render instance, so process memory is sufficient.
 * Limits are keyed both by client address and by account (email/username), so
 * guessing one account is capped even if the attacker changes address.
 */
type Bucket = { count: number; resetAt: number };

export class Limiter {
  private buckets = new Map<string, Bucket>();
  constructor(readonly max: number, readonly windowMs: number, private now: () => number = Date.now) {}

  private live(key: string): Bucket | undefined {
    const b = this.buckets.get(key);
    if (b && b.resetAt <= this.now()) { this.buckets.delete(key); return undefined; }
    return b;
  }
  /** Seconds until the key may try again, or 0 if allowed. */
  blockedFor(key: string): number {
    const b = this.live(key);
    return b && b.count >= this.max ? Math.ceil((b.resetAt - this.now()) / 1000) : 0;
  }
  hit(key: string): void {
    const b = this.live(key);
    if (b) b.count++;
    else this.buckets.set(key, { count: 1, resetAt: this.now() + this.windowMs });
    if (this.buckets.size > 50_000) this.sweep();
  }
  clear(key: string): void { this.buckets.delete(key); }
  sweep(): void { const t = this.now(); this.buckets.forEach((b, k) => { if (b.resetAt <= t) this.buckets.delete(k); }); }
}

const MIN = 60_000;
export const limits = {
  // failed sign-ins
  loginPerAccount: new Limiter(5, 15 * MIN),
  loginPerAddress: new Limiter(20, 15 * MIN),
  adminPerAddress: new Limiter(5, 15 * MIN),
  adminGlobal: new Limiter(30, 15 * MIN),
  // password reset and signup requests (every request counts)
  resetRequestPerEmail: new Limiter(3, 60 * MIN),
  resetRequestPerAddress: new Limiter(10, 60 * MIN),
  resetCompletePerAddress: new Limiter(10, 15 * MIN),
  signupPerAddress: new Limiter(10, 60 * MIN),
};

export function clientAddress(req: Request): string {
  const h = (n: string) => { const v = req.headers[n]; return (Array.isArray(v) ? v[0] : v)?.trim(); };
  const xff = h("x-forwarded-for")?.split(",")[0]?.trim();
  return h("true-client-ip") || h("cf-connecting-ip") || xff || req.ip || req.socket.remoteAddress || "unknown";
}

export function accountKey(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

/** Returns true (and sends 429) if any of the keyed limiters is exhausted. */
export function rejectIfLimited(res: Response, checks: Array<[Limiter, string]>): boolean {
  const wait = Math.max(0, ...checks.filter(([, k]) => k).map(([l, k]) => l.blockedFor(k)));
  if (wait > 0) {
    res.setHeader("Retry-After", String(wait));
    res.status(429).json({ message: "Too many attempts. Please wait a few minutes and try again." });
    return true;
  }
  return false;
}

export function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}
