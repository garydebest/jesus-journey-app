// Production dependency audit gate for scheduled and pull-request security checks.
// Fails on any high/critical advisory that has not been reviewed, so the weekly
// check only alerts on new problems. Reviewed advisories are still printed every run.
// To accept an advisory, add it below with the reason and review date; remove it once fixed.
import { execSync } from "node:child_process";

const REVIEWED = {
  // Styling build chain (tailwindcss -> chokidar/micromatch/fast-glob -> braces).
  // Build-time only; not in the compiled server graph (see docs/security/transitive-review-plan-2026-10-10.md).
  // Styling migration deferred by Gary on 2026-10-10. Re-review by 2027-01-10.
  "GHSA-vfj7-8cjw-p6xm": "braces stack exhaustion (build-time styling chain)",
  // tailwindcss / @tailwindcss/typography -> postcss-selector-parser. Moderate; same build-time chain.
  "GHSA-rj75-hqrm-r3gf": "postcss-selector-parser CPU exhaustion (build-time styling chain)",
};

let raw;
try {
  raw = execSync("npm audit --omit=dev --json", { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });
} catch (err) {
  raw = err.stdout; // npm audit exits non-zero whenever findings exist
}
const report = JSON.parse(raw);
if (report.error) { console.error("npm audit failed:", report.error); process.exit(2); }

const advisories = new Map();
for (const v of Object.values(report.vulnerabilities ?? {})) {
  for (const via of v.via) {
    if (typeof via !== "object") continue;
    const id = via.url.split("/").pop();
    advisories.set(id, { severity: via.severity, pkg: via.name, title: via.title, url: via.url });
  }
}

const blocking = [];
for (const [id, a] of advisories) {
  const reviewed = REVIEWED[id];
  console.log(`${reviewed ? "REVIEWED" : "NEW     "} ${a.severity.padEnd(8)} ${a.pkg} ${id} - ${a.title}`);
  if (!reviewed && (a.severity === "high" || a.severity === "critical")) blocking.push(id);
}
const stale = Object.keys(REVIEWED).filter((id) => !advisories.has(id));
if (stale.length) console.log(`Reviewed advisories no longer present (remove from list): ${stale.join(", ")}`);
console.log("Totals:", JSON.stringify(report.metadata?.vulnerabilities ?? {}));

if (blocking.length) {
  console.error(`FAIL: ${blocking.length} new high/critical advisory(ies): ${blocking.join(", ")}`);
  process.exit(1);
}
console.log("PASS: no new high or critical production advisories.");
