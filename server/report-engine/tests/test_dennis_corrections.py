"""No network, database, or production data. Synthetic regression fixtures."""
import unittest
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from church_profile_report import demographics_profile, maturity_profile, change_profile, reflection_profile
from church_report import aggregate_church, score_respondent, _pct_always_mostly
from report_builder import build_from_aggregates, _maturity_row, _pooled_row, _item_pct
from report_template_content import MATURITY_LABEL_ORDER_4COL


class DennisCorrections(unittest.TestCase):
    def test_distant_and_exploring_pooled_by_counts(self):
        rows = [{"gender": "Female", "journey_post": stage} for stage in [1, 1, 2, 3, 3, 4, 4, 4, 5, 5]]
        profile = maturity_profile(rows)
        self.assertEqual(_maturity_row(profile["crosstab_by_dimension"]["gender"], "Female"), [30, 20, 30, 20])
        self.assertEqual(profile["distribution"]["breakdown"]["Distant"]["n"], 2)

    def test_unequal_and_absent_categories(self):
        entries = [{"n": 2, "breakdown": {"Exploring": {"n": 2}}},
                   {"n": 8, "breakdown": {"God Centered": {"n": 8}}}, {}]
        self.assertEqual(_pooled_row(entries, MATURITY_LABEL_ORDER_4COL, True), [20, 0, 0, 80])

    def test_item_denominators(self):
        stats = {"Distant": {"n": 2, "agreed": 1, "pct": 50},
                 "Exploring": {"n": 8, "agreed": 8, "pct": 100}}
        self.assertEqual(_item_pct(stats, "Exploring"), 90)
        self.assertIsNone(_item_pct(stats, "Believing in God"))
        self.assertEqual(_item_pct({"Exploring": {"n": 5, "agreed": 0, "pct": 0}}, "Exploring"), 0)
        self.assertGreater(_item_pct({"Exploring": {"n": 2000, "agreed": 1, "pct": .05}}, "Exploring"), 0)

    def test_children_multiselect(self):
        rows = [{"children_in_household": ["0-2 year old(s)", "3-5 year old(s)"]},
                {"children_in_household": ["None"]}]
        profile = demographics_profile(rows)["children_in_household"]
        self.assertEqual(profile["n"], 2)
        self.assertEqual(sum(v["pct"] for v in profile["breakdown"].values()), 150)
        rows.append({"children_in_household": []})
        profile = demographics_profile(rows)["children_in_household"]
        self.assertEqual(profile["n"], 3)
        self.assertEqual(profile["breakdown"]["None"]["pct"], 33.3)

    def test_reflection(self):
        rows = [{"journey_pre": 3, "journey_post": stage} for stage in [4] * 5 + [3] * 10 + [2] * 5]
        self.assertEqual([v["pct"] for v in reflection_profile(rows)["values"]], [25, 50, 25])
        rows[0]["journey_post"] = 3
        self.assertTrue(reflection_profile(rows)["suppressed"])
        self.assertTrue(reflection_profile([{"journey_pre": None, "journey_post": 5}])["suppressed"])

    def test_rare_positive_not_zero(self):
        self.assertGreater(_pct_always_mostly([4] + [1] * 9999)["pct"], 0)

if __name__ == "__main__":
    unittest.main()
