import type { SizeTier } from "@shared/schema";

// Placeholder prices — edit these dollar amounts any time; no migration needed.
// Amounts are in whole US dollars; converted to cents when building the
// Stripe Checkout Session.
export const PRICING_TIERS: Record<SizeTier, { label: string; description: string; priceUsd: number }> = {
  small: {
    label: "Small church",
    description: "Up to ~75 congregants",
    priceUsd: 49,
  },
  medium: {
    label: "Medium church",
    description: "About 75–250 congregants",
    priceUsd: 99,
  },
  large: {
    label: "Large church",
    description: "About 250–750 congregants",
    priceUsd: 149,
  },
  extra_large: {
    label: "Extra large church",
    description: "750+ congregants",
    priceUsd: 249,
  },
};

export function priceCentsForTier(tier: SizeTier): number {
  return Math.round(PRICING_TIERS[tier].priceUsd * 100);
}

export function publicPricingList() {
  return (Object.keys(PRICING_TIERS) as SizeTier[]).map((tier) => ({
    tier,
    ...PRICING_TIERS[tier],
  }));
}
