// Location-based currency selection for Stripe Checkout.
//
// The site's DNS is proxied through Cloudflare (see project deployment
// notes), so every request Render receives already carries a `CF-IPCountry`
// header set by Cloudflare's edge from the visitor's IP — no external geo-IP
// lookup or extra API call needed. We map that 2-letter country code to one
// of four supported currencies; every other country falls back to CAD.

export type SupportedCurrency = "cad" | "usd" | "gbp" | "eur";

export const DEFAULT_CURRENCY: SupportedCurrency = "cad";

// Full Eurozone (countries where the Euro is legal tender), ISO 3166-1 alpha-2.
const EUROZONE_COUNTRIES = new Set([
  "AD", // Andorra (uses EUR by agreement)
  "AT", // Austria
  "BE", // Belgium
  "CY", // Cyprus
  "DE", // Germany
  "EE", // Estonia
  "ES", // Spain
  "FI", // Finland
  "FR", // France
  "GR", // Greece
  "HR", // Croatia
  "IE", // Ireland
  "IT", // Italy
  "LT", // Lithuania
  "LU", // Luxembourg
  "LV", // Latvia
  "MC", // Monaco (uses EUR by agreement)
  "MT", // Malta
  "NL", // Netherlands
  "PT", // Portugal
  "SI", // Slovenia
  "SK", // Slovakia
  "SM", // San Marino (uses EUR by agreement)
  "VA", // Vatican City (uses EUR by agreement)
]);

/**
 * Resolve the ISO 3166-1 alpha-2 country code for a request.
 * Cloudflare (fronting this app) sets `CF-IPCountry` at the edge. Falls back
 * to `XX` (Cloudflare's own "unknown" sentinel) when the header is absent,
 * e.g. in local development.
 */
export function countryFromRequest(req: { headers: Record<string, any> }): string {
  const header = req.headers["cf-ipcountry"];
  const code = Array.isArray(header) ? header[0] : header;
  return (code || "XX").toUpperCase();
}

/**
 * Map a country code to the currency Checkout should charge in.
 * CA -> CAD, US -> USD, GB -> GBP, any Eurozone country -> EUR,
 * everything else (including unknown) -> CAD.
 */
export function currencyForCountry(countryCode: string): SupportedCurrency {
  const code = countryCode.toUpperCase();
  if (code === "CA") return "cad";
  if (code === "US") return "usd";
  if (code === "GB") return "gbp";
  if (EUROZONE_COUNTRIES.has(code)) return "eur";
  return DEFAULT_CURRENCY;
}

export function currencyForRequest(req: { headers: Record<string, any> }): SupportedCurrency {
  return currencyForCountry(countryFromRequest(req));
}

export const CURRENCY_SYMBOLS: Record<SupportedCurrency, string> = {
  cad: "CA$",
  usd: "US$",
  gbp: "£",
  eur: "€",
};
