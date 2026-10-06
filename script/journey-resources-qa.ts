// Fails if any client-journey resource listed in the dashboard is missing from client/public.
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { JOURNEY_RESOURCES } from "../client/src/lib/journeyResources";
let missing = 0;
for (const r of Object.values(JOURNEY_RESOURCES)) {
  const p = join(process.cwd(), "client/public", r.href);
  if (!existsSync(p) || statSync(p).size < 1000) { console.error("MISSING", r.href); missing++; }
}
if (missing) process.exit(1);
console.log(`PASS: ${Object.keys(JOURNEY_RESOURCES).length} client-journey resources present`);
