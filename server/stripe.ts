// Thin Stripe REST client built on fetch (not the `stripe` npm SDK), so calls
// route through the sandbox's injected-credential HTTPS proxy correctly.
//
// Required env vars (see server/index.ts / README for how they're supplied):
//   CUSTOM_CRED_API_STRIPE_COM_URL   — base URL for the Stripe API proxy
//   CUSTOM_CRED_API_STRIPE_COM_TOKEN — bearer token injected by the credential proxy
//   STRIPE_WEBHOOK_SECRET            — webhook signing secret (whsec_...), set directly
//   STRIPE_SECRET_KEY                — fallback: raw secret key when not using the proxy (e.g. in production)

import crypto from "node:crypto";

function stripeBaseUrl(): string {
  return process.env.CUSTOM_CRED_API_STRIPE_COM_URL || "https://api.stripe.com";
}

function stripeAuthToken(): string | undefined {
  return process.env.CUSTOM_CRED_API_STRIPE_COM_TOKEN || process.env.STRIPE_SECRET_KEY;
}

export function isStripeConfigured(): boolean {
  return Boolean(stripeAuthToken());
}

function toFormBody(params: Record<string, any>, prefix = ""): string[] {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    const fullKey = prefix ? `${prefix}[${key}]` : key;
    if (Array.isArray(value)) {
      value.forEach((v, i) => {
        if (typeof v === "object" && v !== null) {
          parts.push(...toFormBody(v, `${fullKey}[${i}]`));
        } else {
          parts.push(`${encodeURIComponent(`${fullKey}[${i}]`)}=${encodeURIComponent(String(v))}`);
        }
      });
    } else if (typeof value === "object") {
      parts.push(...toFormBody(value, fullKey));
    } else {
      parts.push(`${encodeURIComponent(fullKey)}=${encodeURIComponent(String(value))}`);
    }
  }
  return parts;
}

async function stripeRequest(path: string, params: Record<string, any>): Promise<any> {
  const token = stripeAuthToken();
  if (!token) {
    throw new Error("Stripe is not configured (missing secret key credential).");
  }
  const body = toFormBody(params).join("&");
  const res = await fetch(`${stripeBaseUrl()}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const json = await res.json();
  if (!res.ok) {
    const message = json?.error?.message || `Stripe API error (${res.status})`;
    throw new Error(message);
  }
  return json;
}

export interface CreateCheckoutSessionArgs {
  amountCents: number;
  productName: string;
  productDescription: string;
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string;
  metadata: Record<string, string>;
}

export async function createCheckoutSession(args: CreateCheckoutSessionArgs) {
  return stripeRequest("/v1/checkout/sessions", {
    mode: "payment",
    success_url: args.successUrl,
    cancel_url: args.cancelUrl,
    customer_email: args.customerEmail,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: args.amountCents,
          product_data: {
            name: args.productName,
            description: args.productDescription,
          },
        },
      },
    ],
    metadata: args.metadata,
  });
}

export async function retrieveCheckoutSession(sessionId: string) {
  const token = stripeAuthToken();
  if (!token) throw new Error("Stripe is not configured (missing secret key credential).");
  const res = await fetch(`${stripeBaseUrl()}/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message || `Stripe API error (${res.status})`);
  return json;
}

// ---------------------------------------------------------------------------
// Webhook signature verification (Stripe-Signature header, HMAC-SHA256)
// ---------------------------------------------------------------------------
export function verifyStripeWebhookSignature(
  rawBody: Buffer,
  signatureHeader: string | undefined,
  secret: string,
  toleranceSeconds = 300,
): { valid: boolean; reason?: string } {
  if (!signatureHeader) return { valid: false, reason: "missing Stripe-Signature header" };
  const parts = Object.fromEntries(
    signatureHeader.split(",").map((kv) => {
      const [k, v] = kv.split("=");
      return [k, v];
    }),
  );
  const timestamp = parts["t"];
  const signature = parts["v1"];
  if (!timestamp || !signature) return { valid: false, reason: "malformed Stripe-Signature header" };

  const signedPayload = `${timestamp}.${rawBody.toString("utf8")}`;
  const expected = crypto.createHmac("sha256", secret).update(signedPayload, "utf8").digest("hex");

  const expectedBuf = Buffer.from(expected, "utf8");
  const actualBuf = Buffer.from(signature, "utf8");
  const sigMatches = expectedBuf.length === actualBuf.length && crypto.timingSafeEqual(expectedBuf, actualBuf);
  if (!sigMatches) return { valid: false, reason: "signature mismatch" };

  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (age > toleranceSeconds) return { valid: false, reason: "timestamp outside tolerance" };

  return { valid: true };
}
