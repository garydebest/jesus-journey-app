"""PDFs for the Core Leaders Review and its facilitator companion, plus the leaders-vs-congregation
section added to the final Facilitator's Report. Same look as the Survey Review (render_pdf.py)."""
from pathlib import Path
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Table, TableStyle, Spacer, KeepTogether, ListFlowable, ListItem

import render_pdf as R
from render_pdf import P, E, W, BODY, SMALL, CELL, CELL_S, HEAD, HEAD_S, H1, H2, SUBT
from copyright_notice import SURVEY_COPYRIGHT

TITLE = "Core Leaders Review"
FAC_TITLE = "Core Leaders Facilitator's Report"


def _notice(text, edge=R.CORAL):
    t = Table([[P(E(text), BODY)]], colWidths=[W])
    t.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), R.SURFACE), ("LINEBEFORE", (0, 0), (0, -1), 4, edge),
                           ("LEFTPADDING", (0, 0), (-1, -1), 14), ("RIGHTPADDING", (0, 0), (-1, -1), 14),
                           ("TOPPADDING", (0, 0), (-1, -1), 10), ("BOTTOMPADDING", (0, 0), (-1, -1), 10)]))
    return t


def _where_next(LD):
    """Leaders' closing steps, drawn like the Survey Review's 'Where do we go from here?' box."""
    class _L: WHERE_NEXT = LD.WHERE_NEXT
    return R.where_next_box(_L)


def _summary_table(sel, LD):
    allS, allO, qs = LD.summary_lists(sel)
    return R.table([[P("Our greatest strengths", HEAD), P("Our greatest opportunities", HEAD), P("Questions for our conversation", HEAD)],
                    [R.bullets(allS, CELL), R.bullets(allO, CELL), R.bullets(qs, CELL)]], [W / 3] * 3,
                   head_bg=[R.TEAL, R.CORAL, R.OLIVE], pad=10, extra=[("BACKGROUND", (0, 1), (-1, -1), colors.white), ("LINEAFTER", (0, 0), (1, -1), 0.6, R.LINE)])


def _missing_note(sel, B):
    missing = [B.STAGE_NAMES[x] for x in (3, 4, 5) if sel["stage_counts"][x] < B.MIN_N]
    return f" Our {' and '.join(missing)} group{'s are' if len(missing) > 1 else ' is'} too small to show separately." if missing else ""


def church_pdf(path, name, sel, B, L, LD):
    s = [P(TITLE, H1), P(E(name), SUBT), _notice(LD.INTRO), Spacer(1, 8),
         P(E(f"{sel['n']} of our core leaders took part. {L.STANDARD} Results for a stage appear only when it has at least 10 people. {LD.BORDERLINE_NOTE}"), SMALL)]
    if sel["about"]:
        s.append(P("What did we discover about ourselves?", H2))
        data = [[P("What we see", HEAD), P("Questions to consider", HEAD)]]
        for a in sel["about"]:
            data.append([P(E(a["obs"]), CELL), P(E(a["q"]), ParagraphStyle("q", parent=CELL, textColor=R.TEAL_DARK))])
        s.append(R.table(data, [W * .5, W * .5], head_bg=[R.TEAL_DARK, R.TEAL]))
    withheld = sel.get("goal_tables_withheld")
    if withheld:
        s.append(KeepTogether([P("What did we learn about our journey together in becoming more like Jesus?", H2),
                               _notice("Fewer than 10 of our leaders in the Believing, Trusting and Jesus Centered stages answered all 63 statements, so strengths and opportunities by Goal are not shown, to protect confidentiality.")]))
    first = True
    for gn, (g, sub) in enumerate(L.GOALS.items() if not withheld else [], 1):
        st, op = LD.goal_cells(sel, g)
        hs = ParagraphStyle("hs", parent=HEAD, textColor=R.TEAL_DARK); ho = ParagraphStyle("ho", parent=HEAD, textColor=R.CORAL_DARK)
        t = R.table([[P("Strengths to Celebrate", hs), P("Opportunities to Investigate", ho)], [R.bullets(st, empty=LD.EMPTY_S), R.bullets(op, empty=LD.EMPTY_O)]], [W * .5, W * .5],
                    head_bg=[R.TINT_S, R.TINT_O], pad=11, extra=[("BACKGROUND", (0, 1), (-1, -1), colors.white), ("LINEAFTER", (0, 0), (0, -1), 0.6, R.LINE)])
        blk = ([P("What did we learn about our journey together in becoming more like Jesus?", H2)] if first else [Spacer(1, 16)]) + [R.band(gn, g, sub), t]
        s.append(KeepTogether(blk)); first = False
    if not withheld:
        s.append(KeepTogether([P("Summary thoughts", H2), _summary_table(sel, LD)]))
    how = "" if withheld else (f"How to read this: strengths and opportunities are based on the {sel['n_full']} leaders in the Believing, Trusting and Jesus Centered stages, who answered all 63 statements. "
                               "Lines are chosen and ordered by comparing beliefs with beliefs and practices with practices, because beliefs always run ahead of practice." + _missing_note(sel, B))
    s.append(KeepTogether([P("Where do we go from here?", H2), _where_next(LD), Spacer(1, 14), P(E(how), SMALL), Spacer(1, 6), P(E(SURVEY_COPYRIGHT), SMALL)]))
    d = R.doc(path, f"{name}: {TITLE}")
    d.build(s, onFirstPage=R.footer(f"{name}  \u2022  {TITLE}"), onLaterPages=R.footer(f"{name}  \u2022  {TITLE}"))


def facilitator_pdf(path, name, rows, sel, B, L, LD):
    full = [r for r in rows if r["stage"] >= 3 and r.get("full_form", True)]
    s = [P(FAC_TITLE, H1), P(E(name), SUBT),
         P(E("This report mirrors the church's Core Leaders Review line by line. For each line it shows what it is based on and the key numbers. "
             "It covers only the responses that came in through the leader code, before the whole church was invited. There are no page references because the full church report does not exist yet."), BODY), Spacer(1, 4),
         P(E("Reading the numbers: a statement qualifies as a strength when at least 75% of believers answer Always or Mostly true, and as an opportunity when fewer than 60% do. "
             f"A line is marked borderline when a statement behind it is within {LD.BORDERLINE} points of its line (75–79% for a strength, 55–59% for an opportunity). "
             "Demographics, group-difference findings and comments are left out of this review."), SMALL), Spacer(1, 6)]
    sc = sel["stage_counts"]
    s.append(R.table([[P(h, HEAD_S) for h in ["Who took part", "Distant", "Exploring", "Believing", "Trusting", "Jesus Centered", "Total"]],
                      [P("Leaders", CELL_S)] + [P(str(sc[x]), CELL_S) for x in range(1, 6)] + [P(str(sel["n"]), CELL_S)]], [W * .22] + [W * .13] * 6))
    missing = [B.STAGE_NAMES[x] for x in (3, 4, 5) if sc[x] < B.MIN_N]
    if missing: s.append(P(E(f"Stage comparisons leave out the {' and '.join(missing)} group (fewer than 10 people)."), SMALL))
    if sel["about"]:
        s.append(P("What did we discover about ourselves?", H2))
        data = [[P(h, HEAD_S) for h in ["Line in the leaders' review", "Numbers"]]]
        for a in sel["about"]:
            data.append([P(E(a["obs"]), CELL_S), P(E(B.about_numbers(a["key"], rows, sel) or ""), CELL_S)])
        s.append(R.table(data, [W * .55, W * .45], HEAD_S))
    for gi, g in enumerate(L.GOALS):
        G = sel["goals"][g]
        blk = ([P("What did we learn about our journey together?", H2)] if gi == 0 else []) + [Spacer(1, 6), R.band(gi + 1, g, L.GOALS[g]), Spacer(1, 6)]
        if sel["greatest_strength"] == g or sel["greatest_opportunity"] == g:
            lab = "greatest strength" if sel["greatest_strength"] == g else "greatest opportunity"
            blk.append(P(E(f"Marked as our {lab}: this Goal's practices average {G['standing']:+.2f} compared with all our practices."), SMALL))
        data = [[P(h, HEAD_S) for h in ["", "Line", "Based on", "Numbers"]]]
        for side, key, lst in (("Strength", "s", G["strengths"]), ("Opportunity", "o", G["opportunities"])):
            for _, t, src in lst:
                based, nums = B.evidence(src, sel, full)
                label = side + (" · borderline" if LD.is_borderline(src, key, sel) else "")
                data.append([P(E(label), CELL_S), P(E(t), CELL_S), P(E(based), CELL_S), P(E(nums), CELL_S)])
        if len(data) == 1:
            data.append([P("–", CELL_S), P(E("No line qualified in this Goal."), CELL_S), P("", CELL_S), P("", CELL_S)])
        blk.append(R.table(data, [W * .16, W * .26, W * .2, W * .38], HEAD_S, pad=7))
        if G["not_shown"]: blk.append(P(E("Also qualified but not shown (limit of 4 per cell): " + "; ".join(t for _, t, _ in G["not_shown"])), SMALL))
        s.append(KeepTogether(blk[:-2] if G["not_shown"] else blk[:-1])); s.extend(blk[-2:] if G["not_shown"] else blk[-1:])
    if sel.get("goal_tables_withheld"):
        s.append(KeepTogether([P("Summary thoughts", H2), P(E("Not shown: fewer than 10 leaders in the Believing, Trusting and Jesus Centered stages answered all 63 statements."), BODY)]))
    else:
        s.append(KeepTogether([P("Summary thoughts", H2), P(E("As the church sees it in its Core Leaders Review."), SMALL), Spacer(1, 4), _summary_table(sel, LD)]))
    s.append(KeepTogether([P("Where do we go from here?", H2), P(E("As the church sees it in its Core Leaders Review."), SMALL), Spacer(1, 4), _where_next(LD)]))
    s.append(KeepTogether([P("Notes for the facilitator", H2), ListFlowable([ListItem(P(E(t)), leftIndent=12) for t in [
        *[t.replace("Qualifying strengths that do not fit are pointed to with one closing line.", "Qualifying lines that do not fit are listed under each Goal table in this report.") for t in L.FAC_NOTES],
        f"With {sel['n']} leaders, each person moves a percentage by about {max(1, round(100 / max(sel['n_full'], 1)))} points. Treat borderline lines as conversation starters rather than findings.",
        "Leaders are usually further along the journey than the church as a whole, so expect more strengths here than in the final church report.",
        "The leaders' answers stay in the survey and are included in the final church report. When the survey closes, the Facilitator's Report adds a leaders-and-congregation comparison.",
    ]], bulletType="bullet", start="\u2022", leftIndent=12)]))
    d = R.doc(path, f"{name}: {FAC_TITLE}")
    d.build(s, onFirstPage=R.footer(f"{name}  \u2022  {FAC_TITLE}"), onLaterPages=R.footer(f"{name}  \u2022  {FAC_TITLE}"))


def comparison_flowables(cmp, LD):
    """'Our leaders and the congregation' section for the final Facilitator's Report."""
    out = [P("Our leaders and the congregation", H2),
           P(E(f"This survey began with a core leaders' round. {cmp['n_leaders']} people answered through the leader code and {cmp['n_others']} through the church code. "
               "Leaders are usually further along the journey, so some difference is expected; look for where the gap is unusually wide or narrow."), BODY), Spacer(1, 6)]
    names = list(cmp["stages"])
    out.append(R.table([[P(h, HEAD_S) for h in ["Who took part"] + names + ["Total"]],
                        [P("Leaders", CELL_S)] + [P(str(cmp["stages"][k][0]), CELL_S) for k in names] + [P(str(cmp["n_leaders"]), CELL_S)],
                        [P("Congregation", CELL_S)] + [P(str(cmp["stages"][k][1]), CELL_S) for k in names] + [P(str(cmp["n_others"]), CELL_S)]],
                       [W * .22] + [W * .13] * 6))
    g = cmp["growth"]
    out.append(Spacer(1, 6))
    out.append(P(E(f"Growing significantly or a little: leaders {g['leaders']}%, congregation {g['others']}% ({g['diff']:+d} points"
                   + ("; a clear difference)." if g["clear"] else "; not a clear difference with these numbers).")), SMALL))
    if cmp["goals"]:
        data = [[P(h, HEAD_S) for h in ["Goal (% Always/Mostly true)", "Leaders", "Congregation", "Difference"]]]
        for name, v in cmp["goals"].items():
            data.append([P(E(name), CELL_S), P(f"{v['leaders']}%", CELL_S), P(f"{v['others']}%", CELL_S), P(f"{v['diff']:+d}", CELL_S)])
        out += [Spacer(1, 8), R.table(data, [W * .4, W * .2, W * .2, W * .2], HEAD_S, pad=7)]
        if cmp["pathways"]:
            data = [[P(h, HEAD_S) for h in ["Pathway with a clear difference", "Leaders", "Congregation", "Difference"]]]
            for p in cmp["pathways"]:
                data.append([P(E(f"{p['name']} ({p['goal']})"), CELL_S), P(f"{p['leaders']}%", CELL_S), P(f"{p['others']}%", CELL_S), P(f"{p['diff']:+d}", CELL_S)])
            out += [Spacer(1, 8), R.table(data, [W * .4, W * .2, W * .2, W * .2], HEAD_S, pad=7)]
        else:
            out.append(P(E("No pathway shows a clear difference between leaders and congregation."), SMALL))
        out.append(P(E(f"Goal and pathway figures use the believers who answered all 63 statements ({cmp['n_full'][0]} leaders, {cmp['n_full'][1]} congregation). "
                       f"A pathway is listed only when the difference is at least {LD.COMPARE_DIFF} points and passes a strict chance check across all 16 pathways."), SMALL))
    else:
        out.append(P(E("Goal and pathway comparisons are not shown: fewer than 10 believers on one side answered all 63 statements."), SMALL))
    return out
