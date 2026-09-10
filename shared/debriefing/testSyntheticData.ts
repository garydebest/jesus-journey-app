import { ITEM_CODES } from "../schema";

/**
 * Generates a synthetic "Grace Fellowship" respondent set with deliberate,
 * known patterns baked in, so the debriefing engine's findings can be
 * checked against ground truth before it ever touches a real church's data:
 *
 *  1. A pathway reversal: "Journeying with Others" (A7,A8,A9,P5) scores LOWER
 *     for "God Centered" respondents than for "Trusting" respondents.
 *  2. A top-stage growth plateau: "God Centered" respondents report much
 *     lower "currently growing" rates than earlier stages.
 *  3. A give/receive gap: A8/P5 (giving support) score higher than A7/A9
 *     (receiving support) for everyone — a one-directional relational pattern.
 *  4. A demographic gap: "60 and older" respondents average meaningfully
 *     higher maturity than "16-19" respondents.
 *  5. A belief-practice gap: belief items (B,K) score higher than practice
 *     items on average — stated belief outruns lived practice.
 *
 * Every other item/field is randomized within a plausible range so the
 * report also has to correctly report normal, low-signal areas as such.
 */

type SyntheticRow = Record<string, any>;

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function pick<T>(rand: () => number, arr: T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}

const AGE_GROUPS = ["16-19", "20-29", "30-39", "40-49", "50-59", "60 and older"];
const ATTENDANCE = ["Every week", "A few times/month", "Monthly", "Every few months", "Infrequently or never"];
const TENURE = ["Less than 1 year", "1-2 years", "3-5 years", "6-10 years", "11 or more years"];
const RELATIONSHIP = ["Independent single", "Single in relationship", "Married", "Married but separated", "Civil legal partnership", "Divorced"];
const ETHNICITY = ["White/Caucasian", "Black/African descent", "Native People/First Nations", "Asian descent", "East Indian descent", "Hispanic descent", "From multiple races"];
const GENDER = ["Male", "Female"];

const RECEIVING_CODES = new Set(["a7", "a9"]);
const GIVING_CODES = new Set(["a8", "p5"]);
const BELIEF_CODES = new Set(["b1", "b2", "b3", "b4", "b5", "b6", "b7", "b8", "b9", "k1", "k2", "k3", "k4", "k5", "k6", "k7", "k8", "k9"]);

export function generateGraceFellowshipSample(n = 210, seed = 42): SyntheticRow[] {
  const rand = seededRandom(seed);
  const rows: SyntheticRow[] = [];

  for (let i = 0; i < n; i++) {
    // Maturity stage: weight toward middle stages like a real mid-size church.
    const maturityRoll = rand();
    let maturity = 3;
    if (maturityRoll < 0.08) maturity = 1;
    else if (maturityRoll < 0.22) maturity = 2;
    else if (maturityRoll < 0.55) maturity = 3;
    else if (maturityRoll < 0.85) maturity = 4;
    else maturity = 5;

    const ageGroup = pick(rand, AGE_GROUPS);
    const ageIndex = AGE_GROUPS.indexOf(ageGroup);

    // Baseline item score correlates loosely with maturity stage.
    const baseline = 1.6 + maturity * 0.55 + (rand() - 0.5) * 0.6;

    const row: SyntheticRow = {
      journeyPost: maturity,
      journeyPre: clamp(maturity - (rand() < 0.4 ? 1 : 0), 1, 5),
      gender: pick(rand, GENDER),
      ageGroup,
      relationshipStatus: pick(rand, RELATIONSHIP),
      attendanceFrequency: maturity >= 4 ? pick(rand, ["Every week", "Every week", "A few times/month"]) : pick(rand, ATTENDANCE),
      tenure: pick(rand, TENURE),
      smallGroupFrequency: maturity >= 4 ? pick(rand, ["Every week", "A few times/month", "A few times/month"]) : pick(rand, ATTENDANCE),
      volunteerFrequency: maturity >= 4 ? pick(rand, ["Every week", "A few times/month", "Monthly"]) : pick(rand, ATTENDANCE),
      childrenInHousehold: rand() < 0.4 ? JSON.stringify([pick(rand, ["0-2 year old(s)", "3-5 year old(s)", "6-10 year old(s)", "11-18 year old(s)"])]) : JSON.stringify(["None"]),
      raceEthnicity: pick(rand, ETHNICITY),
      commentText: null,
    };

    // Item scores.
    for (const code of ITEM_CODES) {
      let value = baseline;

      // Pattern 3: give/receive gap on "Journeying with Others."
      if (GIVING_CODES.has(code)) value += 0.5;
      if (RECEIVING_CODES.has(code)) value -= 0.5;

      // Pattern 5: belief items run ~0.4 higher than practice items.
      if (BELIEF_CODES.has(code)) value += 0.35;

      // Pattern 1: A7/A8/A9/P5 ("Journeying with Others") reverses at the top
      // maturity stage — dips instead of climbing.
      if (["a7", "a8", "a9", "p5"].includes(code) && maturity === 5) {
        value -= 0.9;
      }

      // Pattern 4: age gap — older respondents skew higher across the board.
      value += (ageIndex - 2.5) * 0.12;

      value += (rand() - 0.5) * 0.8;
      row[code] = clamp(Math.round(value), 1, 5);
    }

    // Pattern 2: top-stage growth plateau. spiritualChange: 1=growing
    // significantly ... 5=fading a lot.
    if (maturity === 5) {
      row.spiritualChange = rand() < 0.75 ? pick(rand, [3, 3, 4]) : pick(rand, [1, 2]);
    } else {
      row.spiritualChange = rand() < 0.7 ? pick(rand, [1, 2, 2]) : pick(rand, [3, 4]);
    }

    rows.push(row);
  }

  return rows;
}
