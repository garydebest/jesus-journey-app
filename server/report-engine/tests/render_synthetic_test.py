import sys, json
sys.path.insert(0, '/home/user/workspace/projects/jesus-journey-survey-VprMiPS.SoGN1RoUKm7NXQ/files/tools/church-aggregation')

from church_report import aggregate_church, score_respondent
from church_profile_report import demographics_profile, maturity_profile, change_profile
from synth_data import generate
from report_builder import build_from_aggregates

import build_full_report_refactor as tmpl

rows = generate(250)
scored_rows = []
for r in rows:
    r2 = dict(r)
    r2["journey"] = r["journey_post"]
    r2["church"] = "Grace Fellowship"
    scored_rows.append(r2)

scored = [score_respondent(r, "church") for r in scored_rows]
agg = aggregate_church(scored)
demo = demographics_profile(rows)
mat = maturity_profile(rows)
chg = change_profile(rows)

data = build_from_aggregates(
    church_name="Grace Fellowship Church",
    report_date="8/29/2026",
    survey_period="8/1/2026 \u2013 8/29/2026",
    aggregate=agg,
    demographics=demo,
    maturity=mat,
    change=chg,
)

tmpl.set_report_data(data)
tmpl.main.__wrapped__ = None

# Patch the hardcoded out_path by monkeypatching before calling main()
import types
src = open("build_full_report_refactor.py").read()
src = src.replace(
    '"/home/user/workspace/report_mockup/full_report.pdf"',
    '"/home/user/workspace/report_mockup/synthetic_test_report.pdf"'
)
ns = {"__name__": "not_main"}
exec(compile(src, "build_full_report_refactor.py", "exec"), ns)
ns["set_report_data"](data)
ns["main"]()
print("Rendered synthetic_test_report.pdf")
