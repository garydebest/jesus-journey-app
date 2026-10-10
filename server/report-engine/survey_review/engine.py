"""Survey Review engine: chooses what the church Survey Review and the Facilitator's Report say.

Ported from the approved prototype (docs/debriefing/church-report-prototype in the project files).
Every sentence comes from phrase_library.py. Runs on raw response rows during survey close.
"""
import json, math, sys
from pathlib import Path
from statistics import median

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from stats import mean, var, mean_diff, paired, prop_diff  # noqa: E402
import phrase_library as L  # noqa: E402

_INSTRUMENT = json.loads((HERE / "instrument.json").read_text())
PATHWAYS = _INSTRUMENT["pathways"]
ITEM_TEXT = _INSTRUMENT["item_text"]

MIN_N = 10          # Gary, Oct 9: minimum group size 10 for stage and group results (also the privacy floor)
ITEM_DIFF = 0.2     # an item must sit at least 0.2 above/below the average of its own kind to count
STAGE_DIFF = 0.3    # stage departures use the existing 0.3 materiality
CAP = 4             # bullets per cell
STAGE_NAMES = {3: "Believing", 4: "Trusting", 5: "Jesus Centered"}
BEL = lambda c: c[0] in "BK"
CODES = list(ITEM_TEXT)
PW_BY_NUM = {p["num"]: p for p in PATHWAYS}

# ------------------------------------------------------------------ live survey rows
WHITE_LABELS = {"White / European background", "White", "White/Caucasian", "White British, Irish, or other White background"}


def from_report_rows(report_rows):
    """Map rows in the report-engine shape (server/pdfReport.ts toReportRow) to the engine's shape.

    Rows without a valid end-of-survey stage are left out. Undisclosed answers never count toward a group.
    """
    out = []
    for src in report_rows:
        try:
            stage = int(src.get("journey_post"))
        except (TypeError, ValueError):
            continue
        if stage not in (1, 2, 3, 4, 5):
            continue
        try:
            change = int(src.get("spiritual_change"))
        except (TypeError, ValueError):
            change = None
        kids = [k for k in (src.get("children_in_household") or []) if isinstance(k, str) and k.strip() and k != "Prefer not to say"]
        races = [x for x in (src.get("race_ethnicity") or []) if isinstance(x, str) and x.strip()]
        r = dict(stage=stage, change=change if change in (1, 2, 3, 4, 5) else None,
                 age=src.get("age_group"), gender=src.get("gender"), relationship=src.get("relationship_status"),
                 attendance=src.get("attendance_frequency"), tenure=src.get("tenure"),
                 smallgroup=src.get("small_group_frequency"), volunteer=src.get("volunteer_frequency"),
                 children="Unknown" if not kids else ("None" if kids == ["None"] else "Yes"),
                 ethnicity="Unknown" if not races else ("White/Caucasian" if set(races) <= WHITE_LABELS else "Other"))
        answered = 0
        for c in CODES:
            v = src.get(c, src.get(c.lower()))
            if isinstance(v, (int, float)) and 1 <= v <= 5:
                r[c] = int(v); answered += 1
        r["full_form"] = answered == len(CODES)
        out.append(r)
    return out


# ------------------------------------------------------------------ helpers
def share_words(p):
    if p < .3: return f"about 1 in {max(2, round(1 / p))}" if p > 0 else "none"
    for hi, w in [(.38, "about a third"), (.45, "about 2 in 5"), (.55, "about half"), (.62, "about 3 in 5"),
                  (.7, "about two thirds"), (.78, "about 3 in 4"), (.86, "about 4 in 5"), (1.01, "about 9 in 10")]:
        if p < hi: return w

def pscore(r, pw, kind=None):
    items = [c for c in pw["items"] if kind is None or (kind == "b") == BEL(c)]
    return mean([r[c] for c in items]) if items else None

def lc(s): return s[0].lower() + s[1:]

# ------------------------------------------------------------------ selection
def select(rows):
    full = [r for r in rows if r["stage"] >= 3 and r.get("full_form", True)]
    out = dict(n=len(rows), n_full=len(full), stage_counts={s: sum(r["stage"] == s for r in rows) for s in range(1, 6)})
    # Fewer than 10 full-survey answers: no Goal-table lines (privacy floor and too little data).
    out["goal_tables_withheld"] = len(full) < MIN_N
    if out["goal_tables_withheld"]:
        full = []
    # items: each person's item score minus that person's average on items of the same kind (belief / practice)
    items = {}
    for c in (CODES if full else []):
        same = [k for k in CODES if BEL(k) == BEL(c)]
        d = [r[c] - mean([r[k] for k in same]) for r in full]
        res = paired(d, conf=.99)
        items[c] = dict(mean=round(mean([r[c] for r in full]), 2), rel=res)
    out["items"] = {c: dict(mean=v["mean"], rel=round(v["rel"]["diff"], 2), lo=round(v["rel"]["lo"], 2), hi=round(v["rel"]["hi"], 2)) for c, v in items.items()}
    strong = {c for c, v in items.items() if v["rel"]["diff"] >= ITEM_DIFF and v["rel"]["lo"] > 0}
    weak = {c for c, v in items.items() if v["rel"]["diff"] <= -ITEM_DIFF and v["rel"]["hi"] < 0}

    # belief-practice gaps relative to this church's own average gap
    gap_pw = [p for p in PATHWAYS if full and any(BEL(c) for c in p["items"]) and any(not BEL(c) for c in p["items"])]
    per = {p["num"]: [pscore(r, p, "b") - pscore(r, p, "p") for r in full] for p in gap_pw}
    avg_gap = [mean([per[p["num"]][i] for p in gap_pw]) for i in range(len(full))]
    gaps = {}
    for p in gap_pw:
        res = paired([per[p["num"]][i] - avg_gap[i] for i in range(len(full))], conf=.99)
        gaps[p["num"]] = dict(gap=round(mean(per[p["num"]]), 2), vs_avg=round(res["diff"], 2), lo=round(res["lo"], 2), hi=round(res["hi"], 2))
    out["gaps"] = gaps
    wide = {k for k, g in gaps.items() if g["vs_avg"] >= .15 and g["lo"] > 0}
    close = {k for k, g in gaps.items() if g["vs_avg"] <= -.15 and g["hi"] < 0}

    # stage departures (stages with at least MIN_N people among Believing / Trusting / Jesus Centered)
    st_ok = [s for s in (3, 4, 5) if sum(r["stage"] == s for r in full) >= MIN_N]
    stage_flags = {}
    if len(st_ok) >= 2:
        by = {s: [r for r in full if r["stage"] == s] for s in st_ok}
        sc = {p["num"]: {s: [pscore(r, p) for r in by[s]] for s in st_ok} for p in PATHWAYS}
        steps = list(zip(st_ok, st_ok[1:]))
        med_step = {st: median(mean(sc[k][st[1]]) - mean(sc[k][st[0]]) for k in sc) for st in steps}
        med_tot = median(mean(sc[k][st_ok[-1]]) - mean(sc[k][st_ok[0]]) for k in sc)
        for k in sc:
            tot = mean_diff(sc[k][st_ok[-1]], sc[k][st_ok[0]], conf=.99)
            stp = {st: mean_diff(sc[k][st[1]], sc[k][st[0]], conf=.99) for st in steps}
            f = None
            for st, d in stp.items():
                if d["diff"] <= -STAGE_DIFF and d["hi"] < 0: f = ("falls_back", STAGE_NAMES[st[1]])
            if not f and len(steps) > 1 and tot["diff"] < STAGE_DIFF and tot["hi"] < med_tot:
                f = ("no_rise", STAGE_NAMES[st_ok[-1]])
            if not f:
                for st, d in stp.items():
                    if d["diff"] < .15 and d["hi"] < med_step[st] and med_step[st] >= STAGE_DIFF: f = ("stalls", STAGE_NAMES[st[1]])
            if not f and tot["diff"] <= med_tot - STAGE_DIFF and tot["hi"] < med_tot: f = ("rises_less", None)
            if not f and tot["diff"] >= med_tot + STAGE_DIFF and tot["lo"] > med_tot:
                best = max(steps, key=lambda st: stp[st]["diff"] - med_step[st]); f = ("rises_more", STAGE_NAMES[best[1]])
            if f:
                stage_flags[k] = dict(kind=f[0], stage=f[1], scores={STAGE_NAMES[s]: round(mean(sc[k][s]), 2) for s in st_ok},
                                      total=round(tot["diff"], 2), typical_total=round(med_tot, 2),
                                      steps={f"{STAGE_NAMES[a]} to {STAGE_NAMES[b]}": (round(stp[(a, b)]["diff"], 2), round(med_step[(a, b)], 2)) for a, b in steps})
    out["stages_used"] = [STAGE_NAMES[s] for s in st_ok]
    out["stage_flags"] = stage_flags

    # ---------------- Goal tables
    goals = {}
    for g in L.GOALS:
        pws = [p for p in PATHWAYS if p["goal"] == g]
        S, O = [], []   # (weight, text, source)
        for p in pws:
            k = p["num"]; codes = p["items"]
            fl = stage_flags.get(k)
            tag = L.STAGE["tag"].format(stage=fl["stage"]) if fl and fl["kind"] != "rises_more" and fl["stage"] else ""
            # opportunities
            used_tag = False
            w_items = None
            b_weak = [c for c in codes if BEL(c) and c in weak]; p_weak = [c for c in codes if not BEL(c) and c in weak]
            if k in L.BELIEF_GAP and p_weak and not b_weak:
                # the belief holds up but the matching practice is weak: "We believe..., but..."
                O.append((-min(items[c]["rel"]["diff"] for c in p_weak) + .05, L.BELIEF_GAP[k].rstrip(".") + (tag + "." if tag else "."), f"gap:{k}:" + ",".join(p_weak)))
                used_tag = bool(tag); w_items = []
            else:
                w_items = [c for c in codes if c in weak]
            if len(w_items) >= 2:
                O.append((-min(items[c]["rel"]["diff"] for c in w_items), L.PATHWAYS[k][1].rstrip(".") + (tag + "." if tag else "."), f"pathway:{k}:" + ",".join(w_items))); used_tag = bool(tag)
            elif w_items:
                c = w_items[0]; O.append((-items[c]["rel"]["diff"], L.ITEMS[c][1].rstrip(".") + (tag + "." if tag else "."), f"item:{c}")); used_tag = bool(tag)
            if fl and fl["kind"] != "rises_more" and not used_tag:
                O.append((.5, L.STAGE[fl["kind"]].format(pathway=p["name"], stage=fl["stage"], last=out["stages_used"][-1]), f"stage:{k}"))
            # strengths
            s_items = [c for c in codes if c in strong]
            if len(s_items) >= 2 and not any(c in weak for c in codes):
                S.append((max(items[c]["rel"]["diff"] for c in s_items), L.PATHWAYS[k][0], f"pathway:{k}:" + ",".join(s_items)))
            else:
                for c in s_items: S.append((items[c]["rel"]["diff"], L.ITEMS[c][0], f"item:{c}"))
            if k in close: S.append((-gaps[k]["vs_avg"], L.BELIEF_GAP_CLOSE.format(pathway_lc=lc(p["name"])), f"gap:{k}"))
            if fl and fl["kind"] == "rises_more":
                S.append((.6, L.STAGE["rises_more"].format(pathway=p["name"], stage=fl["stage"]), f"stage:{k}"))
        S.sort(key=lambda x: -x[0]); O.sort(key=lambda x: -x[0])
        # Goal-level standing: practice items in this Goal vs all practice items, per person
        prac = [c for p in pws for c in p["items"] if not BEL(c)]
        allp = [c for c in CODES if not BEL(c)]
        res = paired([mean([r[c] for c in prac]) - mean([r[c] for c in allp]) for r in full], conf=.99)
        goals[g] = dict(strengths=S[:CAP], opportunities=O[:CAP], overflow_s=S[CAP:], overflow_o=O[CAP:], standing=res)
    lo_g = min(goals, key=lambda g: goals[g]["standing"]["diff"]); hi_g = max(goals, key=lambda g: goals[g]["standing"]["diff"])
    out["greatest_opportunity"] = lo_g if goals[lo_g]["standing"]["hi"] < 0 else None
    out["greatest_strength"] = hi_g if goals[hi_g]["standing"]["lo"] > 0 else None
    out["goals"] = {g: dict(strengths=[(round(w, 2), t, s) for w, t, s in v["strengths"]], opportunities=[(round(w, 2), t, s) for w, t, s in v["opportunities"]],
                            not_shown=[(round(w, 2), t, s) for w, t, s in v["overflow_s"] + v["overflow_o"]],
                            standing=round(v["standing"]["diff"], 2)) for g, v in goals.items()}

    # ---------------- About ourselves
    A = []
    n = len(rows); sc_ = out["stage_counts"]
    def add(key, share=None, **kw):
        obs, q = L.ABOUT[key]
        A.append(dict(key=key, obs=obs.format(share=share_words(share) if share is not None else "", **kw), q=q.format(**kw) if q else ""))
    if all(sc_[s] >= 1 for s in range(1, 6)) and min(sc_.values()) / n >= .03: add("stage_all")
    early = sum(sc_[s] for s in (1, 2, 3)) / n
    if early >= .4: add("stage_early", early)
    jc = sc_[5] / n
    if jc < .15: add("stage_centered_few", jc)
    elif jc >= .3: add("stage_centered_many", jc)
    grow = sum(r["change"] in (1, 2) for r in rows) / n; same = sum(r["change"] == 3 for r in rows) / n; fade = sum(r["change"] in (4, 5) for r in rows) / n
    if grow >= .6: add("growth_most", grow)
    elif same >= .3: add("growth_same", same)
    if fade >= .08: add("fading", fade)
    for s in (3, 4, 5):
        g_in = [r for r in rows if r["stage"] == s]; g_out = [r for r in rows if r["stage"] != s]
        if len(g_in) >= MIN_N and len(g_out) >= MIN_N:
            d = prop_diff(sum(r["change"] in (1, 2) for r in g_in), len(g_in), sum(r["change"] in (1, 2) for r in g_out), len(g_out), conf=.95)
            if d["diff"] <= -15 and d["hi"] < 0: add("growth_stage_low", stage=STAGE_NAMES[s])
    def cnt(f): return sum(1 for r in rows if f(r))
    wk = cnt(lambda r: r["attendance"] == "Every week")
    infreq = cnt(lambda r: r["attendance"] in ("Monthly", "Every few months", "Infrequently or never"))
    if wk / n >= .6: add("attend_weekly", wk / n)
    if infreq >= MIN_N and infreq / n >= .15: add("attend_infrequent", infreq / n)
    new = cnt(lambda r: r["tenure"] in ("Less than 1 year", "1-2 years"))
    if new >= MIN_N and new / n >= .2: add("newcomers", new / n)
    old = cnt(lambda r: r["tenure"] == "11 or more years")
    if old >= MIN_N and old / n >= .35: add("long_tenure", old / n)
    ya = cnt(lambda r: r["age"] in ("16-19", "20-29"))
    if ya >= MIN_N: add("young_adults", ya / n)
    elif ya / n < .12: add("young_adults_few", ya / n)
    o60 = cnt(lambda r: r["age"] == "60 and older")
    if o60 >= MIN_N and o60 / n >= .35: add("older", o60 / n)
    kids = cnt(lambda r: r["children"] == "Yes")
    if kids >= MIN_N and kids / n >= .3: add("children", kids / n)
    sing = cnt(lambda r: r["relationship"] in ("Independent single", "Single in relationship"))
    if sing >= MIN_N and sing / n >= .2: add("singles", sing / n)
    sep = cnt(lambda r: r["relationship"] in ("Divorced", "Married but separated"))
    if sep >= MIN_N: add("separated", sep / n)
    vm = cnt(lambda r: r["ethnicity"] == "Other")
    if vm >= MIN_N: add("minorities", vm / n)
    nsg = cnt(lambda r: r["smallgroup"] in ("Every few months", "Infrequently or never"))
    if nsg >= MIN_N and nsg / n >= .3: add("no_small_group", nsg / n)
    vol = cnt(lambda r: r["volunteer"] in ("Every week", "A few times/month"))
    if vol / n < .45: add("volunteer_few", vol / n)
    # group anomalies: growth and stage-matched pathway differences (strict: whole-screen 5% chance control)
    groups = []
    for fld, vals in [("age", ["16-19", "20-29", "30-39", "40-49", "50-59", "60 and older"]), ("gender", ["Male", "Female"]),
                      ("tenure", ["Less than 1 year", "1-2 years", "3-5 years", "6-10 years", "11 or more years"])]:
        for v in vals: groups.append((L.GROUP_LABELS[fld][v], lambda r, f=fld, v=v: r[f] == v))
    groups += [("Those of us who seldom attend", lambda r: r["attendance"] in ("Monthly", "Every few months", "Infrequently or never")),
               ("Those of us not in a small group", lambda r: r["smallgroup"] in ("Every few months", "Infrequently or never")),
               ("People of non-White backgrounds", lambda r: r["ethnicity"] == "Other"),
               ("Single people", lambda r: r["relationship"] in ("Independent single", "Single in relationship")),
               ("Households with children", lambda r: r["children"] == "Yes")]
    flags = []
    n_tests = len(groups) * (1 + len(PATHWAYS)); conf = 1 - .05 / n_tests
    stage_mean = {(p["num"], s): mean([pscore(r, p) for r in full if r["stage"] == s]) for p in PATHWAYS for s in (3, 4, 5) if any(r["stage"] == s for r in full)}
    for label, f in groups:
        gi = [r for r in rows if f(r)]; go = [r for r in rows if not f(r)]
        if len(gi) >= MIN_N and len(go) >= MIN_N:
            d = prop_diff(sum(r["change"] in (1, 2) for r in gi), len(gi), sum(r["change"] in (1, 2) for r in go), len(go), conf=conf)
            if d["diff"] <= -15 and d["hi"] < 0: flags.append((abs(d["diff"]) / 50, "group_growth_low", dict(group=label, group_lc=lc(label))))
        fi = [r for r in full if f(r)]; fo = [r for r in full if not f(r)]
        if len(fi) >= MIN_N and len(fo) >= MIN_N:
            for p in PATHWAYS:
                ri = [pscore(r, p) - stage_mean[(p["num"], r["stage"])] for r in fi]
                ro = [pscore(r, p) - stage_mean[(p["num"], r["stage"])] for r in fo]
                d = mean_diff(ri, ro, conf=conf)
                if abs(d["diff"]) >= STAGE_DIFF and (d["hi"] < 0 or d["lo"] > 0):
                    flags.append((abs(d["diff"]), "group_pathway_low" if d["diff"] < 0 else "group_pathway_high",
                                  dict(group=label, group_lc=lc(label), pathway=p["name"], pathway_lc=p["name"].lower())))
    flags.sort(key=lambda x: -x[0]); seen = set()
    for w, key, kw in flags:
        if kw["group"] in seen: continue
        seen.add(kw["group"]); add(key, **kw)
        if len(seen) == 2: break
    out["about"] = A
    return out

# ------------------------------------------------------------------ render
def src_pathway(src):
    kind, rest = src.split(":", 1)
    if kind == "item": return next(p["num"] for p in PATHWAYS if rest in p["items"])
    return int(rest.split(":")[0])

def with_page(text, page):
    if not page: return text
    t = text.rstrip(".")
    if t.endswith(")"): return t[:-1] + f"; see page {page})."
    return t + L.SEE_PAGE.format(page=page) + "."

def cell(lines): return "<br>".join(f"• {t}" for t in lines) if lines else "Nothing in this Goal stands out from our other results."

def summary_lists(sel):
    allS = sorted(((w_, t, s_) for g in sel["goals"].values() for w_, t, s_ in g["strengths"]), key=lambda x: -x[0])[:4]
    allO = sorted(((w_, t, s_) for g in sel["goals"].values() for w_, t, s_ in g["opportunities"]), key=lambda x: -x[0])[:4]
    qs = []
    for _, _, src in allO:
        q = L.PATHWAYS[src_pathway(src)][2]
        if q not in qs: qs.append(q)
    return allS, allO, qs[:4]

def where_next(add):
    add("## Where do we go from here?\n")
    for i, x in enumerate(L.WHERE_NEXT, 1):
        if isinstance(x, tuple):
            add(f"{i}. {x[0]}")
            for b in x[1]: add(f"    - {b}")
        else: add(f"{i}. {x}")
    add("")

def goal_cells(sel, g, pages=True):
    G = sel["goals"][g]
    s = [with_page(t, L.PATHWAY_PAGE[src_pathway(src)] if pages else None) for _, t, src in G["strengths"]]
    o = [with_page(t, L.PATHWAY_PAGE[src_pathway(src)] if pages else None) for _, t, src in G["opportunities"]]
    if sel["greatest_strength"] == g: s = [with_page(L.GOAL["greatest_strength"], L.GOAL_PAGE[g] if pages else None)] + s
    if sel["greatest_opportunity"] == g: o = [with_page(L.GOAL["greatest_opportunity"], L.GOAL_PAGE[g] if pages else None)] + o
    return s, o

def render(name, rows, sel):
    w = []; add = w.append
    add(f"# {name}: Survey Review\n")
    add(f"{sel['n']} people took part. Strengths and opportunities compare our results with each other, so every church has both. Results for a stage or group appear only when it has at least 10 people. Page references point to our full church report.\n")
    add("## What did we discover about ourselves?\n")
    add("| What we see | Questions to consider |")
    add("|---|---|")
    for a in sel["about"]: add(f"| {with_page(a['obs'], L.ABOUT_PAGE.get(a['key']))} | {a['q']} |")
    add("")
    add("## What did we learn about our journey together in becoming more like Jesus?\n")
    for g, sub in L.GOALS.items():
        s, o = goal_cells(sel, g)
        add(f"### {g}: {sub}\n")
        add("**Strengths to Celebrate**\n")
        add("\n".join(f"- {t}" for t in s) if s else "- Nothing in this Goal stands out from our other results.")
        add("\n**Opportunities to Investigate**\n")
        add("\n".join(f"- {t}" for t in o) if o else "- Nothing in this Goal stands out from our other results.")
        add("")
    allS, allO, qs = summary_lists(sel)
    add("## Summary thoughts\n")
    for head, lst in (("Our greatest strengths", [t for _, t, _ in allS]), ("Our greatest opportunities", [t for _, t, _ in allO]), ("Questions for our conversation", qs)):
        add(f"**{head}**\n"); add("\n".join(f"- {t}" for t in lst)); add("")
    where_next(add)
    add("---\n")
    missing = [STAGE_NAMES[s] for s in (3, 4, 5) if sel["stage_counts"][s] < MIN_N]
    note = f" Our {' and '.join(missing)} group{'s are' if len(missing) > 1 else ' is'} too small to show separately." if missing else ""
    add(f"How to read this: strengths and opportunities are based on the {sel['n_full']} people in the Believing, Trusting and Jesus Centered stages, who answered all 63 statements. Beliefs are compared with beliefs and practices with practices, because beliefs always run ahead of practice.{note}\n")
    return "\n".join(w)

# ------------------------------------------------------------------ facilitator report
def am(rows, codes):
    """% answering Always / Most of the time (4-5) on the average of codes: the measure the full report shows."""
    return round(100 * mean([mean([r[c] >= 4 for c in codes]) for r in rows])) if rows else None

def stage_am(full, codes, sel):
    parts = []
    for s in (3, 4, 5):
        g = [r for r in full if r["stage"] == s]
        parts.append(f"{STAGE_NAMES[s]} {am(g, codes)}%" if len(g) >= MIN_N else f"{STAGE_NAMES[s]} n<10")
    return " · ".join(parts)

def evidence(src, sel, full):
    kind, rest = src.split(":", 1); it = sel["items"]
    kind_avg = lambda c: "belief" if BEL(c) else "practice"
    if kind == "item":
        c = rest; v = it[c]
        return f"{c} “{ITEM_TEXT[c]}”", f"Score {v['mean']:.2f}, {v['rel']:+.2f} vs our {kind_avg(c)} average. Always/Mostly true: {stage_am(full, [c], sel)}"
    if kind == "pathway":
        k, codes = rest.split(":"); codes = codes.split(",")
        based = f"{PW_BY_NUM[int(k)]['name']}: " + ", ".join(codes)
        nums = "; ".join(f"{c} {it[c]['mean']:.2f} ({it[c]['rel']:+.2f} vs our {kind_avg(c)} average)" for c in codes)
        return based, f"{nums}. Always/Mostly true: {stage_am(full, codes, sel)}"
    if kind == "gap":
        parts = rest.split(":"); k = int(parts[0]); pw = PW_BY_NUM[k]
        bel = [c for c in pw["items"] if BEL(c)]; prac = parts[1].split(",") if len(parts) > 1 else [c for c in pw["items"] if not BEL(c)]
        pn = "; ".join(f"{c} {it[c]['mean']:.2f} ({it[c]['rel']:+.2f} vs our practice average)" for c in prac)
        return (f"{pw['name']}: belief {', '.join(bel)} vs practice {', '.join(prac)}",
                f"The belief holds up; the practice is clearly low: {pn}. Always/Mostly true, belief: {stage_am(full, bel, sel)}. Practice: {stage_am(full, prac, sel)}")
    if kind == "stage":
        k = int(rest); f = sel["stage_flags"][k]
        pw = PW_BY_NUM[k]
        sc = " → ".join(f"{s} {v:.2f}" for s, v in f["scores"].items())
        st = "; ".join(f"{k_} {v[0]:+.2f} (typical {v[1]:+.2f})" for k_, v in f["steps"].items())
        return f"{pw['name']} (all {len(pw['items'])} statements), by stage", f"Average {sc}. Rise {st}. Always/Mostly true: {stage_am(full, pw['items'], sel)}"
    return "", ""

def about_numbers(key, rows, sel):
    n = len(rows); sc = sel["stage_counts"]
    c = lambda f: sum(1 for r in rows if f(r))
    pct = lambda k: f"{k} of {n} ({round(100 * k / n)}%)"
    m = {
        "stage_all": lambda: ", ".join(f"{['', 'Distant', 'Exploring', 'Believing', 'Trusting', 'Jesus Centered'][s]} {sc[s]}" for s in range(1, 6)),
        "stage_early": lambda: f"Distant, Exploring and Believing: {pct(sc[1] + sc[2] + sc[3])}",
        "stage_centered_few": lambda: f"Jesus Centered: {pct(sc[5])}",
        "stage_centered_many": lambda: f"Jesus Centered: {pct(sc[5])}",
        "growth_most": lambda: f"Growing significantly or a little: {pct(c(lambda r: r['change'] in (1, 2)))}",
        "growth_same": lambda: f"About the same: {pct(c(lambda r: r['change'] == 3))}",
        "fading": lambda: f"Fading somewhat or a lot: {round(100 * c(lambda r: r['change'] in (4, 5)) / n)}%",
        "attend_weekly": lambda: f"Every week: {pct(c(lambda r: r['attendance'] == 'Every week'))}",
        "attend_infrequent": lambda: f"Monthly or less: {pct(c(lambda r: r['attendance'] in ('Monthly', 'Every few months', 'Infrequently or never')))}",
        "newcomers": lambda: f"Less than 1 year or 1–2 years: {pct(c(lambda r: r['tenure'] in ('Less than 1 year', '1-2 years')))}",
        "long_tenure": lambda: f"11 or more years: {pct(c(lambda r: r['tenure'] == '11 or more years'))}",
        "young_adults": lambda: f"Ages 16–29: {pct(c(lambda r: r['age'] in ('16-19', '20-29')))}",
        "young_adults_few": lambda: f"Ages 16–29: {round(100 * c(lambda r: r['age'] in ('16-19', '20-29')) / n)}%",
        "older": lambda: f"60 and older: {pct(c(lambda r: r['age'] == '60 and older'))}",
        "children": lambda: f"Any children at home: {pct(c(lambda r: r['children'] == 'Yes'))}",
        "singles": lambda: f"Independent single or single in a relationship: {pct(c(lambda r: r['relationship'] in ('Independent single', 'Single in relationship')))}",
        "separated": lambda: f"Divorced or separated: {pct(c(lambda r: r['relationship'] in ('Divorced', 'Married but separated')))}",
        "minorities": lambda: f"Any choice other than White/Caucasian: {pct(c(lambda r: r['ethnicity'] == 'Other'))}",
        "no_small_group": lambda: f"Small group every few months or less: {pct(c(lambda r: r['smallgroup'] in ('Every few months', 'Infrequently or never')))}",
        "volunteer_few": lambda: f"Volunteer at least a few times a month: {pct(c(lambda r: r['volunteer'] in ('Every week', 'A few times/month')))}",
    }
    return m[key]() if key in m else None

def render_facilitator(name, rows, sel):
    full = [r for r in rows if r["stage"] >= 3 and r.get("full_form", True)]
    w = []; add = w.append
    add(f"# {name}: Facilitator's Report\n")
    add("This report mirrors the church's Survey Review line by line. For each line it shows what it is based on, the key numbers and the page in the full church report where the church can see the same data.\n")
    add("**Reading the numbers.** The full church report shows the percentage answering Always or Most of the time true, by stage, and so does this report. Lines were chosen by comparing each statement's average score (1–5) with the church's average for statements of the same kind, beliefs with beliefs and practices with practices.\n")
    sc = sel["stage_counts"]
    add("| Who took part | " + " | ".join(["Distant", "Exploring", "Believing", "Trusting", "Jesus Centered", "Total"]) + " |")
    add("|---|" + "---|" * 6)
    add("| People | " + " | ".join(str(sc[s]) for s in range(1, 6)) + f" | {sel['n']} |\n")
    missing = [STAGE_NAMES[s] for s in (3, 4, 5) if sc[s] < MIN_N]
    if missing: add(f"Stage comparisons leave out the {' and '.join(missing)} group (fewer than 10 people).\n")
    add("## What did we discover about ourselves?\n")
    add("| Line in the church report | Numbers | Full report |")
    add("|---|---|---|")
    for a in sel["about"]:
        nums = about_numbers(a["key"], rows, sel) or "Stage-matched comparison; passes the strict chance check. Not shown in the full report."
        pg = L.ABOUT_PAGE.get(a["key"])
        add(f"| {a['obs']} | {nums} | {'p. ' + pg if pg else 'Not shown'} |")
    add("")
    add("## What did we learn about our journey together?\n")
    for g, sub in L.GOALS.items():
        G = sel["goals"][g]
        add(f"### {g} (full report pp. {L.GOAL_PAGE[g] - 3}–{L.GOAL_PAGE[g]})\n")
        if sel["greatest_strength"] == g or sel["greatest_opportunity"] == g:
            lab = "greatest strength" if sel["greatest_strength"] == g else "greatest opportunity"
            add(f"Marked as our {lab}: this Goal's practices average {G['standing']:+.2f} compared with all our practices (Goal chart, p. {L.GOAL_PAGE[g]}).\n")
        add("| | Line | Based on | Numbers | Page |")
        add("|---|---|---|---|---|")
        for side, lst in (("Strength", G["strengths"]), ("Opportunity", G["opportunities"])):
            for _, t, src in lst:
                based, nums = evidence(src, sel, full)
                add(f"| {side} | {t} | {based} | {nums} | {L.PATHWAY_PAGE[src_pathway(src)]} |")
        if G["not_shown"]:
            add("\nAlso qualified but not shown (limit of 4 per cell): " + "; ".join(t for _, t, _ in G["not_shown"]))
        add("")
    add("## Summary thoughts and next steps\n")
    add("Summary thoughts repeat the strongest four lines from each side above, so no new data is needed. “Where do we go from here?” is the same for every church.\n")
    add("## Notes for the facilitator\n")
    add("- A line appears only when the difference is clear (at least 0.2 points from the same-kind average, and unlikely to be chance).")
    add("- Stage lines need at least 10 people in each stage compared. They compare each pathway's rise with this church's typical rise across all 16 pathways.")
    add("- Group differences in the first table are stage-matched and use a strict whole-screen chance check. With groups of 10 to 15, about 1 report in 20 may still show one chance result, so treat these as questions, not conclusions.")
    add("- Distant and Exploring respondents answer the 38-statement short form, so the Goal tables use the Believing, Trusting and Jesus Centered stages. The full report also shows an Exploring column.\n")
    return "\n".join(w)

