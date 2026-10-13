// ---------------------------------------------------------------------------
// Time-based one-time passwords (RFC 6238) for administrator two-factor
// sign-in, compatible with Apple Passwords, Google Authenticator, 1Password,
// Microsoft Authenticator and similar apps: SHA-1, 6 digits, 30-second steps.
// Secrets are encrypted at rest with AES-256-GCM using a key derived from the
// ADMIN_SECRET_KEY environment variable, so a database copy or backup alone
// cannot be used to generate codes.
// ---------------------------------------------------------------------------

import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const STEP_SECONDS = 30;
const DIGITS = 6;
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(buf: Buffer): string {
  let bits = 0, value = 0, out = "";
  for (const byte of Array.from(buf)) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(s: string): Buffer {
  const clean = s.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0, value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    value = (value << 5) | B32.indexOf(ch);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

export function currentStep(nowMs = Date.now()): number {
  return Math.floor(nowMs / 1000 / STEP_SECONDS);
}

export function totpAt(secretB32: string, step: number): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const mac = createHmac("sha1", base32Decode(secretB32)).update(counter).digest();
  const offset = mac[mac.length - 1] & 0x0f;
  const bin = ((mac[offset] & 0x7f) << 24) | (mac[offset + 1] << 16) | (mac[offset + 2] << 8) | mac[offset + 3];
  return String(bin % 10 ** DIGITS).padStart(DIGITS, "0");
}

/**
 * Checks a code against the previous, current and next 30-second step (to
 * allow for small clock differences). Returns the matching step, or null.
 * Callers must reject a step at or before the last accepted one (replay).
 */
export function verifyTotp(secretB32: string, code: string, nowMs = Date.now()): number | null {
  const digits = String(code ?? "").replace(/\s+/g, "");
  if (!/^\d{6}$/.test(digits)) return null;
  const now = currentStep(nowMs);
  for (const step of [now - 1, now, now + 1]) {
    const expected = Buffer.from(totpAt(secretB32, step));
    const given = Buffer.from(digits);
    if (expected.length === given.length && timingSafeEqual(expected, given)) return step;
  }
  return null;
}

export function otpauthUrl(secretB32: string, accountEmail: string): string {
  const issuer = "Jesus Journey Admin";
  const label = encodeURIComponent(`${issuer}:${accountEmail}`);
  return `otpauth://totp/${label}?secret=${secretB32}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${DIGITS}&period=${STEP_SECONDS}`;
}

// --- Encryption at rest -----------------------------------------------------

function encryptionKey(): Buffer {
  const raw = process.env.ADMIN_SECRET_KEY;
  if (!raw || raw.trim().length < 32) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("ADMIN_SECRET_KEY must be set (32+ characters) to use administrator two-factor sign-in");
    }
    return createHash("sha256").update("jesus-journey-dev-only-admin-secret").digest();
  }
  return createHash("sha256").update(raw.trim()).digest();
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), enc.toString("base64url")].join(".");
}

export function decryptSecret(stored: string): string {
  const [version, iv, tag, data] = String(stored).split(".");
  if (version !== "v1" || !iv || !tag || !data) throw new Error("Unrecognised secret format");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
}

/** Throws in production when the encryption key is missing, so startup can warn early. */
export function assertAdminSecretKeyConfigured(): void {
  encryptionKey();
}
