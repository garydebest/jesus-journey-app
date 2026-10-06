// Approved Standard Plan pricing (October 6, 2026). Unit checks always run;
// HTTP checks run when QA_BASE_URL points at a local server.
import assert from "node:assert/strict";
import { PRICING_TIERS, tierForAdults, priceCentsForTier, publicPricingList } from "../server/pricing";
import { regionForCountry, REGION_CURRENCY } from "../server/currency";
import { SIZE_TIERS } from "../shared/schema";

let n = 0; const check = (name: string, fn: () => void | Promise<void>) => (async () => { await fn(); n++; console.log("PASS", name); })();

const SHEET: Record<string, number[]> = { // Canada, USA, UK, Europe, International — exactly as supplied
  upto_200: [499, 499, 249, 309, 499], r201_400: [799, 799, 399, 479, 799], r401_700: [999, 999, 499, 599, 999],
  r701_1200: [1199, 1199, 599, 719, 1199], r1201_1500: [1399, 1399, 699, 839, 1399], over_1500: [1599, 1599, 799, 959, 1599],
};
await check("all 30 prices match the approved sheet", () => {
  assert.deepEqual(Object.keys(PRICING_TIERS), [...SIZE_TIERS]);
  for (const [tier, row] of Object.entries(SHEET)) {
    const p = PRICING_TIERS[tier as keyof typeof PRICING_TIERS].prices;
    assert.deepEqual([p.canada, p.usa, p.uk, p.europe, p.international], row, tier);
  }
});
await check("regions and currencies", () => {
  assert.equal(regionForCountry("CA"), "canada"); assert.equal(regionForCountry("US"), "usa");
  assert.equal(regionForCountry("GB"), "uk"); assert.equal(regionForCountry("DE"), "europe"); assert.equal(regionForCountry("IE"), "europe");
  for (const c of ["AU", "NZ", "KE", "CH", "NO", "XX", "T1"]) assert.equal(regionForCountry(c), "international", c);
  assert.deepEqual(REGION_CURRENCY, { canada: "cad", usa: "usd", uk: "gbp", europe: "eur", international: "cad" });
});
await check("range boundaries", () => {
  const cases: [number, string][] = [[16, "upto_200"], [200, "upto_200"], [201, "r201_400"], [400, "r201_400"], [401, "r401_700"], [700, "r401_700"],
    [701, "r701_1200"], [1200, "r701_1200"], [1201, "r1201_1500"], [1500, "r1201_1500"], [1501, "over_1500"], [50000, "over_1500"]];
  for (const [adults, tier] of cases) assert.equal(tierForAdults(adults), tier, String(adults));
});
await check("Stripe amounts in cents", () => {
  assert.equal(priceCentsForTier("upto_200", "canada"), 49900);
  assert.equal(priceCentsForTier("upto_200", "international"), 49900);
  assert.equal(priceCentsForTier("over_1500", "uk"), 79900);
  assert.equal(publicPricingList("europe")[2].price, 599); assert.equal(publicPricingList("europe")[2].currency, "eur");
});

const base = process.env.QA_BASE_URL;
if (base) {
  const get = (country: string, origin?: string) => fetch(`${base}/api/pricing`, { headers: { "cf-ipcountry": country, ...(origin ? { origin } : {}) } });
  await check("API prices by visitor country", async () => {
    for (const [c, region, cur, first] of [["CA", "canada", "cad", 499], ["US", "usa", "usd", 499], ["GB", "uk", "gbp", 249], ["FR", "europe", "eur", 309], ["AU", "international", "cad", 499]] as const) {
      const j = await (await get(c)).json();
      assert.equal(j.region, region); assert.equal(j.currency, cur); assert.equal(j.tiers.length, 6); assert.equal(j.tiers[0].price, first);
    }
  });
  await check("CORS only for jesusjourney.life", async () => {
    assert.equal((await get("CA", "https://jesusjourney.life")).headers.get("access-control-allow-origin"), "https://jesusjourney.life");
    assert.equal((await get("CA", "https://evil.example")).headers.get("access-control-allow-origin"), null);
  });
}
console.log(`${n} final pricing checks passed.`);
