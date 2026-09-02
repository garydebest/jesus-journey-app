"""
build_from_aggregates() -- converts the real dict outputs of
church_report.aggregate_church() and church_profile_report.demographics_profile()
/ maturity_profile() / change_profile() into a ReportData instance that
build_full_report.py can render for ANY church, not just the Canyon View
2017 validation fixture.

Usage:
    from church_report import aggregate_church, score_respondent
    from church_profile_report import demographics_profile, maturity_profile, change_profile
    from report_builder import build_from_aggregates

    scored = [score_respondent(row) for row in raw_rows]
    agg = aggregate_church(scored)
    demo = demographics_profile(raw_rows)
    mat = maturity_profile(raw_rows)
    chg = change_profile(raw_rows)
    data = build_from_aggregates(
        church_name="First Church", report_date="8/29/2026",
        survey_period="8/1/2026 - 8/29/2026",
        aggregate=agg, demographics=demo, maturity=mat, change=chg,
    )
"""

from report_data import ReportData
from report_template_content import (
    PATHWAY_META,
    PATHWAY_ITEM_CODES,
    ITEM_TEXT,
    GOAL_SHORT_NAMES,
    GOAL_PATHWAY_NUMBERS,
    MATURITY_LABEL_DISPLAY,
    MATURITY_LABEL_ORDER_5BAND,
    MATURITY_LABEL_ORDER_4COL,
    CHANGE_LABEL_ORDER_4BAND,
    CHANGE_LABEL_ORDER_5BAND,
)


# ---------------------------------------------------------------------
# Display-label reconciliation: demographics_profile()/maturity_profile()
# use plain-hyphen / abbreviated category strings (matching the raw
# responses column values); the visual template uses slightly different
# cosmetic wording (en-dashes, "year old(s)" suffixes, spaced slashes).
# These maps translate aggregate-function category keys -> template
# display strings. Percentages/values are unaffected -- this is a
# label-only concern.
# ---------------------------------------------------------------------

AGE_DISPLAY = {
    "16-19": "16\u201319", "20-29": "20\u201329", "30-39": "30\u201339",
    "40-49": "40\u201349", "50-59": "50\u201359", "60 and older": "60 and older",
}
TENURE_DISPLAY = {
    "Less than 1 year": "Less than 1 year", "1-2 years": "1\u20132 years",
    "3-5 years": "3\u20135 years", "6-10 years": "6\u201310 years",
    "11 or more years": "11 or more years",
}
FREQUENCY_DISPLAY = {
    "Every week": "Every week", "A few times/month": "A few times/month",
    "Monthly": "Monthly", "Every few months": "Every few months",
    "Infrequently or never": "Infrequently or never",
}
# Engagement page (page 9) uses shorter forms for small-group/volunteer rows
# in the validated fixture ("Few times/month", "Infrequent/never") -- reuse
# the same shortened wording there, but the full wording for demographics'
# attendance row. Both are cosmetic aliases of the same FREQUENCY category.
FREQUENCY_DISPLAY_SHORT = {
    "Every week": "Every week", "A few times/month": "Few times/month",
    "Monthly": "Monthly", "Every few months": "Every few months",
    "Infrequently or never": "Infrequent/never",
}
RACE_DISPLAY = {
    "White/Caucasian": "White / Caucasian",
    "Black/African descent": "Black / African descent",
    "Native People/First Nations": "Native People / First Nations",
    "Asian descent": "Asian descent",
    "East Indian descent": "East Indian descent",
    "Hispanic descent": "Hispanic descent",
    "From multiple races": "Multiple races",
}
CHILDREN_DISPLAY = {
    "None": "None", "0-2 year old(s)": "0\u20132 year old(s)", "3-5 year old(s)": "3\u20135 year old(s)",
    "6-10 year old(s)": "6\u201310 year old(s)", "11-18 year old(s)": "11\u201318 year old(s)", "19 or older": "19 or older",
}
RELATIONSHIP_DISPLAY = {
    "Independent single": "Independent singles",
    "Single in relationship": "Singles in relationships",
    "Married": "Married",
    "Married but separated": "Married but separated",
    "Civil legal partnership": "Civil legal partnership",
    "Divorced": "Divorced",
}
# Canonical row order for the two categories whose category_order argument
# to _pct_breakdown differs from the template's own display order.
RELATIONSHIP_ORDER = [
    "Independent single", "Single in relationship", "Married",
    "Married but separated", "Civil legal partnership", "Divorced",
]
AGE_3BAND_DISPLAY = {"16-29": "16\u201329", "30-49": "30\u201349", "50+": "50 and older"}


def _pct(breakdown_dict, key):
    """Read a rounded % from a _pct_breakdown()-style {"breakdown": {...}}
    dict, defaulting to 0 when the category is absent (real-report
    convention: missing means zero)."""
    entry = breakdown_dict.get(key)
    return entry["pct"] if entry else 0


def _rows_from_breakdown(profile_dict, category_order, display_map):
    """Build a list[(display_label, pct)] in category_order, defaulting
    missing categories to 0, using display_map to translate the raw
    category key to the template's display string."""
    breakdown = profile_dict.get("breakdown", {})
    return [(display_map.get(cat, cat), round(_pct(breakdown, cat))) for cat in category_order]


def _maturity_row(dim_crosstab, value_key):
    """Read one row's 4-column [Exploring, Believing, Trusting, Centered]
    %'s from maturity_profile()'s crosstab_by_dimension[dim][value_key],
    defaulting missing maturity groups to 0."""
    entry = dim_crosstab.get(value_key)
    if not entry:
        return [0, 0, 0, 0]
    breakdown = entry.get("breakdown", {})
    return [round(_pct(breakdown, label)) for label in MATURITY_LABEL_ORDER_4COL]


def _change_row(dim_crosstab, value_key):
    """Read one row's 4-column [Growing Sig., Growing a little, Not
    Changing, Fading] %'s from change_profile()'s
    crosstab_by_dimension_4band[dim][value_key]."""
    entry = dim_crosstab.get(value_key)
    if not entry:
        return [0, 0, 0, 0]
    breakdown = entry.get("breakdown", {})
    return [round(_pct(breakdown, label)) for label in CHANGE_LABEL_ORDER_4BAND]


def build_from_aggregates(
    church_name: str,
    report_date: str,
    survey_period: str,
    aggregate: dict,
    demographics: dict,
    maturity: dict,
    change: dict,
) -> ReportData:
    """Convert real aggregate-function outputs into a ReportData instance.

    Parameters mirror the four aggregate functions' return dicts exactly:
      aggregate     = church_report.aggregate_church(scored_respondents)
      demographics  = church_profile_report.demographics_profile(raw_rows)
      maturity      = church_profile_report.maturity_profile(raw_rows)
      change        = church_profile_report.change_profile(raw_rows)
    """

    sample_size = aggregate["respondent_count"]

    # ---------------- Demographics (pages 7-8) ----------------
    gender_breakdown = demographics["gender"]["breakdown"]
    gender_pct_female = round(_pct(gender_breakdown, "Female"))

    age_group_order = ["16-19", "20-29", "30-39", "40-49", "50-59", "60 and older"]
    age_rows = _rows_from_breakdown(demographics["age_group"], age_group_order, AGE_DISPLAY)

    relationship_rows = _rows_from_breakdown(
        demographics["relationship_status"], RELATIONSHIP_ORDER, RELATIONSHIP_DISPLAY
    )

    children_order = ["None", "0-2 year old(s)", "3-5 year old(s)", "6-10 year old(s)", "11-18 year old(s)", "19 or older"]
    children_rows = _rows_from_breakdown(demographics["children_in_household"], children_order, CHILDREN_DISPLAY)

    race_order = [
        "White/Caucasian", "Black/African descent", "Native People/First Nations",
        "Asian descent", "East Indian descent", "Hispanic descent", "From multiple races",
    ]
    race_rows = _rows_from_breakdown(demographics["race_ethnicity"], race_order, RACE_DISPLAY)

    # ---------------- Engagement (page 9) ----------------
    tenure_order = ["Less than 1 year", "1-2 years", "3-5 years", "6-10 years", "11 or more years"]
    tenure_rows = _rows_from_breakdown(demographics["tenure"], tenure_order, TENURE_DISPLAY)

    freq_order = ["Every week", "A few times/month", "Monthly", "Every few months", "Infrequently or never"]
    attendance_rows = _rows_from_breakdown(demographics["attendance_frequency"], freq_order, FREQUENCY_DISPLAY)
    small_group_rows = _rows_from_breakdown(demographics["small_group_frequency"], freq_order, FREQUENCY_DISPLAY_SHORT)
    volunteer_rows = _rows_from_breakdown(demographics["volunteer_frequency"], freq_order, FREQUENCY_DISPLAY_SHORT)

    # ---------------- Spiritual maturity profile (pages 10-13) ----------------
    mat_breakdown = maturity["distribution"]["breakdown"]
    maturity_donut_values = [round(_pct(mat_breakdown, lbl), 1) for lbl in MATURITY_LABEL_ORDER_5BAND]
    trusting_plus_centered = _pct(mat_breakdown, "Trusting God") + _pct(mat_breakdown, "God Centered")
    maturity_combined_stat = f"{trusting_plus_centered:.1f}%"

    mat_xtab = maturity["crosstab_by_dimension"]

    def mat_dim(dim, value_key):
        return _maturity_row(mat_xtab.get(dim, {}), value_key)

    maturity_crosstab_1 = [
        ("GENDER", None),
        ("Women", mat_dim("gender", "Female")),
        ("Men", mat_dim("gender", "Male")),
        ("AGE", None),
        ("16\u201319", mat_dim("age_group", "16-19")),
        ("20\u201329", mat_dim("age_group", "20-29")),
        ("30\u201339", mat_dim("age_group", "30-39")),
        ("40\u201349", mat_dim("age_group", "40-49")),
        ("50\u201359", mat_dim("age_group", "50-59")),
        ("60 and older", mat_dim("age_group", "60 and older")),
        ("HAVE CHILDREN IN HOUSEHOLD (% each group)", None),
        ("Have children", mat_dim("children_in_household", "Have children")),
        ("TIME INVOLVED IN THIS CHURCH", None),
        ("Less than 1 year", mat_dim("tenure", "Less than 1 year")),
        ("1\u20132 years", mat_dim("tenure", "1-2 years")),
        ("3\u20135 years", mat_dim("tenure", "3-5 years")),
        ("6\u201310 years", mat_dim("tenure", "6-10 years")),
        ("11 or more years", mat_dim("tenure", "11 or more years")),
    ]

    maturity_crosstab_2 = [
        ("FREQUENCY OF ATTENDING CHURCH GATHERINGS", None),
        ("Every week", mat_dim("attendance_frequency", "Every week")),
        ("Few times per month", mat_dim("attendance_frequency", "A few times/month")),
        ("Monthly or less", [
            round(sum(_pct(mat_xtab.get("attendance_frequency", {}).get(v, {}).get("breakdown", {}), lbl)
                      for v in ("Monthly", "Every few months", "Infrequently or never")) / 3)
            if any(v in mat_xtab.get("attendance_frequency", {}) for v in ("Monthly", "Every few months", "Infrequently or never"))
            else 0
            for lbl in MATURITY_LABEL_ORDER_4COL
        ]),
        ("FREQUENCY OF SMALL GROUP INVOLVEMENT", None),
        ("Every week", mat_dim("small_group_frequency", "Every week")),
        ("Few times per month", mat_dim("small_group_frequency", "A few times/month")),
        ("Monthly", mat_dim("small_group_frequency", "Monthly")),
        ("Every few months", mat_dim("small_group_frequency", "Every few months")),
        ("Infrequently or never", mat_dim("small_group_frequency", "Infrequently or never")),
        ("FREQUENCY OF VOLUNTEERING", None),
        ("Every week", mat_dim("volunteer_frequency", "Every week")),
        ("Few times per month", mat_dim("volunteer_frequency", "A few times/month")),
        ("Monthly", mat_dim("volunteer_frequency", "Monthly")),
        ("Every few months", mat_dim("volunteer_frequency", "Every few months")),
        ("Infrequently or never", mat_dim("volunteer_frequency", "Infrequently or never")),
    ]

    # ---------------- Spiritual change profile (pages 14-16) ----------------
    chg_breakdown = change["distribution"]["breakdown"]
    change_donut_values = [round(_pct(chg_breakdown, lbl), 1) for lbl in CHANGE_LABEL_ORDER_5BAND]
    growing_combined = _pct(chg_breakdown, "Growing significantly") + _pct(chg_breakdown, "Growing a little")
    change_donut_combined_stat = f"{growing_combined:.1f}%"
    change_callout_combined_stat = (
        f"{growing_combined:.1f}% of your church reports growing faith and trust in God."
    )

    chg_xtab = change["crosstab_by_dimension_4band"]

    def chg_dim(dim, value_key):
        return _change_row(chg_xtab.get(dim, {}), value_key)

    maturity_4band_order = ["Exploring", "Believing in God", "Trusting God", "God Centered"]
    maturity_4band_display = {
        "Exploring": "Exploring Jesus",
        "Believing in God": "Beginning in Jesus",
        "Trusting God": "Trusting in Jesus",
        "God Centered": "Jesus Centered",
    }

    change_crosstab_diversity_table = [
        ("GENDER", None),
        ("Women", chg_dim("gender", "Female")),
        ("Men", chg_dim("gender", "Male")),
        ("AGE", None),
        ("16\u201329", chg_dim("age_3band", "16-29")),
        ("30\u201349", chg_dim("age_3band", "30-49")),
        ("50 and older", chg_dim("age_3band", "50+")),
        ("TIME INVOLVED IN THIS CHURCH", None),
        ("Less than 1 year", chg_dim("tenure", "Less than 1 year")),
        ("1\u20132 years", chg_dim("tenure", "1-2 years")),
        ("3\u20135 years", chg_dim("tenure", "3-5 years")),
        ("6 or more years", [
            round(sum(_pct(chg_xtab.get("tenure", {}).get(v, {}).get("breakdown", {}), lbl)
                      for v in ("6-10 years", "11 or more years")) / 2)
            if any(v in chg_xtab.get("tenure", {}) for v in ("6-10 years", "11 or more years"))
            else 0
            for lbl in CHANGE_LABEL_ORDER_4BAND
        ]),
        ("LEVEL OF SPIRITUAL MATURITY", None),
        *[(maturity_4band_display[m], chg_dim("maturity_4band", m)) for m in maturity_4band_order],
        ("ATTENDANCE", None),
        ("Attend every week", chg_dim("attends_every_week", "Every week")),
    ]

    change_crosstab_2 = [
        ("LEVEL OF SPIRITUAL MATURITY", None),
        *[(maturity_4band_display[m], chg_dim("maturity_4band", m)) for m in maturity_4band_order],
        ("ATTEND CHURCH GATHERINGS EVERY WEEK", None),
        ("Yes", chg_dim("attends_every_week", "Every week")),
    ]

    # ---------------- Pathway results (pages 19-34) ----------------
    pathway_results = {}
    for goal_num, pathway_numbers in GOAL_PATHWAY_NUMBERS.items():
        goal_list = []
        for pnum in pathway_numbers:
            meta = PATHWAY_META[pnum]
            item_codes = PATHWAY_ITEM_CODES[pnum]
            item_rows = []
            for code in item_codes:
                by_mat = aggregate["item_pct_always_mostly_by_maturity"].get(code, {})
                values = []
                for label in MATURITY_LABEL_ORDER_4COL:
                    stat = by_mat.get(label)
                    values.append(round(stat["pct"]) if stat else None)
                item_rows.append((ITEM_TEXT[code], values))
            goal_list.append((str(pnum), meta["name"], meta["statement"], item_rows))
        pathway_results[goal_num] = goal_list

    # ---------------- Goal summaries (pages 19-34 side charts) ----------------
    goal_summaries = {}
    all16_values = [0] * 16
    maturity_line_believing = [0] * 16
    maturity_line_trusting = [0] * 16
    maturity_line_centered = [0] * 16

    for goal_num, pathway_numbers in GOAL_PATHWAY_NUMBERS.items():
        labels = []
        values = []
        for pnum in pathway_numbers:
            agg_pathway = aggregate["pathways"][pnum]
            churchwide = agg_pathway["pct_always_mostly_churchwide"]
            pct = round(churchwide["pct"]) if churchwide else 0
            labels.append(f"{pnum}. {PATHWAY_META[pnum]['name']}")
            values.append(pct)
            all16_values[pnum - 1] = pct

            by_mat = agg_pathway["pct_always_mostly_by_maturity"]
            believing = by_mat.get("Believing in God")
            trusting = by_mat.get("Trusting God")
            centered = by_mat.get("God Centered")
            maturity_line_believing[pnum - 1] = round(believing["pct"]) if believing else 0
            maturity_line_trusting[pnum - 1] = round(trusting["pct"]) if trusting else 0
            maturity_line_centered[pnum - 1] = round(centered["pct"]) if centered else 0

        goal_summaries[goal_num] = {"labels": labels, "values": values}

    return ReportData(
        church_name=church_name,
        report_date=report_date,
        survey_period=survey_period,
        sample_size=sample_size,
        sample_size_engagement=sample_size,
        gender_pct_female=gender_pct_female,
        age_rows=age_rows,
        relationship_rows=relationship_rows,
        children_rows=children_rows,
        race_rows=race_rows,
        tenure_rows=tenure_rows,
        attendance_rows=attendance_rows,
        small_group_rows=small_group_rows,
        volunteer_rows=volunteer_rows,
        maturity_donut_values=maturity_donut_values,
        maturity_combined_stat=maturity_combined_stat,
        maturity_crosstab_1=maturity_crosstab_1,
        maturity_crosstab_2=maturity_crosstab_2,
        change_donut_values=change_donut_values,
        change_donut_combined_stat=change_donut_combined_stat,
        change_callout_combined_stat=change_callout_combined_stat,
        change_crosstab_diversity_table=change_crosstab_diversity_table,
        change_crosstab_2=change_crosstab_2,
        pathway_results=pathway_results,
        goal_summaries=goal_summaries,
        all16_values=all16_values,
        maturity_line_believing=maturity_line_believing,
        maturity_line_trusting=maturity_line_trusting,
        maturity_line_centered=maturity_line_centered,
    )
