"""
Jesus Journey / My Jesus Journey — Church Aggregate Report Generator
======================================================================
REVISED 2026-08-28 after reviewing 5 real sample church reports supplied
by Dennis (Sample-Church-Group-Report-4.pdf, Sample-Church-Report-2019-29.pdf,
and companions). See dennis_files_analysis_part2.md for the full evidence
trail. This version REPLACES the church-level statistic shape used in the
first draft of this script, which was wrong (see "WHAT CHANGED" below).

WHY THIS EXISTS
----------------
Mike reported that the original database export and his one-off aggregation
script were both lost. The legacy ASP.NET application (recovered from the
Dropbox source-code folder) only ever computed and displayed an INDIVIDUAL
report per respondent (a/results/default.aspx.cs) — it never contained any
code that grouped responses by church/community code or produced a church-
level report. That logic must have lived only in the missing script or was
run by hand against the database.

This script reconstructs that missing "church report" step from first
principles, using materials we do have:
  1. The exact per-item -> pathway formulas, reverse-engineered read-only
     from a/results/default.aspx.cs (confirmed to match pathways.md exactly).
  2. The exact pathway -> goal grouping and goal names from pathways.md.
  3. The exact STATISTIC SHAPE confirmed by reading 5 real sample church
     reports Dennis provided (see dennis_files_analysis_part2.md).
  4. The known database shape: tblResponses rows keyed by sg_respid, with
     item columns B1-B9/K1-K9/A1-A9/L1-L9/P1-P9/C1-C9/T1-T9 (all 1-5 ints),
     a "journey" level column, and (per the landing-page code) a community/
     org code that must travel with each response somehow -- see the
     ORG_COLUMN_NAME note below, since the recovered code does not show
     tblResponses gaining an org column directly.

WHAT CHANGED FROM THE FIRST DRAFT (important)
----------------------------------------------
The first draft of this script guessed that church-level output would look
like the INDIVIDUAL report's output: a 1-5 average score per pathway, plus
high/medium/low band counts using the 3.79/3.50 thresholds. Real sample
church reports supplied by Dennis prove this guess wrong on every point:

  1. Church-level numbers are PERCENTAGES ("% who said this is always or
     most of the time true for them"), never 1-5 averages. Direct quote
     from the real Action Guide: "The numbers in the Church Report are
     mostly percentages."
  2. There is NO high/medium/low banding anywhere in a real church report.
     That treatment (and the 3.79/3.50 thresholds) is unique to the
     INDIVIDUAL report's green/orange item coloring, which itself uses a
     different cutpoint (item value > 3), not 3.79/3.50.
  3. There is no single combined "goal score" — each goal's page shows its
     4 pathways as 4 separate percentage bars, side by side.
  4. Item- and pathway-level percentages are cross-tabbed by the
     respondent's self-reported SPIRITUAL MATURITY GROUP (Exploring /
     Believing / Trusting / God Centered at the item level; Believing /
     Trusting / Centered only at the pathway-summary level, with Exploring
     explicitly excluded there as "too few / less comparable").
  5. Real church reports also include Demographics, Spiritual Maturity
     Profile, and Spiritual Change Profile sections that are out of scope
     for this pathway-scoring script (they aggregate different survey
     questions, not the 63 pathway items) — flagged as a known gap below,
     not silently invented.

This version keeps the INDIVIDUAL-report-style 1-5 average + band output
(validated by real individual-report examples with hand-checkable numbers —
see dennis_files_analysis_part2.md §3/§4/§9) as `score_respondent()` /
`individual_report()`, and adds a SEPARATE, percentage-based
`aggregate_church()` that matches the real church report shape.

KNOWN GAP — the spiritual maturity group mapping
--------------------------------------------------
Real church reports segment every statistic by a 4-5 level self-reported
"spiritual maturity" question (Distant / Exploring / Believing in God /
Trusting God / God Centered), separate from the 63 pathway items. The
recovered source code stores a `journey` integer column and branches on
`journey < 3` vs `journey >= 3`, but nowhere DEFINES what journey values
1/2/3/4/5 mean in maturity-group terms. This script assumes (needs Mike/
Dennis confirmation):
    journey 1 -> Distant, 2 -> Exploring, 3 -> Believing in God,
    4 -> Trusting God, 5 -> God Centered
This is a reasonable guess (matches the 5-level ordinal language used
throughout the sample reports and the code's own <3 vs >=3 partial-survey
split lining up with "Distant/Exploring have fewer questions") but is NOT
confirmed against source code or real data yet. If Mike's export uses a
different scale or a separate maturity column, update MATURITY_LABELS
and/or point --maturity-column at the right field.

IMPORTANT DATA-QUALITY NOTE (from source-code review)
------------------------------------------------------
The legacy app has a confirmed save bug: when it writes computed pathway
scores back to tblResponses, the `path12` column is saved with the `path11`
value (copy-paste parameter error in the UPDATE statement). If your
historical export's `path12` column was populated by that legacy app
(rather than computed fresh from raw items), IT IS WRONG. This script
therefore always recomputes all 16 pathway scores directly from the raw
1-5 item columns and ignores any pre-computed path1..path16 columns in the
input, so this bug cannot propagate into new church reports.

USAGE
-----
    python3 church_report.py responses.csv --org-column org --out report.json

Input file: CSV or JSON. Each row/record needs:
  - one column identifying the church/community ("org" by default; override
    with --org-column if your export uses a different name, e.g. "cmtycode")
  - the 63 item columns named exactly: B1-B9, K1-K9, A1-A9, L1-L9, P1-P9,
    C1-C9, T1-T9 (case-insensitive; script also accepts lowercase)
  - optionally a "journey" column (int, 1-5). Used both for the individual-
    report partial-survey scoring path (journey<3) AND, per real church
    report evidence, as the spiritual-maturity cross-tab dimension (see
    KNOWN GAP above). If missing, every response is treated as a full
    survey and excluded from the maturity cross-tab.

Run with --self-test and no other arguments to run a built-in sanity check
against hand-computed examples instead of reading any file.
"""

import argparse
import csv
import json
import sys
from dataclasses import dataclass, field
from statistics import mean
from typing import Optional


# ---------------------------------------------------------------------------
# 1. Pathway definitions — reverse-engineered from a/results/default.aspx.cs
#    lines 101-116, cross-checked against pathways.md (Jesus-Journey-pathways
#    -5-10-17.docx). Each pathway is (items_full_survey, items_partial_survey).
#    When items_partial_survey is None, the formula is identical in both
#    branches (this is true for 12 of the 16 pathways).
# ---------------------------------------------------------------------------

PATHWAYS = {
    1:  {"name": "Believing God's Story",     "goal": 1, "items": ["K1", "K2", "K3", "K4", "K5"]},
    2:  {"name": "Receiving God's Love",       "goal": 1, "items": ["B1", "B2", "B5", "T1"]},
    3:  {"name": "My Identity",                "goal": 1, "items": ["B6", "T2", "T4"]},
    4:  {"name": "Facing Challenges",          "goal": 1, "items": ["B7", "T5", "T6"]},
    5:  {"name": "Responding to God",          "goal": 2, "items": ["C1", "C2", "C3", "T9"]},
    6:  {"name": "Communicating with God",     "goal": 2, "items": ["B3", "B4", "C7", "T8"]},
    7:  {"name": "Growing my Faith",           "goal": 2, "items": ["C4", "C5", "C8", "P6"]},
    8:  {"name": "Worshipping",                "goal": 2, "items": ["C6", "T7", "A6"]},
    9:  {"name": "Expressing God's Love",      "goal": 3, "items": ["B8", "K8", "T3", "L9", "P8"]},
    10: {"name": "Practicing my Faith",        "goal": 3, "items": ["A1", "A3", "L7", "P1", "P4"]},
    11: {"name": "Journeying with Others",     "goal": 3, "items": ["A7", "A8", "A9", "P5"]},
    12: {"name": "Reconciling",                "goal": 3, "items": ["A4", "L2", "L3"]},
    13: {"name": "Partnering with God",        "goal": 4, "items": ["B9", "K6", "K7", "L8", "P3"]},
    14: {"name": "Stewarding Resources",       "goal": 4, "items": ["C9", "A2", "A5", "L4"]},
    15: {"name": "Showing Compassion",         "goal": 4, "items": ["L1", "P2", "P9", "P7"]},
    16: {"name": "Acting Justly",              "goal": 4, "items": ["K9", "L5", "L6"]},
}

GOALS = {
    1: "Trusting God in your life",
    2: "Experiencing God's presence",
    3: "Reflecting God's life with others",   # Decided 2026-08-29: goal renamed "Expressing Jesus" -> "Reflecting Jesus" for consistency
    4: "Serving God in your community",
}

# journey < 3 ("partial survey") overrides — pathway 3 is zeroed out (no
# items exist at that journey level), pathways 4, 5, 15 collapse to a single
# item instead of an average. Source: a/results/default.aspx.cs lines 118-136.
PARTIAL_SURVEY_OVERRIDES = {
    3:  None,          # zeroed out entirely — excluded from partial-survey averages, not scored as 0
    4:  ["T5"],
    5:  ["C1"],
    15: ["P2"],
}

# Score-band thresholds — INDIVIDUAL REPORT ONLY. Confirmed absent from every
# real church report (see dennis_files_analysis_part2.md). Source of the
# thresholds themselves: a/results/default.aspx.cs lines 1265-1267.
HIGH_THRESHOLD = 3.79   # score > 3.79 => "high"
MED_THRESHOLD = 3.50    # 3.50 <= score <= 3.79 => "medium"; score < 3.50 => "low"

# Item-level "strength" (green) vs "growth edge" (orange) cut point — source:
# a/results/default.aspx.cs "int strength = 3; if (itemValue > strength)...".
# This is the SAME cutpoint used for the church report's item-level and
# pathway-level "% always/mostly true" statistic (value >= 4 on the 1-5
# scale), confirmed against real sample church reports.
ITEM_STRENGTH_CUTPOINT = 3
ALWAYS_MOSTLY_CUTPOINT = 4  # item value >= 4 counts as "always or most of the time true"

# Spiritual maturity group labels, keyed by the `journey` column.
# ASSUMED MAPPING — NOT CONFIRMED against source code or real data yet.
# See "KNOWN GAP" note in the module docstring. Real reports use these
# exact 5 category names; church-wide SUMMARY charts (pathway/goal % bars)
# further restrict to only the 3 largest groups (excluding Distant/
# Exploring) per real-report convention — see EXCLUDED_FROM_SUMMARY_CROSSTAB.
MATURITY_LABELS = {
    1: "Distant",
    2: "Exploring",
    3: "Believing in God",
    4: "Trusting God",
    5: "God Centered",
}
# Per real church reports: the 16-pathway summary bar/line chart (pg 36-37
# equivalent) compares only Believing/Trusting/Centered, explicitly excluding
# Distant and Exploring as "too few / less comparable, fewer questions
# answered." Item-level tables (pg 20-33 equivalent) still show all 4-5
# groups (Distant is rare enough it's sometimes folded into Exploring).
SUMMARY_CROSSTAB_GROUPS = [3, 4, 5]


def band_for_score(score: float, journey: int) -> str:
    """Reproduce the legacy app's INDIVIDUAL REPORT band assignment exactly,
    including the 2-way (high/medium only) split used for journey<3
    responses. NOT used anywhere in church-level aggregation — see module
    docstring "WHAT CHANGED"."""
    if journey is not None and journey < 3:
        return "high" if score > HIGH_THRESHOLD else "medium"
    if score > HIGH_THRESHOLD:
        return "high"
    if score < MED_THRESHOLD:
        return "low"
    return "medium"


@dataclass
class RespondentScore:
    org: str
    journey: Optional[int]
    pathway_scores: dict  # {pathway_num: float or None} -- 1-5 average, individual-report style
    pathway_bands: dict   # {pathway_num: "high"|"medium"|"low"|None} -- individual-report style only
    item_values: dict     # raw 1-5 ints, for church-level "always/most of the time" % calcs


def score_respondent(row: dict, org_column: str) -> RespondentScore:
    """Compute all 16 pathway scores for one respondent row, reproducing the
    legacy scoring engine exactly but always from raw items (never trusting
    a pre-stored path12 column, which the legacy app saved incorrectly).
    This produces the INDIVIDUAL-report-style 1-5 average per pathway (see
    individual_report() below) as well as the raw item values needed for
    the church-level percentage aggregation (see aggregate_church())."""
    # Normalize keys to uppercase item codes; tolerate case differences.
    norm = {k.upper(): v for k, v in row.items()}

    def item(code: str) -> int:
        v = norm.get(code.upper())
        if v is None or v == "":
            raise KeyError(f"Missing required item column '{code}' in row: {row}")
        return int(v)

    journey_raw = norm.get("JOURNEY")
    journey = int(journey_raw) if journey_raw not in (None, "") else None
    is_partial = journey is not None and journey < 3

    pathway_scores = {}
    pathway_bands = {}
    item_values = {}

    for pnum, pdef in PATHWAYS.items():
        items_to_use = pdef["items"]
        if is_partial and pnum in PARTIAL_SURVEY_OVERRIDES:
            override = PARTIAL_SURVEY_OVERRIDES[pnum]
            if override is None:
                pathway_scores[pnum] = None
                pathway_bands[pnum] = None
                continue
            items_to_use = override

        values = [item(code) for code in items_to_use]
        for code, v in zip(items_to_use, values):
            item_values[code] = v
        score = round(sum(values) / len(values), 2)
        pathway_scores[pnum] = score
        pathway_bands[pnum] = band_for_score(score, journey)

    # Also record every item this pathway config touches, even ones not used
    # under the partial-survey override, so church-level "% always/mostly
    # true" can still be computed per-item across the full instrument where
    # answered (church stats are not restricted to only the items used in
    # this respondent's individual-report pathway average).
    for pnum, pdef in PATHWAYS.items():
        for code in pdef["items"]:
            if code not in item_values and code.upper() in norm and norm[code.upper()] not in (None, ""):
                item_values[code] = int(norm[code.upper()])

    org = str(row.get(org_column, row.get(org_column.upper(), row.get(org_column.lower(), "UNKNOWN"))))
    return RespondentScore(org=org, journey=journey, pathway_scores=pathway_scores,
                            pathway_bands=pathway_bands, item_values=item_values)


def individual_report(r: RespondentScore) -> dict:
    """Reproduce the INDIVIDUAL report's own output shape: a 1-5 average per
    pathway plus a high/medium/low band, matching real individual-report
    examples hand-checked in dennis_files_analysis_part2.md (§3/§4/§9). This
    is per-respondent output, not a church aggregate."""
    return {
        "journey": r.journey,
        "pathways": {
            pnum: {
                "name": PATHWAYS[pnum]["name"],
                "score": r.pathway_scores.get(pnum),
                "band": r.pathway_bands.get(pnum),
            }
            for pnum in PATHWAYS
        },
    }


def _pct_always_mostly(values: list) -> Optional[dict]:
    if not values:
        return None
    return {"n": len(values), "pct": round(100 * sum(1 for v in values if v >= ALWAYS_MOSTLY_CUTPOINT) / len(values), 1)}


def aggregate_church(respondents: list) -> dict:
    """Produce the church-level rollup matching the REAL sample church
    report shape (confirmed against 5 real report PDFs — see
    dennis_files_analysis_part2.md), NOT the individual-report shape:

      - item-level "% always/mostly true (answered 4 or 5)", church-wide
        AND cross-tabbed by spiritual maturity group
      - pathway-level "% always/mostly true" = average of that pathway's
        item %'s, church-wide AND cross-tabbed by maturity group (restricted
        to Believing/Trusting/Centered for the cross-tab, per real-report
        convention of excluding Distant/Exploring there as too few/less
        comparable)
      - NO 1-5 averages, NO high/medium/low banding, NO single combined
        goal score — none of these appear in any real church report we
        reviewed. (They remain available per-respondent via
        individual_report() if a future individual-report code path needs
        them.)

    Demographics, Spiritual Maturity Profile, and Spiritual Change Profile
    sections seen in real church reports are OUT OF SCOPE here — they
    aggregate different survey questions (not the 63 pathway items) and
    are not modeled by this script. See module docstring.
    """
    n = len(respondents)
    result = {
        "respondent_count": n,
        "maturity_group_counts": {},
        "item_pct_always_mostly": {},          # church-wide, all respondents
        "item_pct_always_mostly_by_maturity": {},  # cross-tab, all 5 groups
        "pathways": {},
        "goals": {},
        "note": (
            "Percentages ('% always/mostly true', item value >= 4) are the "
            "statistic type confirmed in real church reports. No 1-5 "
            "averages or high/medium/low banding are included here -- "
            "those belong only to the individual report. Demographics, "
            "spiritual maturity profile, and spiritual change profile "
            "sections seen in real reports are out of scope for this script."
        ),
    }

    # --- maturity group counts (from `journey`, per KNOWN GAP mapping) ---
    for jnum, label in MATURITY_LABELS.items():
        cnt = sum(1 for r in respondents if r.journey == jnum)
        if cnt:
            result["maturity_group_counts"][label] = cnt
    unknown_journey = sum(1 for r in respondents if r.journey not in MATURITY_LABELS)
    if unknown_journey:
        result["maturity_group_counts"]["Unknown/missing"] = unknown_journey

    # --- item-level % always/mostly true, church-wide and by maturity ---
    all_item_codes = set()
    for pdef in PATHWAYS.values():
        all_item_codes.update(pdef["items"])
    for code in sorted(all_item_codes):
        vals = [r.item_values[code] for r in respondents if code in r.item_values]
        stat = _pct_always_mostly(vals)
        if stat:
            result["item_pct_always_mostly"][code] = stat

        by_group = {}
        for jnum, label in MATURITY_LABELS.items():
            group_vals = [r.item_values[code] for r in respondents
                           if r.journey == jnum and code in r.item_values]
            stat_g = _pct_always_mostly(group_vals)
            if stat_g:
                by_group[label] = stat_g
        if by_group:
            result["item_pct_always_mostly_by_maturity"][code] = by_group

    # --- pathway-level % = average of that pathway's item %'s ---
    for pnum, pdef in PATHWAYS.items():
        item_codes = pdef["items"]

        def pathway_pct(subset: list) -> Optional[dict]:
            per_item_pcts = []
            n_total = 0
            for code in item_codes:
                vals = [r.item_values[code] for r in subset if code in r.item_values]
                if vals:
                    per_item_pcts.append(100 * sum(1 for v in vals if v >= ALWAYS_MOSTLY_CUTPOINT) / len(vals))
                    n_total = max(n_total, len(vals))
            if not per_item_pcts:
                return None
            return {"n": n_total, "pct": round(mean(per_item_pcts), 1)}

        churchwide = pathway_pct(respondents)
        by_group = {}
        for jnum in SUMMARY_CROSSTAB_GROUPS:
            label = MATURITY_LABELS[jnum]
            subset = [r for r in respondents if r.journey == jnum]
            stat_g = pathway_pct(subset)
            if stat_g:
                by_group[label] = stat_g

        result["pathways"][pnum] = {
            "name": pdef["name"],
            "goal": pdef["goal"],
            "pct_always_mostly_churchwide": churchwide,
            "pct_always_mostly_by_maturity": by_group,  # Believing/Trusting/Centered only, per real-report convention
        }

    # --- goal sections: NOT a single rollup number -- just the list of
    # that goal's 4 pathway percentages, exactly as shown side-by-side on
    # each goal's real-report summary page. ---
    for gnum, gname in GOALS.items():
        member_pathways = [p for p, d in PATHWAYS.items() if d["goal"] == gnum]
        result["goals"][gnum] = {
            "name": gname,
            "pathway_numbers": member_pathways,
            "pathway_pct_churchwide": {
                p: result["pathways"][p]["pct_always_mostly_churchwide"] for p in member_pathways
            },
        }

    return result


def load_rows(path: str) -> list:
    if path.lower().endswith(".json"):
        with open(path) as f:
            data = json.load(f)
        return data if isinstance(data, list) else data.get("responses", data.get("rows", []))
    with open(path, newline="") as f:
        return list(csv.DictReader(f))


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("input", nargs="?", help="CSV or JSON file of response rows")
    ap.add_argument("--org-column", default="org", help="Column name holding the church/community code (default: org)")
    ap.add_argument("--out", default=None, help="Write JSON report to this path (default: stdout)")
    ap.add_argument("--individual", action="store_true",
                     help="Also emit per-respondent individual-report-style output (1-5 averages + bands) alongside the church aggregate")
    ap.add_argument("--self-test", action="store_true", help="Run built-in sanity check, ignore other args")
    args = ap.parse_args()

    if args.self_test or not args.input:
        run_self_test()
        return

    rows = load_rows(args.input)
    scored = [score_respondent(r, args.org_column) for r in rows]

    by_org = {}
    for r in scored:
        by_org.setdefault(r.org, []).append(r)

    report = {}
    for org, rs in by_org.items():
        entry = {"church_report": aggregate_church(rs)}
        if args.individual:
            entry["individual_reports"] = [individual_report(r) for r in rs]
        report[org] = entry

    output = json.dumps(report, indent=2)
    if args.out:
        with open(args.out, "w") as f:
            f.write(output)
        print(f"Wrote report for {len(by_org)} church/org group(s) to {args.out}")
    else:
        print(output)


def run_self_test():
    """Hand-verifiable sanity check: 4 fabricated respondents, one church,
    covering both the church-level % aggregation and the individual-report
    1-5 average, plus a real hand-checked individual-report vector from
    dennis_files_analysis_part2.md #3."""
    print("Running self-test...")
    base = {code: 3 for code in
            [f"{L}{n}" for L in "BKALPCT" for n in range(1, 10)]}

    # --- Individual-report hand-check: real numbers from
    # Example-JJ-Survey-report-6-9-19-6.pdf (dennis_files_analysis_part2.md #3)
    # Pathway 1 (K1-K5) should average to 4.0 given these values.
    real_example = dict(base)
    real_example.update({"org": "TESTCHURCH", "journey": 4,
                          "K1": 4, "K2": 4, "K3": 4, "K4": 4, "K5": 4})
    s_real = score_respondent(real_example, "org")
    assert s_real.pathway_scores[1] == 4.0, s_real.pathway_scores[1]
    ind = individual_report(s_real)
    assert ind["pathways"][1]["score"] == 4.0
    assert ind["pathways"][1]["band"] == "high"  # 4.0 > 3.79
    print("Individual-report hand-check (Pathway 1 = 4.0, band=high) PASSED.")

    # --- Church-level %-aggregation check: 2 respondents, pathway 1 items
    # answered 5,5,5,5,5 (both "always/mostly true", 4/5 counts as such) and
    # 1,1,1,1,1 (never true) -> church pathway1 % should be 50% (1 of 2
    # respondents "always/mostly true" on every item in the pathway).
    r1 = dict(base); r1.update({"org": "TESTCHURCH", "journey": 4,
                                 "K1": 5, "K2": 5, "K3": 5, "K4": 5, "K5": 5})
    r2 = dict(base); r2.update({"org": "TESTCHURCH", "journey": 3,
                                 "K1": 1, "K2": 1, "K3": 1, "K4": 1, "K5": 1})
    s1 = score_respondent(r1, "org")
    s2 = score_respondent(r2, "org")

    church = aggregate_church([s1, s2])
    p1 = church["pathways"][1]
    assert p1["pct_always_mostly_churchwide"]["pct"] == 50.0, p1
    assert church["maturity_group_counts"] == {"Trusting God": 1, "Believing in God": 1}, church["maturity_group_counts"]
    assert "band_counts" not in p1 and "average_score" not in p1, "church output must not contain individual-report fields"
    print("Church-level %-aggregation check (Pathway 1 = 50% always/mostly true, no banding) PASSED.")

    print(json.dumps(church["pathways"][1], indent=2))
    print(json.dumps(church["goals"][1], indent=2))
    print("\nAll self-tests PASSED.")


if __name__ == "__main__":
    main()
