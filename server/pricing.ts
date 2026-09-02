import type { SizeTier } from "@shared/schema";
import type { SupportedCurrency } from "./currency";

// Placeholder prices — edit these whole-currency-unit amounts any time; no
// migration needed. Set each currency's price yourself (not an automatic
// conversion) so you control margins/rounding per market.
// Amounts are in whole units (dollars/pounds/euros); converted to the
// currency's smallest unit (cents) when building the Stripe Checkout Session.
export const PRICING_TIERS: Record<
  SizeTier,
  { label: string; description: string; prices: Record<SupportedCurrency, number> }
> = {
  small: {
    label: "Small church",
    description: "Up to ~75 congregants",
    prices: { cad: 65, usd: 49, gbp: 39, eur: 45 },
  },
  medium: {
    label: "Medium church",
    description: "About 75–250 congregants",
    prices: { cad: 129, usd: 99, gbp: 79, eur: 92 },
  },
  large: {
    label: "Large church",
    description: "About 250–750 congregants",
    prices: { cad: 195, usd: 149, gbp: 119, eur: 138 },
  },
  extra_large: {
    label: "Extra large church",
    description: "750+ congregants",
    prices: { cad: 325, usd: 249, gbp: 199, eur: 230 },
  },
};

export function priceCentsForTier(tier: SizeTier, currency: SupportedCurrency): number {
  return Math.round(PRICING_TIERS[tier].prices[currency] * 100);
}

export function publicPricingList(currency: SupportedCurrency) {
  return (Object.keys(PRICING_TIERS) as SizeTier[]).map((tier) => ({
    tier,
    label: PRICING_TIERS[tier].label,
    description: PRICING_TIERS[tier].description,
    price: PRICING_TIERS[tier].prices[currency],
    currency,
  }));
}
