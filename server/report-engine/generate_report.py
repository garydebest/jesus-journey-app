"""
generate_report.py -- bridge between the Node/Express app and the Python
report engine (church_report.py + church_profile_report.py + report_builder.py
+ build_full_report.py).

Reads a single JSON object from stdin shaped like:
{
  "church_name": "Riverside Community Church",
  "report_date": "8/29/2026",
  "survey_period": "8/1/2026 - 8/29/2026",
  "out_path": "/absolute/path/to/output.pdf",
  "rows": [ { "b1": 4, "k1": 3, ..., "journey_pre": 3, "journey_post": 4,
              "spiritual_change": 2, "gender": "Female", "age_group": "30-39",
              "relationship_status": "Married", "attendance_frequency": "Every week",
              "tenure": "3-5 years", "small_group_frequency": "Every week",
              "volunteer_frequency": "Monthly", "children_in_household": "None",
              "race_ethnicity": "White", "comment_text": "" }, ... ]
}

Writes the rendered PDF to out_path and prints {"ok": true, "out_path": ...}
as the last line of stdout on success. On failure prints
{"ok": false, "error": "..."} to stdout and exits with code 1.
"""
import sys
import json
import traceback

sys.path.insert(0, __file__.rsplit("/", 1)[0])


def normalize_row(row: dict) -> dict:
    """church_report.score_respondent() reads item codes case-insensitively
    (it upper()s all keys) and expects a 'journey' key for the maturity/
    partial-survey gating column. Per the confirmed decision, the church
    report uses journey_post (the second self-assessment) for segmentation,
    not journey_pre."""
    r = dict(row)
    r["journey"] = r.get("journey_post")
    return r


def main():
    raw = sys.stdin.read()
    payload = json.loads(raw)

    church_name = payload["church_name"]
    report_date = payload["report_date"]
    survey_period = payload["survey_period"]
    out_path = payload["out_path"]
    rows = payload["rows"]

    from church_report import aggregate_church, score_respondent
    from church_profile_report import demographics_profile, maturity_profile, change_profile
    from report_builder import build_from_aggregates
    import build_full_report as tmpl

    norm_rows = [normalize_row(r) for r in rows]

    scored = [score_respondent(r, "church") for r in norm_rows]
    agg = aggregate_church(scored)
    demo = demographics_profile(norm_rows)
    mat = maturity_profile(norm_rows)
    chg = change_profile(norm_rows)

    data = build_from_aggregates(
        church_name=church_name,
        report_date=report_date,
        survey_period=survey_period,
        aggregate=agg,
        demographics=demo,
        maturity=mat,
        change=chg,
    )

    tmpl.set_report_data(data)
    tmpl.OUT_PATH = out_path
    tmpl.main()

    print(json.dumps({"ok": True, "out_path": out_path}))


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(json.dumps({"ok": False, "error": str(e), "trace": traceback.format_exc()}))
        sys.exit(1)
