// ---------------------------------------------------------------------------
// Outbound email via Zoho Mail SMTP. Used for the automated survey action
// plan reminders (see server/reminders.ts). Reads credentials from
// environment variables — if they're not set, sending is skipped and a
// warning is logged, so local/dev environments never crash for lack of
// email config.
// ---------------------------------------------------------------------------

import nodemailer from "nodemailer";

const SMTP_HOST = process.env.ZOHO_SMTP_HOST || "smtp.zoho.com";
const SMTP_PORT = Number(process.env.ZOHO_SMTP_PORT || 465);
const SMTP_USER = process.env.ZOHO_SMTP_USER; // e.g. admin@jesusjourney.life
const SMTP_PASS = process.env.ZOHO_SMTP_PASS; // Zoho app-specific password
const FROM_ADDRESS = process.env.ZOHO_FROM_ADDRESS || SMTP_USER;
const FROM_NAME = process.env.ZOHO_FROM_NAME || "Jesus Journey Survey";

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;

export function isMailerConfigured(): boolean {
  return !!(SMTP_USER && SMTP_PASS);
}

function getTransporter() {
  if (!isMailerConfigured()) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
  }
  return transporter;
}

export interface SendEmailArgs {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/**
 * Sends an email via Zoho SMTP. Returns true on success, false if mailer
 * isn't configured (env vars missing) or sending failed — callers should
 * treat false as "did not send" and log/skip accordingly, not throw.
 */
export async function sendEmail(args: SendEmailArgs): Promise<boolean> {
  const t = getTransporter();
  if (!t) {
    console.warn(`[mailer] Skipped sending "${args.subject}" to ${args.to} — ZOHO_SMTP_USER/ZOHO_SMTP_PASS not set.`);
    return false;
  }
  try {
    await t.sendMail({
      from: `"${FROM_NAME}" <${FROM_ADDRESS}>`,
      to: args.to,
      subject: args.subject,
      html: args.html,
      text: args.text,
    });
    return true;
  } catch (err) {
    console.error(`[mailer] Failed to send "${args.subject}" to ${args.to}:`, err);
    return false;
  }
}
