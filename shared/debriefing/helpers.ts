// Shared numeric/statistical helpers for the debriefing analysis engine.

/** Minimum subgroup size before a finding is reported at full confidence.
 *  Below this, the same finding is still surfaced (churches are small and a
 *  real pattern in 8 people is still worth knowing) but flagged directionalOnly. */
export const MIN_SUBGROUP_N = 15;

/** Minimum percentage-point (on a 0-5 scale, expressed as points) gap before
 *  a comparison is worth reporting at all — avoids noise-level differences. */
export const MATERIALITY_THRESHOLD = 0.3; // ~8-10% of the 0-5 scale

export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function pct(count: number, total: number): number {
  return total > 0 ? round2((count / total) * 100) : 0;
}

export function numericValues(rows: any[], field: string): number[] {
  return rows.map((r) => r[field]).filter((v): v is number => typeof v === "number");
}

/** True when a subgroup is large enough to report without a caveat. */
export function meetsSampleFloor(n: number): boolean {
  return n >= MIN_SUBGROUP_N;
}

/** True when a numeric gap is large enough to be worth mentioning. */
export function isMaterial(gap: number): boolean {
  return Math.abs(gap) >= MATERIALITY_THRESHOLD;
}
