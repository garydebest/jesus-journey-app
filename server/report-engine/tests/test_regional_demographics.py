import io
import json
import sys
import unittest
import tempfile
import subprocess
from pathlib import Path
from pypdf import PdfReader
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from demographic_privacy import safe_counts, parse_multi, PDF_POLICY
from church_profile_report import demographics_profile, maturity_profile, change_profile
from church_report import score_respondent, aggregate_church
from report_builder import build_from_aggregates
from project_church_pdf import project_church_pdf
from report_projection import project_report
from cohort_report import build_cohort_report
import build_full_report as template

ROOT = Path(__file__).resolve().parents[3]


def fixture(n, skipped=False):
    rows = []
    for i in range(n):
        row = {f"{prefix}{j}": 4 for prefix in "bkalpct" for j in range(1, 10)}
        row.update(journey=4, journey_post=4, journey_pre=4, spiritual_change=1)
        if not skipped:
            row.update(gender="Female", age_group="30-39", relationship_status="Married",
                       attendance_frequency="Every week", tenure="3-5 years", small_group_frequency="Monthly",
                       volunteer_frequency="Monthly", children_in_household=["0-2 year old(s)", "3-5 year old(s)"],
                       race_ethnicity=["White / European background", "Black / African background"])
        rows.append(row)
    return rows


def data(rows):
    return build_from_aggregates("Synthetic Privacy QA", "9/29/2026", "Synthetic only",
                                aggregate_church([score_respondent(r, "church") for r in rows]),
                                demographics_profile(rows), maturity_profile(rows), change_profile(rows))


class RegionalDemographics(unittest.TestCase):
    def test_full_comments_have_no_demographic_tags(self):
        rows = fixture(9)
        for row in rows:
            row["gender"] = "PRIVATE_GENDER_SENTINEL"
            row["comment_text"] = "More opportunities to pray together would help."
        with tempfile.TemporaryDirectory() as directory:
            path = str(Path(directory) / "church.pdf")
            comments = str(Path(directory) / "comments.pdf")
            payload = {"church_name": "Synthetic", "report_date": "Review", "survey_period": "Synthetic only",
                       "out_path": path, "comments_out_path": comments, "rows": rows}
            result = subprocess.run([sys.executable, "generate_report.py"], cwd=ROOT / "server/report-engine",
                                    input=json.dumps(payload), capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            text = "\n".join(p.extract_text() for p in PdfReader(comments).pages)
            self.assertNotIn("PRIVATE_GENDER_SENTINEL", text)
            self.assertIn("More opportunities", text)

    def test_every_demographic_at_boundary(self):
        for n in (0, 1, 5, 6, 9, 10, 20):
            profile = demographics_profile(fixture(n))
            for key, value in profile.items():
                if isinstance(value, dict):
                    self.assertEqual(bool(value["breakdown"]), n >= 10, (n, key))
                    self.assertTrue(all(v["n"] >= 10 for v in value["breakdown"].values()))
            for groups in maturity_profile(fixture(n))["crosstab_by_dimension"].values():
                self.assertTrue(all(v["n"] >= 10 for v in groups.values()))
            for key, groups in change_profile(fixture(n))["crosstab_by_dimension_4band"].items():
                if key != "maturity_4band":
                    self.assertTrue(all(v["n"] >= 10 for v in groups.values()))

    def test_nondisclosure_multiselect_and_denominators(self):
        rows = fixture(10)
        profile = demographics_profile(rows)
        self.assertEqual(sum(v["pct"] for v in profile["children_in_household"]["breakdown"].values()), 200)
        self.assertEqual(sum(v["pct"] for v in profile["race_ethnicity"]["breakdown"].values()), 200)
        for r in rows:
            r.update(gender="Prefer not to say", race_ethnicity=["Prefer not to say", "White"], children_in_household=None)
        profile = demographics_profile(rows)
        for key in ("gender", "race_ethnicity", "children_in_household"):
            self.assertEqual(profile[key]["breakdown"], {})
        self.assertEqual(parse_multi('["First Nations, Métis, or Inuit"]'), ["First Nations, Métis, or Inuit"])
        for row in rows:
            row["children_in_household"] = "0-2 year old(s),3-5 year old(s)"
        child = demographics_profile(rows)["children_in_household"]["breakdown"]
        self.assertEqual(set(child), {"0-2 year old(s)", "3-5 year old(s)"})

    def test_complements(self):
        self.assertEqual(safe_counts({"Female": 10, "Male": 9}, 19), {})
        self.assertEqual(safe_counts({"Female": 10}, 11), {})
        self.assertEqual(safe_counts({"A": 10, "B": 9}, 30, True), {"A": 10})

    def test_render_sparse_and_boundary_without_leaks(self):
        out = ROOT / "qa-output"
        out.mkdir(exist_ok=True)
        for n, skipped in ((9, False), (10, False), (20, True)):
            report = data(fixture(n, skipped))
            template.set_report_data(report)
            target = out / f"regional-full-{n}-{'skip' if skipped else 'answered'}.pdf"
            template.OUT_PATH = str(target)
            template.main()
            reader = PdfReader(target)
            self.assertEqual(len(reader.pages), 38)
            self.assertEqual(reader.metadata.get("/Subject"), PDF_POLICY)
            demo = "\n".join(reader.pages[i].extract_text() for i in (6, 7, 8, 10, 11))
            if n < 10 or skipped:
                for sentinel in ("30–39", "Married", "Black / African", "0–2 year"):
                    self.assertNotIn(sentinel, demo)
            else:
                self.assertIn("Black / African", demo)
                self.assertIn("100%", demo)
            self.assertEqual(project_church_pdf(target.read_bytes()), target.read_bytes())

    def test_archived_pdf_preserved_and_safe_copy(self):
        raw = (ROOT / "script/fixtures/legacy-church-report.pdf").read_bytes()
        old = PdfReader(io.BytesIO(raw))
        projected = project_church_pdf(raw)
        new = PdfReader(io.BytesIO(projected))
        changed = {3, 6, 7, 8, 10, 11, 14, 15}
        for i in range(38):
            if i not in changed:
                self.assertEqual(old.pages[i].get_contents().get_data(), new.pages[i].get_contents().get_data())
            elif i != 3:
                self.assertIn("Archived demographic section withheld", new.pages[i].extract_text())
        self.assertEqual(project_church_pdf(projected), projected)
        self.assertEqual((ROOT / "script/fixtures/legacy-church-report.pdf").read_bytes(), raw)

    def test_python_saved_narratives(self):
        report = {"respondentCount": 20, "demographics": [{"id": "gender", "breakdown": [
            {"group": "Female", "n": 11, "pctOfChurch": 55}, {"group": "Male", "n": 9, "pctOfChurch": 45}]}],
            "executiveSummary": {"strengths": [{"section": "Demographics", "headline": "SMALL_SENTINEL", "detail": "9 people"}]},
            "pairedPresentation": {"version": "old", "sections": [{"title": "SMALL_SENTINEL"}]}}
        original = json.dumps(report)
        projected = project_report(report)
        self.assertNotIn("SMALL_SENTINEL", json.dumps(projected))
        self.assertEqual(projected["demographics"][0]["breakdown"], [])
        self.assertEqual(json.dumps(report), original)

    def test_mixed_profile_boundary(self):
        report = {"note": "Synthetic only", "respondentCount": 30, "cohorts": [],
                  "profiles": {"Race / ethnicity": {"suppressed": False, "values": [
                      {"label": "SMALL_SENTINEL", "count": 9, "pct": 30},
                      {"label": "REPORTABLE_SENTINEL", "count": 10, "pct": 33.3}]}}}
        path = ROOT / "qa-output/regional-mixed.pdf"
        path.parent.mkdir(exist_ok=True)
        build_cohort_report(str(path), "Synthetic", "Review", report)
        text = "\n".join(p.extract_text() for p in PdfReader(path).pages)
        self.assertNotIn("SMALL_SENTINEL", text)
        self.assertIn("REPORTABLE_SENTINEL", text)
        self.assertEqual(project_church_pdf(path.read_bytes()), path.read_bytes())


if __name__ == "__main__":
    unittest.main()
