"""Core Leaders Review: a preliminary Survey Review for a church's core leaders (Gary, Nov 25 2026).

Built on the same engine, thresholds and phrase library as the church Survey Review, with these
differences, chosen by Gary:
  - only responses that came in through the wave's leader code are used;
  - it is offered only when at least MIN_LEADERS leaders have responded;
  - no demographics and no group-difference findings ("What did we discover" keeps stage and growth lines only);
  - no "see page" references (there is no full church report yet);
  - close calls (within BORDERLINE points of the 75% / 60% lines) are marked as borderline;
  - a leaders-specific closing section; no comments.

It also provides the leaders-vs-congregation comparison that the final Facilitator's Report shows
when the Core Leaders Review was switched on for the survey.
"""
from stats import mean, mean_diff, prop_diff  # noqa: E402
import engine as B  # noqa: E402

MIN_LEADERS = 30   # Gary, Nov 25: the review is offered only with at least 30 leader responses
BORDERLINE = 5     # points either side of the 75% / 60% lines
MIN_OTHERS = B.MIN_N   # the rest of the church must clear the usual 10-person floor for the comparison
COMPARE_DIFF = 10  # points: the materiality used elsewhere for pathway differences

# "What did we discover about ourselves?" lines that describe stages and growth only.
ABOUT_KEYS = {"stage_all", "stage_early", "stage_centered_few", "stage_centered_many", "growth_most", "growth_same", "fading"}

BORDERLINE_TAG = " (borderline)"

INTRO = ("This is a first look at our core leaders only, taken before the whole church is invited. "
         "It does not describe the whole church.")
BORDERLINE_NOTE = ("Lines marked borderline are within 5 points of the line for a strength or an opportunity. "
                   "With a group this size, one or two answers could move them, so hold them lightly.")
EMPTY_S = B.EMPTY_S
EMPTY_O = B.EMPTY_O

# Closing section for the leaders' review (draft for Gary to review; replaces WHERE_NEXT).
WHERE_NEXT = [
    "Treat this as a first look. It tells us about our leaders, not yet about our whole church.",
    ("Before we invite the whole church, talk together about:", [
        "What we are celebrating, and what surprised us;",
        "Where our own journey as leaders may shape what we ask of others;",
        "How we will invite and encourage everyone to take part."]),
    "Take the survey to the whole church and keep listening widely. When it closes, the full church report will show the whole picture, and our debrief will look at how our leaders' journey compares with the church as a whole.",
]


def leader_rows(rows):
    return [r for r in rows if r.get("leader")]


def select(rows):
    """Selection for the leaders' review. rows must already be the leaders only."""
    sel = B.select(rows)
    sel["about"] = [a for a in sel["about"] if a["key"] in ABOUT_KEYS]
    return sel


# ------------------------------------------------------------------ borderline
def _near_s(p): return p < B.FIX_S + BORDERLINE
def _near_o(p): return p >= B.FIX_O - BORDERLINE


def is_borderline(src, side, sel):
    """True when the statement(s) behind a qualifying line sit within BORDERLINE points of its threshold."""
    pct = sel["pct"]
    kind, rest = src.split(":", 1)
    if kind == "item":
        return _near_s(pct[rest]) if side == "s" else _near_o(pct[rest])
    if kind == "pathway":
        codes = rest.split(":")[1].split(",")
        return any(_near_s(pct[c]) for c in codes) if side == "s" else any(_near_o(pct[c]) for c in codes)
    if kind == "gap":
        parts = rest.split(":")
        if side == "o" and len(parts) > 1:
            return any(_near_o(pct[c]) for c in parts[1].split(","))
        return False   # a closing-gap strength rests on a comparison, not on the 75% line alone
    if kind == "pair":
        a, b = rest.split(",")
        pa, pb = pct[a], pct[b]
        if side == "s":
            return _near_s(pa) or _near_s(pb)
        # opportunity: the gap or shortfall that produced the line
        if pa >= B.FIX_S and pb < B.FIX_O: return _near_s(pa) or _near_o(pb)
        if pb >= B.FIX_S and pa < B.FIX_O: return _near_s(pb) or _near_o(pa)
        return _near_o(pa) or _near_o(pb)
    return False   # stage lines rest on the stage comparison, not the thresholds


def mark(text, src, side, sel):
    if not is_borderline(src, side, sel):
        return text
    t = text.rstrip(".")
    if t.endswith("?"):
        return text  # never break a closing question
    return t + BORDERLINE_TAG + "."


def goal_cells(sel, g):
    G = sel["goals"][g]
    s = [mark(t, src, "s", sel) for _, t, src in G["strengths"]]
    o = [mark(t, src, "o", sel) for _, t, src in G["opportunities"]]
    if sel["greatest_strength"] == g: s = [B.L.GOAL["greatest_strength"]] + s
    if sel["greatest_opportunity"] == g: o = [B.L.GOAL["greatest_opportunity"]] + o
    return s, o


def summary_lists(sel):
    allS, allO, qs = B.summary_lists(sel)
    return ([mark(t, src, "s", sel) for _, t, src in allS], [mark(t, src, "o", sel) for _, t, src in allO], qs)


# ------------------------------------------------------------------ leaders vs congregation (final Facilitator's Report)
def _am_person(r, codes):
    return mean([r[c] >= 4 for c in codes])


def compare(rows):
    """Leaders vs the rest of the church, for the final Facilitator's Report.

    Returns None unless at least MIN_LEADERS leaders and MIN_OTHERS others took part.
    Goal and pathway figures use full-survey believers (the Survey Review's base) and are shown
    only when each side has at least B.MIN_N such people. Pathway differences must be at least
    COMPARE_DIFF points and pass a whole-table chance check (16 comparisons, 5% overall).
    """
    lead = [r for r in rows if r.get("leader")]; rest = [r for r in rows if not r.get("leader")]
    if len(lead) < MIN_LEADERS or len(rest) < MIN_OTHERS:
        return None
    out = dict(n_leaders=len(lead), n_others=len(rest))
    out["stages"] = {name: (sum(r["stage"] == s for r in lead), sum(r["stage"] == s for r in rest))
                     for s, name in enumerate(["Distant", "Exploring", "Believing", "Trusting", "Jesus Centered"], 1)}
    grow = lambda g: sum(r["change"] in (1, 2) for r in g)
    d = prop_diff(grow(lead), len(lead), grow(rest), len(rest), conf=.95)
    gl, go = round(100 * grow(lead) / len(lead)), round(100 * grow(rest) / len(rest))
    out["growth"] = dict(leaders=gl, others=go, diff=gl - go, clear=d["lo"] > 0 or d["hi"] < 0)
    fl = [r for r in lead if r["stage"] >= 3 and r.get("full_form", True)]
    fo = [r for r in rest if r["stage"] >= 3 and r.get("full_form", True)]
    out["n_full"] = (len(fl), len(fo))
    out["goals"] = None; out["pathways"] = []
    if len(fl) >= B.MIN_N and len(fo) >= B.MIN_N:
        goals = {}
        for g in B.L.GOALS:
            codes = [c for p in B.PATHWAYS if p["goal"] == g for c in p["items"]]
            a = round(100 * mean([_am_person(r, codes) for r in fl])); b = round(100 * mean([_am_person(r, codes) for r in fo]))
            goals[g] = dict(leaders=a, others=b, diff=a - b)
        out["goals"] = goals
        conf = 1 - .05 / len(B.PATHWAYS)
        for p in B.PATHWAYS:
            x = [100 * _am_person(r, p["items"]) for r in fl]; y = [100 * _am_person(r, p["items"]) for r in fo]
            m = mean_diff(x, y, conf=conf)
            if abs(m["diff"]) >= COMPARE_DIFF and (m["lo"] > 0 or m["hi"] < 0):
                a, b = round(mean(x)), round(mean(y))
                out["pathways"].append(dict(num=p["num"], name=p["name"], goal=p["goal"], leaders=a, others=b, diff=a - b))
        out["pathways"].sort(key=lambda z: -abs(z["diff"]))
    return out
