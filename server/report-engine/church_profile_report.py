"""
Jesus Journey / My Jesus Journey — Church Profile Report Generator
=====================================================================
Implements the four sections specified in `docs/church-report-extended-
design.md` that `church_report.py` intentionally leaves out of scope:
demographics, spiritual maturity profile, spiritual change profile, and
the verbatim comments report. These are plain percentage breakdowns and
group-bys against `responses` columns — no scoring formulas involved,
unlike the 16-pathway work in `church_report.py`.

Column names match `docs/data-model.md`'s `responses` table exactly:
    journey_post, spiritual_change, gender, age_group, relationship_status,
    attendance_frequency, tenure, small_group_frequency, volunteer_frequency,
    children_in_household, race_ethnicity, comment_text

IMPORTANT — confirmed against 4 real church reports (Canyonview 2017,
Durango 2017, Abby Vineyard 2017, Saint Philip's 2020):
  - The church report shows a SINGLE maturity distribution, from
    `journey_post` only (Gary's confirmed decision: "use the second self
    assessment"). No pre/post pair, no shift statistic.
  - Maturity cross-tab covers exactly 7 dimensions: gender, age_group,
    children_in_household (has-children, single %), tenure,
    attendance_frequency, small_group_frequency, volunteer_frequency.
    relationship_status and race_ethnicity are reported independently in
    demographics but are NOT cross-tabbed against maturity.
  - Change-profile cross-tab uses a DIFFERENT, collapsed 4-band scale
    ("Growing Significantly" / "Growing a little" / "Not Changing" /
    "Fading") against a narrower/differently-banded set of dimensions:
    gender, age (3 collapsed bands: 16-29/30-49/50+), tenure, maturity
    level (4 bands, Exploring/Believing/Trusting/Centered), and a single
    "attends every week" column (not the full 5-band frequency).
  - "If a group is missing it indicates zero percent" — omit zero-
    population bands from output rather than showing 0% rows, matching
    church_report.py's existing convention.

USAGE
-----
    python3 church_profile_report.py responses.csv --out profile.json

Input file: CSV or JSON, one row per respondent, using the column names
above (case-insensitive). Missing/blank fields are treated as "unknown"
and excluded from that field's breakdown (but not from other sections).

Run with --self-test and no other arguments for a built-in sanity check.
"""

import argparse
import csv
import json
from collections import OrderedDict
from typing import Optional


# ---------------------------------------------------------------------------
# Category orderings — used both to validate/normalize input values and to
# produce output in the same fixed order real reports use (not alphabetical,
# not insertion order).
# ---------------------------------------------------------------------------

MATURITY_LABELS = OrderedDict([
    (1, "Distant"),
    (2, "Exploring"),
    (3, "Believing in God"),
    (4, "Trusting God"),
    (5, "God Centered"),
])
# 4-band collapse used only by the change-profile cross-tab's maturity column
# (Distant folded into Exploring, per real-report convention of dropping/
# merging near-zero Distant elsewhere too).
MATURITY_4BAND = OrderedDict([
    (1, "Exploring"), (2, "Exploring"),
    (3, "Believing in God"),
    (4, "Trusting God"),
    (5, "God Centered"),
])

CHANGE_LABELS = OrderedDict([
    (1, "Growing significantly"),
    (2, "Growing a little"),
    (3, "About the same"),
    (4, "Fading somewhat"),
    (5, "Fading a lot"),
])
# Collapsed 4-band scale used ONLY by the change-profile cross-tab, per
# church-report-extended-design.md section 3.
CHANGE_4BAND = OrderedDict([
    (1, "Growing Significantly"),
    (2, "Growing a little"),
    (3, "Not Changing"),      # collapsed from "About the same"
    (4, "Fading"),            # collapsed from "Fading somewhat"
    (5, "Fading"),            # collapsed from "Fading a lot"
])

AGE_BANDS = ["16-19", "20-29", "30-39", "40-49", "50-59", "60 and older"]
# 3-band collapse used ONLY by the change-profile cross-tab.
AGE_3BAND_MAP = {
    "16-19": "16-29", "20-29": "16-29",
    "30-39": "30-49", "40-49": "30-49",
    "50-59": "50+", "60 and older": "50+",
}
AGE_3BAND_ORDER = ["16-29", "30-49", "50+"]

TENURE_BANDS = ["Less than 1 year", "1-2 years", "3-5 years", "6-10 years", "11 or more years"]
# NOTE: these category lists must match the exact option strings the live
# survey form saves (shared/questions.ts) -- they are matched verbatim, not
# fuzzy-matched, and any value not present here is silently dropped from
# that chart (see _rows_from_breakdown in report_builder.py). Fixed 2026-09-02
# after finding the previous plural/wording mismatches were causing several
# demographic categories to always read 0%.
FREQUENCY_BANDS = ["Every week", "A few times/month", "Monthly", "Every few months", "Infrequently or never"]
RELATIONSHIP_STATUS_CATEGORIES = [
    "Independent single", "Single in relationship", "Married",
    "Married but separated", "Divorced", "Civil legal partnership",
]
RACE_ETHNICITY_CATEGORIES = [
    "White/Caucasian", "Black/African descent", "Native People/First Nations",
    "Asian descent", "East Indian descent", "Hispanic descent", "From multiple races",
]
CHILDREN_BANDS = ["None", "0-2 year old(s)", "3-5 year old(s)", "6-10 year old(s)", "11-18 year old(s)", "19 or older"]

# The 7 dimensions cross-tabbed against maturity (church-report-extended-
# design.md section 2). relationship_status and race_ethnicity deliberately
# excluded.
MATURITY_CROSSTAB_DIMENSIONS = [
    "gender", "age_group", "children_in_household", "tenure",
    "attendance_frequency", "small_group_frequency", "volunteer_frequency",
]


def _norm_row(row: dict) -> dict:
    """Normalize keys to lowercase for case-insensitive column lookup."""
    return {k.lower(): v for k, v in row.items()}


def _clean(v) -> Optional[str]:
    if v is None:
        return None
    v = str(v).strip()
    return v if v else None


def _pct_breakdown(values: list, category_order: Optional[list] = None) -> dict:
    """Plain % breakdown of a list of category values. Omits zero-count
    categories (real-report convention: 'if a group is missing it indicates
    zero percent'). If category_order is given, output follows that order
    for categories that are present; unexpected values are appended at the
    end in first-seen order."""
    n = len(values)
    if n == 0:
        return {"n": 0, "breakdown": {}}
    counts = OrderedDict()
    for v in values:
        counts[v] = counts.get(v, 0) + 1

    ordered_keys = []
    if category_order:
        for cat in category_order:
            if cat in counts:
                ordered_keys.append(cat)
        for cat in counts:
            if cat not in ordered_keys:
                ordered_keys.append(cat)
    else:
        ordered_keys = list(counts.keys())

    breakdown = OrderedDict()
    for cat in ordered_keys:
        breakdown[cat] = {
            "n": counts[cat],
            "pct": round(100 * counts[cat] / n, 1),
        }
    return {"n": n, "breakdown": breakdown}


def _multiselect_pct(values_lists: list, category_order: Optional[list] = None) -> dict:
    """% of respondents (denominator = all respondents who answered this
    question at all) whose multi-select answer includes each band. Matches
    the real report's 'children in household' treatment: '% of church' per
    band, not a single mutually-exclusive breakdown."""
    respondents_with_answer = [vs for vs in values_lists if vs]
    n = len(respondents_with_answer)
    if n == 0:
        return {"n": 0, "breakdown": {}}
    counts = OrderedDict()
    for vs in respondents_with_answer:
        for v in vs:
            counts[v] = counts.get(v, 0) + 1

    ordered_keys = []
    if category_order:
        for cat in category_order:
            if cat in counts:
                ordered_keys.append(cat)
        for cat in counts:
            if cat not in ordered_keys:
                ordered_keys.append(cat)
    else:
        ordered_keys = list(counts.keys())

    breakdown = OrderedDict()
    for cat in ordered_keys:
        breakdown[cat] = {"n": counts[cat], "pct": round(100 * counts[cat] / n, 1)}
    return {"n": n, "breakdown": breakdown}


def _parse_multiselect(raw) -> list:
    """children_in_household is a multi-select; accept either a real list
    (JSON input) or a delimited string (CSV input, '|' or ',' separated)."""
    if raw is None:
        return []
    if isinstance(raw, list):
        return [_clean(v) for v in raw if _clean(v)]
    s = str(raw).strip()
    if not s:
        return []
    sep = "|" if "|" in s else ","
    return [p.strip() for p in s.split(sep) if p.strip()]


# ---------------------------------------------------------------------------
# 1. Demographics profile
# ---------------------------------------------------------------------------

def demographics_profile(rows: list) -> dict:
    """% breakdown for each of the 9 demographic dimensions reported
    independently in real church reports. No cross-tabs here."""
    norm_rows = [_norm_row(r) for r in rows]

    def col(name):
        return [_clean(r.get(name)) for r in norm_rows if _clean(r.get(name)) is not None]

    gender_vals = col("gender")
    age_vals = col("age_group")
    relationship_vals = col("relationship_status")
    attendance_vals = col("attendance_frequency")
    tenure_vals = col("tenure")
    small_group_vals = col("small_group_frequency")
    volunteer_vals = col("volunteer_frequency")
    race_vals = col("race_ethnicity")
    children_lists = [_parse_multiselect(r.get("children_in_household")) for r in norm_rows]

    return {
        "sample_size": len(norm_rows),
        "gender": _pct_breakdown(gender_vals),
        "age_group": _pct_breakdown(age_vals, AGE_BANDS),
        "relationship_status": _pct_breakdown(relationship_vals, RELATIONSHIP_STATUS_CATEGORIES),
        "attendance_frequency": _pct_breakdown(attendance_vals, FREQUENCY_BANDS),
        "tenure": _pct_breakdown(tenure_vals, TENURE_BANDS),
        "small_group_frequency": _pct_breakdown(small_group_vals, FREQUENCY_BANDS),
        "volunteer_frequency": _pct_breakdown(volunteer_vals, FREQUENCY_BANDS),
        "children_in_household": _multiselect_pct(children_lists, CHILDREN_BANDS),
        "race_ethnicity": _pct_breakdown(race_vals, RACE_ETHNICITY_CATEGORIES),
    }


# ---------------------------------------------------------------------------
# 2. Spiritual Maturity Profile
# ---------------------------------------------------------------------------

def maturity_profile(rows: list) -> dict:
    """% breakdown of journey_post into the 5 named maturity bands, plus a
    cross-tab against exactly the 7 confirmed dimensions. Uses journey_post
    ONLY (Gary's confirmed decision: 'use the second self assessment') --
    no pre/post pair, no shift statistic, per church-report-extended-
    design.md section 2."""
    norm_rows = [_norm_row(r) for r in rows]

    def maturity_label(r):
        raw = r.get("journey_post")
        if raw in (None, ""):
            return None
        try:
            j = int(raw)
        except (TypeError, ValueError):
            return None
        return MATURITY_LABELS.get(j)

    labels = [maturity_label(r) for r in norm_rows]
    valid_labels = [l for l in labels if l is not None]
    overall = _pct_breakdown(valid_labels, list(MATURITY_LABELS.values()))

    # IMPORTANT — cross-tab direction: real church reports show, for each
    # demographic VALUE (e.g. "Women", "30-39", "6-10 years"), the %
    # breakdown ACROSS the maturity groups (columns) -- i.e. "of people in
    # this demographic band, what % are at each maturity level". This is
    # the opposite conditional direction from grouping by maturity level
    # first and breaking down demographics within each group. The
    # dim_crosstab structure below is therefore keyed by demographic VALUE
    # at the top level, with a maturity-group breakdown nested inside.
    maturity_label_order = list(MATURITY_LABELS.values())
    crosstab = {}
    for dim in MATURITY_CROSSTAB_DIMENSIONS:
        if dim == "children_in_household":
            # Special case: the report shows a single "Have children" row
            # with its % breakdown across maturity groups (same direction
            # as other dims), not a per-maturity-group has-children %.
            dim_crosstab = OrderedDict()
            has_children_labels = []
            for r, l in zip(norm_rows, labels):
                if l is None:
                    continue
                lst = _parse_multiselect(r.get(dim))
                if not lst:
                    continue
                if lst != ["None"]:
                    has_children_labels.append(l)
            if has_children_labels:
                dim_crosstab["Have children"] = _pct_breakdown(has_children_labels, maturity_label_order)
            if dim_crosstab:
                crosstab[dim] = dim_crosstab
            continue

        order = {
            "age_group": AGE_BANDS, "tenure": TENURE_BANDS,
            "attendance_frequency": FREQUENCY_BANDS,
            "small_group_frequency": FREQUENCY_BANDS,
            "volunteer_frequency": FREQUENCY_BANDS,
        }.get(dim)

        # Group respondents by demographic value first, in that value's
        # canonical order (or first-seen order if unordered), then compute
        # each group's maturity-label breakdown.
        dim_values = [_clean(r.get(dim)) for r in norm_rows]
        seen_order = list(order) if order else []
        for v in dim_values:
            if v is not None and v not in seen_order:
                seen_order.append(v)

        dim_crosstab = OrderedDict()
        for value in seen_order:
            subset_labels = [l for v, l in zip(dim_values, labels) if v == value and l is not None]
            if subset_labels:
                dim_crosstab[value] = _pct_breakdown(subset_labels, maturity_label_order)
        if dim_crosstab:
            crosstab[dim] = dim_crosstab

    return {
        "sample_size": len(valid_labels),
        "distribution": overall,
        "crosstab_by_dimension": crosstab,
        "note": (
            "Single distribution from journey_post only (the post-survey "
            "restatement, per Gary's confirmed decision to use 'the second "
            "self assessment'). No pre/post shift statistic -- no real "
            "church report reviewed shows one. Cross-tab covers exactly 7 "
            "dimensions (gender, age_group, children_in_household, tenure, "
            "attendance_frequency, small_group_frequency, "
            "volunteer_frequency); relationship_status and race_ethnicity "
            "are reported independently in demographics_profile() but are "
            "never cross-tabbed against maturity in real reports. "
            "Cross-tab direction: keyed by demographic VALUE, each holding "
            "a % breakdown ACROSS the 5 maturity groups (columns) -- e.g. "
            "crosstab_by_dimension['gender']['Women'] gives the % of women "
            "at each maturity level, matching the real report's table "
            "orientation (rows=demographic values, columns=maturity groups)."
        ),
    }


# ---------------------------------------------------------------------------
# 3. Spiritual Change Profile
# ---------------------------------------------------------------------------

def change_profile(rows: list) -> dict:
    """% breakdown of spiritual_change into the 5 named bands (pie-chart
    form), plus a SEPARATE collapsed 4-band cross-tab against: gender,
    age (3 collapsed bands), tenure, maturity level (4 bands), and
    attendance-every-week (single column). Per church-report-extended-
    design.md section 3, this cross-tab is narrower and differently-banded
    than maturity_profile()'s -- do not reuse that cross-tab's shape."""
    norm_rows = [_norm_row(r) for r in rows]

    def change_label(r):
        raw = r.get("spiritual_change")
        if raw in (None, ""):
            return None
        try:
            c = int(raw)
        except (TypeError, ValueError):
            return None
        return CHANGE_LABELS.get(c)

    def change_4band(r):
        raw = r.get("spiritual_change")
        if raw in (None, ""):
            return None
        try:
            c = int(raw)
        except (TypeError, ValueError):
            return None
        return CHANGE_4BAND.get(c)

    def maturity_4band(r):
        raw = r.get("journey_post")
        if raw in (None, ""):
            return None
        try:
            j = int(raw)
        except (TypeError, ValueError):
            return None
        return MATURITY_4BAND.get(j)

    labels = [change_label(r) for r in norm_rows]
    valid_labels = [l for l in labels if l is not None]
    overall = _pct_breakdown(valid_labels, list(CHANGE_LABELS.values()))

    band4 = [change_4band(r) for r in norm_rows]
    change_4band_order = ["Growing Significantly", "Growing a little", "Not Changing", "Fading"]

    def crosstab_column(get_group_label, group_order=None):
        col = OrderedDict()
        groups = [get_group_label(r) for r in norm_rows]
        seen_order = group_order or []
        for g in groups:
            if g is not None and g not in seen_order:
                seen_order.append(g)
        for g in seen_order:
            subset_bands = [b for b, gg in zip(band4, groups) if gg == g and b is not None]
            if subset_bands:
                col[g] = _pct_breakdown(subset_bands, change_4band_order)
        return col

    crosstab = {
        "gender": crosstab_column(lambda r: _clean(r.get("gender"))),
        "age_3band": crosstab_column(
            lambda r: AGE_3BAND_MAP.get(_clean(r.get("age_group"))), AGE_3BAND_ORDER
        ),
        "tenure": crosstab_column(lambda r: _clean(r.get("tenure")), TENURE_BANDS),
        "maturity_4band": crosstab_column(maturity_4band, list(dict.fromkeys(MATURITY_4BAND.values()))),
        "attends_every_week": crosstab_column(
            lambda r: ("Every week" if _clean(r.get("attendance_frequency")) == "Every week"
                       else ("Less than every week" if _clean(r.get("attendance_frequency")) is not None else None)),
            ["Every week", "Less than every week"],
        ),
    }
    crosstab = {k: v for k, v in crosstab.items() if v}

    return {
        "sample_size": len(valid_labels),
        "distribution": overall,
        "crosstab_by_dimension_4band": crosstab,
        "note": (
            "Pie-chart distribution uses the full 5-band scale. The "
            "cross-tab uses a DIFFERENT collapsed 4-band scale (Growing "
            "Significantly / Growing a little / Not Changing / Fading) "
            "against a narrower set of dimensions than the maturity "
            "profile's cross-tab: gender, age (3 collapsed bands), tenure, "
            "maturity level (4 bands), and a single attends-every-week "
            "column -- confirmed from real report page 16 (Canyonview)."
        ),
    }


# ---------------------------------------------------------------------------
# 4. Comments report
# ---------------------------------------------------------------------------

def comments_report(rows: list) -> dict:
    """Verbatim comment_text, grouped by journey_post maturity band, each
    comment tagged only by gender -- no other demographics, no scores, no
    aggregation. Matches the confirmed structure of real Comments-report
    PDFs exactly."""
    norm_rows = [_norm_row(r) for r in rows]
    groups = OrderedDict((label, []) for label in MATURITY_LABELS.values())
    unclassified = []

    for r in norm_rows:
        text = _clean(r.get("comment_text"))
        if not text:
            continue
        raw = r.get("journey_post")
        label = None
        if raw not in (None, ""):
            try:
                label = MATURITY_LABELS.get(int(raw))
            except (TypeError, ValueError):
                label = None
        entry = {"gender": _clean(r.get("gender")) or "Unknown", "comment": text}
        if label:
            groups[label].append(entry)
        else:
            unclassified.append(entry)

    groups = OrderedDict((k, v) for k, v in groups.items() if v)
    result = {"by_maturity_group": groups}
    if unclassified:
        result["unclassified_missing_journey_post"] = unclassified
    return result


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

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
    ap.add_argument("--out", default=None, help="Write JSON report to this path (default: stdout)")
    ap.add_argument("--self-test", action="store_true", help="Run built-in sanity check, ignore other args")
    args = ap.parse_args()

    if args.self_test or not args.input:
        run_self_test()
        return

    rows = load_rows(args.input)
    report = {
        "demographics": demographics_profile(rows),
        "maturity_profile": maturity_profile(rows),
        "change_profile": change_profile(rows),
        "comments": comments_report(rows),
    }
    output = json.dumps(report, indent=2)
    if args.out:
        with open(args.out, "w") as f:
            f.write(output)
        print(f"Wrote church profile report to {args.out}")
    else:
        print(output)


def run_self_test():
    print("Running self-test...")
    rows = [
        {"journey_post": "4", "spiritual_change": "1", "gender": "Female", "age_group": "30-39",
         "tenure": "6-10 years", "attendance_frequency": "Every week", "small_group_frequency": "Every week",
         "volunteer_frequency": "A few times/month", "relationship_status": "Married",
         "race_ethnicity": "White/Caucasian", "children_in_household": "0-2 year old(s)|3-5 year old(s)", "comment_text": "Grateful for this church."},
        {"journey_post": "4", "spiritual_change": "2", "gender": "Male", "age_group": "40-49",
         "tenure": "11 or more years", "attendance_frequency": "Every week", "small_group_frequency": "Monthly",
         "volunteer_frequency": "Every week", "relationship_status": "Married",
         "race_ethnicity": "White/Caucasian", "children_in_household": "None", "comment_text": ""},
        {"journey_post": "5", "spiritual_change": "1", "gender": "Female", "age_group": "50-59",
         "tenure": "3-5 years", "attendance_frequency": "A few times/month", "small_group_frequency": "Every week",
         "volunteer_frequency": "Monthly", "relationship_status": "Divorced",
         "race_ethnicity": "From multiple races", "children_in_household": "None", "comment_text": "More prayer nights please."},
        {"journey_post": "2", "spiritual_change": "3", "gender": "Male", "age_group": "20-29",
         "tenure": "Less than 1 year", "attendance_frequency": "Monthly", "small_group_frequency": "Infrequently or never",
         "volunteer_frequency": "Infrequently or never", "relationship_status": "Independent single",
         "race_ethnicity": "Asian descent", "children_in_household": "", "comment_text": ""},
    ]

    demo = demographics_profile(rows)
    assert demo["sample_size"] == 4
    assert demo["gender"]["breakdown"]["Female"]["pct"] == 50.0, demo["gender"]
    print("demographics_profile PASSED.")

    mat = maturity_profile(rows)
    assert mat["sample_size"] == 4
    assert mat["distribution"]["breakdown"]["Trusting God"]["n"] == 2
    assert mat["distribution"]["breakdown"]["God Centered"]["n"] == 1
    assert "Distant" not in mat["distribution"]["breakdown"], "zero-count bands must be omitted"
    assert "relationship_status" not in mat["crosstab_by_dimension"], "must NOT cross-tab relationship_status"
    assert "race_ethnicity" not in mat["crosstab_by_dimension"], "must NOT cross-tab race_ethnicity"
    assert "gender" in mat["crosstab_by_dimension"]
    # Cross-tab direction: keyed by demographic VALUE (e.g. "Female"), each
    # holding a % breakdown ACROSS maturity groups -- NOT the other way
    # around. Row 1 (Female, journey_post=4 -> "Trusting God") and row 3
    # (Female, journey_post=5 -> "God Centered") are both female, so
    # "Female" should show a 50/50 split between those two groups.
    gender_xtab = mat["crosstab_by_dimension"]["gender"]
    assert "Female" in gender_xtab and "Male" in gender_xtab, "must be keyed by demographic value"
    assert gender_xtab["Female"]["breakdown"]["Trusting God"]["pct"] == 50.0, gender_xtab["Female"]
    assert gender_xtab["Female"]["breakdown"]["God Centered"]["pct"] == 50.0, gender_xtab["Female"]
    assert gender_xtab["Male"]["breakdown"]["Exploring"]["pct"] == 50.0, gender_xtab["Male"]
    assert gender_xtab["Male"]["breakdown"]["Trusting God"]["pct"] == 50.0, gender_xtab["Male"]
    print("maturity_profile PASSED (no pre/post pair, correct 7-dim cross-tab in demographic->maturity direction, zero-bands omitted).")

    chg = change_profile(rows)
    assert chg["sample_size"] == 4
    assert chg["distribution"]["breakdown"]["Growing significantly"]["n"] == 2
    assert "maturity_4band" in chg["crosstab_by_dimension_4band"]
    mat4 = chg["crosstab_by_dimension_4band"]["maturity_4band"]
    assert set(mat4.keys()) <= {"Believing in God", "Trusting God", "God Centered", "Exploring"}
    print("change_profile PASSED (collapsed 4-band cross-tab, narrower dimension set).")

    com = comments_report(rows)
    assert "Trusting God" in com["by_maturity_group"]
    assert com["by_maturity_group"]["Trusting God"][0]["comment"] == "Grateful for this church."
    assert com["by_maturity_group"]["Trusting God"][0]["gender"] == "Female"
    assert "God Centered" in com["by_maturity_group"]
    print("comments_report PASSED (verbatim, grouped by maturity, tagged by gender only).")

    print("\nAll self-tests PASSED.")
    print(json.dumps({"demographics_sample": demo["age_group"], "maturity_sample": mat["distribution"]}, indent=2))


if __name__ == "__main__":
    main()
