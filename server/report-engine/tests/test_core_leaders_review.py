"""Core Leaders Review: leader-code responses reviewed on their own before the whole church is invited."""
import json
import random
import re
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ENGINE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ENGINE / "survey_review"))
sys.path.insert(0, str(Path(__file__).resolve().parent))
import engine as E  # noqa: E402
import leaders as LD  # noqa: E402
from pypdf import PdfReader  # noqa: E402
from test_survey_review import row, church  # noqa: E402


def leaders(n, seed=7):
    rng = random.Random(seed)
    out = []
    for _ in range(n):
        r = row(rng, rng.choice([3, 4, 4, 5, 5, 5]))
        r["core_leader"] = True
        out.append(r)
    return out


def render(script, payload):
    with tempfile.TemporaryDirectory() as d:
        c, f = Path(d) / "c.pdf", Path(d) / "f.pdf"
        p = subprocess.run([sys.executable, str(ENGINE / script)], input=json.dumps(
            {"church_name": "Test Church", "church_out": str(c), "facilitator_out": str(f), **payload}),
            capture_output=True, text=True, cwd=ENGINE)
        res = json.loads(p.stdout.strip().splitlines()[-1])
        texts = ["\n".join(pg.extract_text() for pg in PdfReader(str(x)).pages) for x in (c, f)] if res.get("ok") else []
        return res, texts


class CoreLeadersReviewTest(unittest.TestCase):
    def test_needs_thirty_leaders(self):
        res, _ = render("generate_leaders_review.py", {"rows": leaders(29) + church(80, 3)})
        self.assertFalse(res["ok"])
        self.assertIn("at least 30", res["error"])

    def test_uses_only_leader_rows(self):
        rows = leaders(35) + church(150, 3)
        self.assertEqual(len(LD.leader_rows(E.from_report_rows(rows))), 35)

    def test_renders_without_demographics_page_refs_or_comments(self):
        rows = leaders(42)
        for r in rows:
            r["comment_text"] = "PRIVATE COMMENT TEXT"
        res, (church_text, fac_text) = render("generate_leaders_review.py", {"rows": rows + church(160, 3)})
        self.assertTrue(res["ok"], res)
        for text in (church_text, fac_text):
            self.assertIn("Core Leaders", text)
            self.assertNotRegex(text, re.compile(r"\bsee page|\(p\.\s*\d", re.I))
            self.assertNotIn("PRIVATE COMMENT TEXT", text)
            for word in ("women", "men ", "aged ", "married", "single", "background"):
                self.assertNotIn(word, text.lower().replace("\n", " ").replace("  ", " ") if word != "men " else text)
        self.assertIn("42", fac_text)

    def test_about_lines_are_only_stage_and_growth(self):
        sel = LD.select(LD.leader_rows(E.from_report_rows(leaders(40))))
        for line in sel["about"]:
            self.assertIn(line.get("key"), LD.ABOUT_KEYS)

    def test_borderline_marking(self):
        sel = LD.select(LD.leader_rows(E.from_report_rows(leaders(40))))
        found = False
        for g in sel["goals"]:
            G = sel["goals"][g]
            for side, key in (("s", "strengths"), ("o", "opportunities")):
                for _, text, src in G[key]:
                    marked = LD.mark(text, src, side, sel)
                    if LD.is_borderline(src, side, sel) and not text.rstrip(".").endswith("?"):
                        found = True
                        self.assertIn(LD.BORDERLINE_TAG, marked)
                    else:
                        self.assertNotIn(LD.BORDERLINE_TAG, marked)
        self.assertTrue(found, "the synthetic leaders should produce at least one borderline line")

    def test_borderline_threshold(self):
        sel = {"pct": {"k1": 79.9, "k2": 80.0, "c6": 55.0, "c7": 54.9}}
        self.assertTrue(LD.is_borderline("item:k1", "s", sel))
        self.assertFalse(LD.is_borderline("item:k2", "s", sel))
        self.assertTrue(LD.is_borderline("item:c6", "o", sel))
        self.assertFalse(LD.is_borderline("item:c7", "o", sel))

    def test_comparison_only_when_requested(self):
        rows = leaders(42) + church(160, 3)
        res, (_, fac_off) = render("generate_survey_review.py", {"rows": rows, "full_report_layout": True})
        self.assertTrue(res["ok"], res)
        self.assertNotIn("Our leaders and the congregation", fac_off)
        res, (church_on, fac_on) = render("generate_survey_review.py", {"rows": rows, "full_report_layout": True, "leaders_comparison": True})
        self.assertTrue(res["ok"], res)
        self.assertIn("Our leaders and the congregation", fac_on)
        self.assertNotIn("Our leaders and the congregation", church_on)

    def test_final_church_review_unchanged_by_leader_flag(self):
        rows = leaders(42) + church(160, 3)
        plain = [{k: v for k, v in r.items() if k != "core_leader"} for r in rows]
        _, (a, _) = render("generate_survey_review.py", {"rows": rows, "full_report_layout": True, "leaders_comparison": True})
        _, (b, _) = render("generate_survey_review.py", {"rows": plain, "full_report_layout": True})
        self.assertEqual(a, b)


if __name__ == "__main__":
    unittest.main()
