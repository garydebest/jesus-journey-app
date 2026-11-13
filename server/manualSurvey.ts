// Administrator-entered church surveys with a hand-set price (November 2026).
//
// Gary can add a church (new or existing account) and a survey at any price.
// Three payment paths:
//   stripe         — the church pays by card. A stable link (/pay/<token>)
//                    always opens a live Stripe Checkout at the stored price,
//                    so a link in an email never goes stale (Checkout Sessions
//                    themselves expire after 24 hours).
//   offline        — paid outside Stripe (e-transfer, cheque). Marked paid now.
//   complimentary  — no charge. Marked paid now.
//
// Stripe needs no extra setup: Checkout uses inline price_data with the same
// Consulting Services tax code, GST/HST on top, post-payment invoice and
// webhook as the self-serve purchase. The custom price is the pre-tax
// subtotal; the existing subtotal check therefore still applies.
import { randomBytes } from "node:crypto";
import type { Church, SurveyWave } from "@shared/schema";
import { storage } from "./storage";
import { PRICING_TIERS } from "./pricing";
import { createCheckoutSession, retrieveCheckoutSession, sessionHasAutomaticTax, sessionMatchesWavePrice } from "./stripe";
import { appBaseUrl } from "./journeyConfig";
import { layout, type Block } from "./journeyTemplates";
import { sendEmailDetailed } from "./mailer";

export const newPaymentLinkToken = () => randomBytes(24).toString("base64url");

export function paymentLinkUrl(wave: Pick<SurveyWave, "paymentLinkToken">): string | null {
  return wave.paymentLinkToken ? `${appBaseUrl()}/pay/${wave.paymentLinkToken}` : null;
}

export function formatPrice(priceCents: number | null | undefined, currency: string | null | undefined): string {
  const amount = (priceCents ?? 0) / 100;
  const code = (currency || "cad").toUpperCase();
  return `${code} ${amount.toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function isAdminCustomStripeWave(wave: SurveyWave): boolean {
  return wave.pricingSource === "admin_custom" && wave.paymentMethod === "stripe";
}

export async function createCustomCheckout(wave: SurveyWave, church: Church) {
  const tier = wave.sizeTier && wave.sizeTier in PRICING_TIERS ? PRICING_TIERS[wave.sizeTier as keyof typeof PRICING_TIERS] : null;
  const base = appBaseUrl();
  const session = await createCheckoutSession({
    amountCents: wave.priceCents ?? 0,
    currency: wave.currency,
    productName: `Jesus Journey Standard Plan${tier ? ` — ${tier.label}` : ""}`,
    productDescription: `${wave.label} for ${church.name}`,
    // Back to the stable pay link: it confirms the payment with Stripe and
    // shows "already paid" without needing the church to sign in first.
    successUrl: paymentLinkUrl(wave) ?? `${base}/#/dashboard?checkout=success&wave=${wave.id}`,
    cancelUrl: `${base}/#/dashboard?checkout=cancelled&wave=${wave.id}`,
    customerEmail: church.primaryContactEmail,
    metadata: { waveId: wave.id, churchId: church.id, sizeTier: wave.sizeTier ?? "", pricingSource: "admin_custom" },
  });
  await storage.setWaveCheckoutSession(wave.id, session.id);
  return session as { id: string; url: string };
}

export type CheckoutOutcome =
  | { kind: "paid"; wave: SurveyWave }
  | { kind: "open"; url: string }
  | { kind: "processing" }
  | { kind: "unavailable" };

/**
 * For an unpaid admin-entered Stripe survey: reuse the open Checkout, record
 * a payment Stripe already took, or start a fresh Checkout once the old one
 * has expired. Never replaces a session whose payment may still settle.
 */
export async function openCustomCheckout(wave: SurveyWave, onPaid: (waveId: string) => unknown): Promise<CheckoutOutcome> {
  if (!isAdminCustomStripeWave(wave) || wave.status !== "pending_payment" || wave.paymentStatus !== "unpaid") return { kind: "unavailable" };
  const church = await storage.getChurchById(wave.churchId);
  if (!church) return { kind: "unavailable" };
  if (wave.stripeCheckoutSessionId) {
    const session = await retrieveCheckoutSession(wave.stripeCheckoutSessionId);
    if (session.payment_status === "paid") {
      if (!sessionMatchesWavePrice(session, wave)) return { kind: "unavailable" };
      const updated = await storage.markWavePaid(wave.id, session.payment_intent ?? undefined);
      void onPaid(wave.id);
      return { kind: "paid", wave: updated ?? wave };
    }
    if (session.status === "open" && sessionHasAutomaticTax(session)) return { kind: "open", url: session.url };
    if (session.status === "complete") return { kind: "processing" }; // async payment still settling
  }
  const fresh = await createCustomCheckout(wave, church);
  return { kind: "open", url: fresh.url };
}

/** Email to the church's primary contact about an admin-entered survey. */
export async function sendManualSurveyEmail(church: Church, wave: SurveyWave, opts: { setupUrl?: string | null }) {
  const first = (church.primaryContactName || "").trim().split(/\s+/)[0] || "there";
  const price = formatPrice(wave.priceCents, wave.currency);
  const payUrl = paymentLinkUrl(wave);
  const blocks: Block[] = [
    { kind: "p", text: `We have set up a Jesus Journey Church Survey for ${church.name}: ${wave.label}.` },
  ];
  if (wave.paymentMethod === "stripe") {
    blocks.push({ kind: "p", text: `The agreed price is ${price}, plus any applicable GST/HST. You can pay securely by card through Stripe. A receipt and invoice are emailed once payment is complete.` });
    blocks.push({ kind: "booking", label: "Pay for your survey", href: payUrl });
  } else if (wave.paymentMethod === "offline") {
    blocks.push({ kind: "p", text: "Your payment has been recorded, so your survey is reserved and your dashboard is ready." });
  } else {
    blocks.push({ kind: "p", text: "This survey is provided at no charge, so it is reserved and your dashboard is ready." });
  }
  if (opts.setupUrl) {
    blocks.push({ kind: "p", text: "We have also created your church's Jesus Journey account. Choose a password to sign in to your dashboard. This link works once and expires in seven days; after that, use Forgot password on the sign-in page." });
    blocks.push({ kind: "button", label: "Choose your password", href: opts.setupUrl });
  } else {
    blocks.push({ kind: "button", label: "Open your dashboard", href: `${appBaseUrl()}/#/dashboard` });
  }
  blocks.push({ kind: "p", text: "Your next step after payment is to book your required Survey Orientation. Your participant code activates once the orientation is complete." });
  const subject = wave.paymentMethod === "stripe" ? "Your Jesus Journey survey is ready for payment" : "Your Jesus Journey survey is reserved";
  const email = layout(subject, `${wave.label} for ${church.name}`, `Hello ${first},`, blocks, ["With gratitude,", "Jesus Journey"]);
  return sendEmailDetailed({ to: church.primaryContactEmail, subject: email.subject, html: email.html, text: email.text });
}
