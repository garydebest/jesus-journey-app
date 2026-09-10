// ---------------------------------------------------------------------------
// The 7 psychometric dimensions underlying the 63 survey items, as defined by
// Gary for the Debriefing Report. These are a different cut of the same 63
// items than PATHWAYS (shared/pathways.ts): pathways/goals are the
// ministry-facing 16/4 grouping shown to churches, while dimensions are the
// underlying belief/practice structure used for the admin-only debriefing
// analysis. Every item belongs to exactly one dimension and is tagged as
// either a "belief" item (does the person believe something) or a
// "practice" item (does the person do something) — 18 belief items (B, K)
// and 45 practice items (A, L, P, C, T), confirmed against the live item set.
// ---------------------------------------------------------------------------

export type ItemType = "belief" | "practice";

export interface DimensionDef {
  id: string;
  name: string;
  type: ItemType;
  items: string[];
}

export const DIMENSIONS: DimensionDef[] = [
  {
    id: "beliefs-gods-character",
    name: "My Beliefs — God's Character & Relationship",
    type: "belief",
    items: ["B1", "B2", "B3", "B4", "B5", "B6", "B7", "B8", "B9"],
  },
  {
    id: "beliefs-kingdom-story",
    name: "My Beliefs — God's Kingdom Story",
    type: "belief",
    items: ["K1", "K2", "K3", "K4", "K5", "K6", "K7", "K8", "K9"],
  },
  {
    id: "identity-life-with-god",
    name: "My Identity — Life with God Practices",
    type: "practice",
    items: ["C1", "C2", "C3", "C4", "C5", "C6", "C7", "C8", "C9"],
  },
  {
    id: "identity-inner-life",
    name: "My Identity — Inner Life Practices",
    type: "practice",
    items: ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8", "T9"],
  },
  {
    id: "actions-relationships",
    name: "My Actions — Relationships & Growth",
    type: "practice",
    items: ["A1", "A2", "A3", "A4", "A5", "A6", "A7", "A8", "A9"],
  },
  {
    id: "actions-compassion-justice",
    name: "My Actions — Compassion & Justice",
    type: "practice",
    items: ["L1", "L2", "L3", "L4", "L5", "L6", "L7", "L8", "L9"],
  },
  {
    id: "actions-partnering-with-god",
    name: "My Actions — Partnering with God for Others",
    type: "practice",
    items: ["P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8", "P9"],
  },
];

/** Item code -> dimension lookup, built once at module load. */
export const ITEM_TO_DIMENSION: Record<string, DimensionDef> = (() => {
  const out: Record<string, DimensionDef> = {};
  for (const dim of DIMENSIONS) {
    for (const code of dim.items) out[code] = dim;
  }
  return out;
})();

/** Item code -> belief|practice lookup. 18 belief items, 45 practice items. */
export const ITEM_TYPE: Record<string, ItemType> = (() => {
  const out: Record<string, ItemType> = {};
  for (const dim of DIMENSIONS) {
    for (const code of dim.items) out[code] = dim.type;
  }
  return out;
})();

export const BELIEF_ITEM_CODES = DIMENSIONS.filter((d) => d.type === "belief").flatMap((d) => d.items);
export const PRACTICE_ITEM_CODES = DIMENSIONS.filter((d) => d.type === "practice").flatMap((d) => d.items);
