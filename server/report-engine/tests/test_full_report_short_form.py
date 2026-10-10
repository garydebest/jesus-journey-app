"""Every church gets the full report: short-form answers sit in each person's final-stage
column, unasked statements stay blank, and groups under 10 are withheld."""
import json, sys, unittest
from pathlib import Path
ENGINE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ENGINE))
import generate_report as G
from church_report import aggregate_church, score_respondent, PATHWAYS
from report_builder import _item_pct, WITHHELD

RETAINED = set(json.load(open(ENGINE.parents[1] / "shared" / "shortFormConfig.json"))["retained"])
CODES = sorted({c for p in PATHWAYS.values() for c in p["items"]})

def row(pre, post, value=4):
    r = {c.lower(): (value if pre >= 3 or c in RETAINED else None) for c in CODES}
    r.update(journey_pre=pre, journey_post=post)
    return G.normalize_row(r)

class FullReportShortForm(unittest.TestCase):
    def test_short_form_person_who_moves_up_is_scored_without_error(self):
        s = score_respondent(row(2, 3), "church")
        self.assertIsNone(s.pathway_scores[3])
        self.assertTrue(all(code in RETAINED for code in s.item_values))

    def test_blank_when_not_asked_and_dash_below_ten(self):
        rows = [row(2, 2) for _ in range(12)] + [row(4, 4) for _ in range(20)] + [row(2, 3) for _ in range(3)] + [row(3, 3) for _ in range(5)]
        agg = aggregate_church([score_respondent(r, "church") for r in rows])
        unasked = next(c for c in CODES if c not in RETAINED)
        asked = next(c for c in CODES if c in RETAINED)
        by = agg["item_pct_always_mostly_by_maturity"]
        self.assertIsNone(_item_pct(by.get(unasked, {}), "Exploring"))      # not asked: blank
        self.assertEqual(_item_pct(by[asked], "Exploring"), 100)            # 12 answered
        self.assertEqual(_item_pct(by[asked], "Believing in God"), WITHHELD)  # 8 answered: dash
        self.assertEqual(by[unasked]["Believing in God"]["n"], 5)          # unasked never counted as disagreement

if __name__ == "__main__":
    unittest.main()
