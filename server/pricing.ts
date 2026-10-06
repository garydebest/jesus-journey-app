import type { SizeTier } from "@shared/schema";
import { REGION_CURRENCY, type PricingRegion, type SupportedCurrency } from "./currency";

// Approved Standard Plan prices (Gary, "Jesus Journey Pricing" sheet, October 6, 2026).
// Whole currency units. Canada and International are CAD; USA is USD; UK is GBP;
// Europe (Eurozone) is EUR. Each column is set directly, not converted.
// Ranges are total adults 16+ (attendance 16+ plus 50%), matching the public site.
export const PRICING_TIERS: Record<
  SizeTier,
  { label: string; min: number; max: number | null; prices: Record<PricingRegion, number> }
> = {
  upto_200:   { label: "200 members or less (16+)", min: 1,    max: 200,  prices: { canada: 499,  usa: 499,  uk: 249, europe: 309, international: 499 } },
  r201_400:   { label: "201–400 members (16+)",     min: 201,  max: 400,  prices: { canada: 799,  usa: 799,  uk: 399, europe: 479, international: 799 } },
  r401_700:   { label: "401–700 members (16+)",     min: 401,  max: 700,  prices: { canada: 999,  usa: 999,  uk: 499, europe: 599, international: 999 } },
  r701_1200:  { label: "701–1200 members (16+)",    min: 701,  max: 1200, prices: { canada: 1199, usa: 1199, uk: 599, europe: 719, international: 1199 } },
  r1201_1500: { label: "1201–1500 members (16+)",   min: 1201, max: 1500, prices: { canada: 1399, usa: 1399, uk: 699, europe: 839, international: 1399 } },
  over_1500:  { label: "Over 1500 members (16+)",   min: 1501, max: null, prices: { canada: 1599, usa: 1599, uk: 799, europe: 959, international: 1599 } },
};

/** The Standard Plan range for a church's total adults (16+). */
export function tierForAdults(adults: number): SizeTier {
  const n = Math.max(1, Math.floor(adults));
  return (Object.keys(PRICING_TIERS) as SizeTier[]).find((t) => {
    const { min, max } = PRICING_TIERS[t];
    return n >= min && (max === null || n <= max);
  })!;
}

export function priceForTier(tier: SizeTier, region: PricingRegion): { amount: number; currency: SupportedCurrency } {
  return { amount: PRICING_TIERS[tier].prices[region], currency: REGION_CURRENCY[region] };
}

export function priceCentsForTier(tier: SizeTier, region: PricingRegion): number {
  return Math.round(PRICING_TIERS[tier].prices[region] * 100);
}

export function publicPricingList(region: PricingRegion) {
  return (Object.keys(PRICING_TIERS) as SizeTier[]).map((tier) => ({
    tier,
    label: PRICING_TIERS[tier].label,
    min: PRICING_TIERS[tier].min,
    max: PRICING_TIERS[tier].max,
    price: PRICING_TIERS[tier].prices[region],
    currency: REGION_CURRENCY[region],
  }));
}
