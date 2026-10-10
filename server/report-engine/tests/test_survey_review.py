"""Survey Review / Facilitator's Report: runs end to end on live-shaped rows, including small and messy churches."""
import json
import random
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ENGINE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ENGINE / "survey_review"))
import engine as E  # noqa: E402
from pypdf import PdfReader  # noqa: E402

SHORT = None


def short_codes():
    """Codes asked on the 38-item short form (shared/shortFormConfig.json)."""
    return set(json.loads((ENGINE.parents[1] / "shared" / "shortFormConfig.json").read_text())["retained"])


def row(rng, stage, short=False, undisclosed=False):
    codes = short_codes() if short else E.CODES
    r = {c.lower(): max(1, min(5, round(1.5 + stage * .6 + rng.gauss(0, .8)))) for c in codes}
    pnts = "Prefer not to say"
    r.update(journey_pre=2 if short else max(3, stage), journey_post=stage, spiritual_change=rng.choice([1, 2, 2, 3, 3, 4, None]),
             gender=pnts if undisclosed else rng.choice(["Male", "Female"]),
             age_group=pnts if undisclosed else rng.choice(["16-19", "20-29", "30-39", "40-49", "50-59", "60 and older"]),
             relationship_status=rng.choice(["Married", "Independent single", "Divorced"]),
             attendance_frequency=rng.choice(["Every week", "A few times/month", "Monthly"]),
             tenure=rng.choice(["Less than 1 year", "1-2 years", "3-5 years", "6-10 years", "11 or more years"]),
             small_group_frequency=rng.choice(["Every week", "Infrequently or never"]),
             volunteer_frequency=rng.choice(["Every week", "Monthly"]),
             children_in_household=[] if undisclosed else rng.choice([["None"], ["3-5 year old(s)"]]),
             race_ethnicity=[] if undisclosed else rng.choice([["White / European background"], ["South Asian"]]))
    return r


def church(n, seed, short_share=.15, undisclosed_share=.1):
    rng = random.Random(seed)
    out = []
    for _ in range(n):
        stage = rng.choice([1, 2, 3, 3, 4, 4, 5])
        out.append(row(rng, stage, short=stage <= 2 or rng.random() < short_share, undisclosed=rng.random() < undisclosed_share))
    return out


def run(rows, name="Test Church"):
    with tempfile.TemporaryDirectory() as d:
        c, f = Path(d) / "c.pdf", Path(d) / "f.pdf"
        p = subprocess.run([sys.executable, str(ENGINE / "generate_survey_review.py")], input=json.dumps(
            {"church_name": name, "rows": rows, "church_out": str(c), "facilitator_out": str(f)}), capture_output=True, text=True, cwd=ENGINE)
        res = json.loads(p.stdout.strip().splitlines()[-1])
        texts = ["\n".join(pg.extract_text() for pg in PdfReader(str(x)).pages) for x in (c, f)] if res.get("ok") else []
        return res, texts


class SurveyReviewTest(unittest.TestCase):
    def test_sizes_render(self):
        for n, seed in [(12, 1), (25, 2), (60, 3), (210, 4)]:
            res, texts = run(church(n, seed))
            self.assertTrue(res["ok"], res)
            church_text, fac_text = texts
            for t in texts:
                self.assertNotIn("God Centered", t)
                self.assertNotIn("<br>", t)
            self.assertIn("Survey Review", church_text)
            self.assertIn("Where do we go from here?", church_text)
            self.assertIn("Facilitator's Report", fac_text)
            self.assertEqual(res["summary"]["n"], n)

    def test_short_form_rows_excluded_from_goal_tables(self):
        rows = church(80, 9, short_share=.3)
        res, _ = run(rows)
        self.assertTrue(res["ok"])
        full = sum(1 for r in rows if r["journey_post"] >= 3 and all(c.lower() in r for c in E.CODES))
        self.assertEqual(res["summary"]["n_full"], full)

    def test_undisclosed_answers_never_form_a_group(self):
        rows = E.from_report_rows(church(40, 5, undisclosed_share=1.0))
        self.assertTrue(all(r["ethnicity"] == "Unknown" and r["children"] == "Unknown" for r in rows))

    def test_tiny_or_short_form_church_withholds_goal_tables(self):
        res, texts = run(church(9, 7, short_share=0))
        self.assertTrue(res["ok"])
        self.assertTrue(res["summary"]["goal_tables_withheld"])
        self.assertIn("to protect confidentiality", " ".join(texts[0].split()))

    def test_no_valid_stage_fails_cleanly(self):
        res, _ = run([{"journey_post": None}])
        self.assertFalse(res["ok"])


if __name__ == "__main__":
    unittest.main()
