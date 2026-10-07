// QA for Stripe Tax checkout parameters (no network: fetch is stubbed).
import assert from "node:assert/strict";
import { createCheckoutSession, sessionHasAutomaticTax, sessionMatchesWavePrice, JJ_TAX_CODE } from "../server/stripe";
import { PRICING_TIERS, priceCentsForTier } from "../server/pricing";

process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "sk_test_placeholder";

(async () => {
  let body = "";
  (globalThis as any).fetch = async (_url: string, init: any) => { body = decodeURIComponent(init.body); return { ok: true, json: async () => ({ id: "cs_test" }) }; };
  await createCheckoutSession({ amountCents: 49900, currency: "cad", productName: "P", productDescription: "D", successUrl: "https://x/s", cancelUrl: "https://x/c", customerEmail: "a@b.c", metadata: { waveId: "w1" } });
  const has = (s: string) => assert.ok(body.split("&").includes(s), `missing ${s}`);
  has("automatic_tax[enabled]=true");
  has("billing_address_collection=required");
  has("line_items[0][price_data][tax_behavior]=exclusive");
  has(`line_items[0][price_data][product_data][tax_code]=${JJ_TAX_CODE}`);
  has("line_items[0][price_data][unit_amount]=49900");
  has("mode=payment");
  has("metadata[waveId]=w1");
  has("invoice_creation[enabled]=true");
  assert.ok(/invoice_creation\[invoice_data\]\[account_tax_ids\]\[0\]=txi_/.test(body), "seller tax id on invoice");
  assert.ok(!body.includes("shipping_address_collection"), "no shipping address");
  assert.ok(!body.includes("customer_update"), "no customer_update without customer");
  assert.equal(JJ_TAX_CODE, "txcd_20060048");

  // Base prices unchanged.
  const ca = Object.values(PRICING_TIERS).map((t) => t.prices.canada);
  assert.deepEqual(ca, [499, 799, 999, 1199, 1399, 1599]);
  assert.equal(priceCentsForTier("upto_200", "uk"), 24900);
  assert.equal(priceCentsForTier("upto_200", "europe"), 30900);

  // Payment checks compare pre-tax subtotal, not total.
  const wave = { priceCents: 49900, currency: "cad" };
  assert.ok(sessionMatchesWavePrice({ amount_subtotal: 49900, amount_total: 52395, currency: "cad" }, wave));
  assert.ok(!sessionMatchesWavePrice({ amount_subtotal: 100, amount_total: 105, currency: "cad" }, wave));
  assert.ok(!sessionMatchesWavePrice({ amount_subtotal: 49900, amount_total: 49900, currency: "usd" }, wave));
  // Pre-tax sessions are never resumed.
  assert.ok(!sessionHasAutomaticTax({ automatic_tax: { enabled: false } }));
  assert.ok(sessionHasAutomaticTax({ automatic_tax: { enabled: true } }));

  // Stripe error → thrown (route then refuses checkout; no tax-disabled fallback).
  (globalThis as any).fetch = async () => ({ ok: false, status: 400, json: async () => ({ error: { message: "tax failed" } }) });
  await assert.rejects(() => createCheckoutSession({ amountCents: 1, currency: "cad", productName: "P", productDescription: "D", successUrl: "s", cancelUrl: "c", metadata: {} }));
  console.log("stripe-tax QA: all checks passed");
})().catch((e) => { console.error(e); process.exit(1); });
