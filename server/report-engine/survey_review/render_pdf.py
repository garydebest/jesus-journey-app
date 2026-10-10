import sys
"""PDF versions of the simple church report and facilitator report (side-by-side tables, embedded fonts)."""
from pathlib import Path
from xml.sax.saxutils import escape
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Table, TableStyle, Spacer, KeepTogether, ListFlowable, ListItem
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

FONTS = Path(__file__).resolve().parents[1] / "fonts"
sys.path.insert(0, str(FONTS.parent))
from copyright_notice import SURVEY_COPYRIGHT  # noqa: E402
for nm, f in [("Inter", "Inter-Regular.ttf"), ("Inter-SemiBold", "Inter-SemiBold.ttf"), ("Inter-Bold", "Inter-Bold.ttf"), ("DMSans-Bold", "DMSans-Bold.ttf")]:
    pdfmetrics.registerFont(TTFont(nm, str(FONTS / f)))
from reportlab.lib.fonts import addMapping
addMapping("Inter", 0, 0, "Inter"); addMapping("Inter", 1, 0, "Inter-SemiBold")
TEAL_DARK = colors.HexColor("#1B474D"); TEAL = colors.HexColor("#20808D"); TEAL_LIGHT = colors.HexColor("#BCE2E7")
CORAL = colors.HexColor("#D97B66"); SAND = colors.HexColor("#D8CBB0"); OLIVE = colors.HexColor("#848456")
INK = colors.HexColor("#1E2B2C"); MUTED = colors.HexColor("#5B6B6B"); SURFACE = colors.HexColor("#F4F7F6"); LINE = colors.HexColor("#D5DEDC")
TINT_S = colors.HexColor("#E4F2F3"); TINT_O = colors.HexColor("#FBEAE5"); CORAL_DARK = colors.HexColor("#9A4532")
GOAL_COLORS = {"Trusting Jesus": (TEAL, colors.white), "Experiencing Jesus": (TEAL_LIGHT, TEAL_DARK),
               "Reflecting Jesus": (CORAL, INK), "Serving Jesus": (SAND, INK)}
LOGO = FONTS.parent / "assets/jj_logo.png"

H1 = ParagraphStyle("h1", fontName="DMSans-Bold", fontSize=26, leading=31, textColor=TEAL_DARK, spaceAfter=2)
SUBT = ParagraphStyle("st", fontName="Inter", fontSize=13, leading=17, textColor=TEAL, spaceAfter=12)
H2 = ParagraphStyle("h2", fontName="DMSans-Bold", fontSize=17, leading=22, textColor=TEAL_DARK, spaceBefore=18, spaceAfter=10)
H3 = ParagraphStyle("h3", fontName="Inter-SemiBold", fontSize=12, leading=16, textColor=INK, spaceBefore=10, spaceAfter=6)
BODY = ParagraphStyle("b", fontName="Inter", fontSize=10.8, leading=15.5, textColor=INK)
SMALL = ParagraphStyle("s", parent=BODY, fontSize=9.4, leading=13.4, textColor=MUTED)
CELL = ParagraphStyle("c", parent=BODY, fontSize=10.6, leading=15)
CELL_S = ParagraphStyle("cs", parent=BODY, fontSize=9.6, leading=13.6)
HEAD = ParagraphStyle("hd", parent=BODY, fontName="Inter-SemiBold", textColor=colors.white, fontSize=10.8, leading=14)
HEAD_S = ParagraphStyle("hds", parent=HEAD, fontSize=9.8, leading=13)
BAND = ParagraphStyle("band", parent=BODY, fontName="DMSans-Bold", fontSize=14, leading=18)
BAND_Q = ParagraphStyle("bandq", parent=BODY, fontSize=10.5, leading=14.5)

def P(t, st=BODY): return Paragraph(t, st)
def E(t): return escape(t)

def bullets(lines, st=CELL, empty="Nothing in this Goal stands out from our other results."):
    if not lines: return [P(E(empty), st)]
    out = []
    for t in lines:
        if t.startswith("This is our greatest") or t.startswith("This is where we are strongest"):
            col = CORAL_DARK if t.startswith("This is our greatest") else TEAL_DARK
            out.append(P(f'<font name="Inter-SemiBold" color="{col.hexval().replace("0x", "#")}">{E(t)}</font>', ParagraphStyle("gl", parent=st, spaceAfter=8)))
        else:
            out.append(P("\u2022&nbsp;&nbsp;" + E(t), ParagraphStyle("bl", parent=st, leftIndent=11, firstLineIndent=-11, spaceAfter=7)))
    return out

def table(data, widths, head_style=HEAD, head_bg=None, pad=9, extra=()):
    t = Table(data, colWidths=widths, repeatRows=1)
    st = [("BACKGROUND", (0, 0), (-1, 0), TEAL_DARK), ("VALIGN", (0, 0), (-1, -1), "TOP"),
          ("LINEBELOW", (0, 0), (-1, -1), 0.6, LINE), ("BOX", (0, 0), (-1, -1), 0.6, LINE),
          ("LEFTPADDING", (0, 0), (-1, -1), pad), ("RIGHTPADDING", (0, 0), (-1, -1), pad),
          ("TOPPADDING", (0, 0), (-1, -1), pad - 1), ("BOTTOMPADDING", (0, 0), (-1, -1), pad),
          ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, SURFACE])]
    if head_bg:
        for col, bg in enumerate(head_bg): st.append(("BACKGROUND", (col, 0), (col, 0), bg))
    t.setStyle(TableStyle(st + list(extra)))
    return t

def band(goal_num, g, sub):
    bg, fg = GOAL_COLORS[g]
    hx = fg.hexval().replace("0x", "#")
    t = Table([[P(f'<font color="{hx}">Goal {goal_num} \u00b7 {E(g)}</font>', BAND)], [P(f'<font color="{hx}">{E(sub)}</font>', BAND_Q)]], colWidths=[W])
    t.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), bg), ("LEFTPADDING", (0, 0), (-1, -1), 12), ("RIGHTPADDING", (0, 0), (-1, -1), 12),
                           ("TOPPADDING", (0, 0), (0, 0), 10), ("BOTTOMPADDING", (0, 0), (0, 0), 1), ("TOPPADDING", (0, 1), (0, 1), 0), ("BOTTOMPADDING", (0, 1), (0, 1), 10)]))
    return t

def footer(title):
    def draw(c, doc):
        c.saveState()
        c.setFillColor(TEAL_DARK); c.rect(0, 0, letter[0], 0.55 * inch, fill=1, stroke=0)
        lh = 0.3 * inch; c.drawImage(str(LOGO), 0.7 * inch, 0.13 * inch, width=lh * 470 / 165, height=lh, mask="auto")
        c.setFont("Inter", 8.5); c.setFillColor(colors.HexColor("#CFE3E1"))
        c.drawCentredString(letter[0] / 2, 0.22 * inch, title)
        c.drawRightString(letter[0] - 0.7 * inch, 0.22 * inch, f"Page {doc.page}")
        c.setFillColor(TEAL); c.rect(0, letter[1] - 0.12 * inch, letter[0], 0.12 * inch, fill=1, stroke=0)
        c.restoreState()
    return draw

def doc(path, title):
    return SimpleDocTemplate(str(path), pagesize=letter, leftMargin=0.75 * inch, rightMargin=0.75 * inch, topMargin=0.75 * inch, bottomMargin=0.9 * inch, title=title)

W = letter[0] - 1.5 * inch

def church_pdf(path, name, sel, B, L):
    s = []
    s.append(P("Survey Review", H1))
    s.append(P(E(name), SUBT))
    s.append(P(E(f"{sel['n']} people took part. Strengths and opportunities compare our results with each other, so every church has both. Results for a stage or group appear only when it has at least 10 people." + (" Page references point to our full church report." if B.PAGES else "")), SMALL))
    s.append(P("What did we discover about ourselves?", H2))
    data = [[P("What we see", HEAD), P("Questions to consider", HEAD)]]
    for a in sel["about"]:
        data.append([P(E(B.with_page(a["obs"], L.ABOUT_PAGE.get(a["key"]))), CELL), P(E(a["q"]), ParagraphStyle("q", parent=CELL, textColor=TEAL_DARK))])
    s.append(table(data, [W * .5, W * .5], head_bg=[TEAL_DARK, TEAL]))
    first = True
    withheld = sel.get("goal_tables_withheld")
    if withheld:
        note = Table([[P(E("Fewer than 10 people in the Believing, Trusting and Jesus Centered stages answered all 63 statements, so strengths and opportunities by Goal are not shown, to protect confidentiality. Our full church report shows the overall results."), BODY)]], colWidths=[W])
        note.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), SURFACE), ("LINEBEFORE", (0, 0), (0, -1), 4, CORAL),
                                  ("LEFTPADDING", (0, 0), (-1, -1), 14), ("RIGHTPADDING", (0, 0), (-1, -1), 14), ("TOPPADDING", (0, 0), (-1, -1), 12), ("BOTTOMPADDING", (0, 0), (-1, -1), 12)]))
        s.append(KeepTogether([P("What did we learn about our journey together in becoming more like Jesus?", H2), note]))
    for gn, (g, sub) in enumerate(L.GOALS.items() if not withheld else [], 1):
        st, op = B.goal_cells(sel, g)
        hs = ParagraphStyle("hs", parent=HEAD, textColor=TEAL_DARK); ho = ParagraphStyle("ho", parent=HEAD, textColor=CORAL_DARK)
        t = table([[P("Strengths to Celebrate", hs), P("Opportunities to Investigate", ho)], [bullets(st), bullets(op)]], [W * .5, W * .5],
                  head_bg=[TINT_S, TINT_O], pad=11, extra=[("BACKGROUND", (0, 1), (-1, -1), colors.white), ("LINEAFTER", (0, 0), (0, -1), 0.6, LINE)])
        blk = ([P("What did we learn about our journey together in becoming more like Jesus?", H2)] if first else [Spacer(1, 16)]) + [band(gn, g, sub), t]
        s.append(KeepTogether(blk)); first = False
    allS, allO, qs = B.summary_lists(sel)
    sm = None if withheld else table([[P("Our greatest strengths", HEAD), P("Our greatest opportunities", HEAD), P("Questions for our conversation", HEAD)],
                [bullets([t for _, t, _ in allS], CELL), bullets([t for _, t, _ in allO], CELL), bullets(qs, CELL)]], [W / 3] * 3,
               head_bg=[TEAL, CORAL, OLIVE], pad=10, extra=[("BACKGROUND", (0, 1), (-1, -1), colors.white), ("LINEAFTER", (0, 0), (1, -1), 0.6, LINE)])
    if sm is not None:
        s.append(KeepTogether([P("Summary thoughts", H2), sm]))
    NUM = ParagraphStyle("num", parent=BODY, leftIndent=18, firstLineIndent=-18, spaceAfter=7)
    SUB = ParagraphStyle("sub", parent=BODY, leftIndent=34, firstLineIndent=-12, spaceAfter=4)
    wn = []
    for i, x in enumerate(L.WHERE_NEXT, 1):
        num = f'<font name="Inter-SemiBold" color="#20808D">{i}.</font>&nbsp;&nbsp;&nbsp;'
        if isinstance(x, tuple):
            wn.append(P(num + E(x[0]), NUM))
            for b in x[1]: wn.append(P('<font color="#20808D">\u2013</font>&nbsp;&nbsp;' + E(b), SUB))
        else: wn.append(P(num + E(x), NUM))
    box = Table([[wn]], colWidths=[W])
    box.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), SURFACE), ("LINEBEFORE", (0, 0), (0, -1), 4, TEAL),
                             ("LEFTPADDING", (0, 0), (-1, -1), 16), ("RIGHTPADDING", (0, 0), (-1, -1), 14), ("TOPPADDING", (0, 0), (-1, -1), 12), ("BOTTOMPADDING", (0, 0), (-1, -1), 8)]))
    wn_box = box
    missing = [B.STAGE_NAMES[x] for x in (3, 4, 5) if sel["stage_counts"][x] < B.MIN_N]
    note = f" Our {' and '.join(missing)} group{'s are' if len(missing) > 1 else ' is'} too small to show separately." if missing else ""
    s.append(KeepTogether([P("Where do we go from here?", H2), wn_box, Spacer(1, 14), P(E("" if withheld else f"How to read this: strengths and opportunities are based on the {sel['n_full']} people in the Believing, Trusting and Jesus Centered stages, who answered all 63 statements. Beliefs are compared with beliefs and practices with practices, because beliefs always run ahead of practice.{note}"), SMALL), Spacer(1, 6), P(E(SURVEY_COPYRIGHT), SMALL)]))
    d = doc(path, f"{name}: Survey Review"); d.build(s, onFirstPage=footer(f"{name}  \u2022  Survey Review"), onLaterPages=footer(f"{name}  \u2022  Survey Review"))

def facilitator_pdf(path, name, rows, sel, B, L):
    full = [r for r in rows if r["stage"] >= 3 and r.get("full_form", True)]
    s = [P("Facilitator's Report", H1), P(E(name), SUBT),
         P(E("This report mirrors the church's Survey Review line by line. For each line it shows what it is based on, the key numbers and the page in the full church report where the church can see the same data." if B.PAGES else "This report mirrors the church's Survey Review line by line. For each line it shows what it is based on and the key numbers. This church received the combined short-form and full-survey report, so there are no page references."), BODY), Spacer(1, 4),
         P(E("Reading the numbers: the full church report shows the percentage answering Always or Most of the time true, by stage, and so does this report. Lines were chosen by comparing each statement's average score (1–5) with the church's average for statements of the same kind."), SMALL), Spacer(1, 6)]
    sc = sel["stage_counts"]
    s.append(table([[P(h, HEAD_S) for h in ["Who took part", "Distant", "Exploring", "Believing", "Trusting", "Jesus Centered", "Total"]],
                    [P("People", CELL_S)] + [P(str(sc[x]), CELL_S) for x in range(1, 6)] + [P(str(sel["n"]), CELL_S)]], [W * .22] + [W * .13] * 6))
    missing = [B.STAGE_NAMES[x] for x in (3, 4, 5) if sc[x] < B.MIN_N]
    if missing: s.append(P(E(f"Stage comparisons leave out the {' and '.join(missing)} group (fewer than 10 people)."), SMALL))
    s.append(P("What did we discover about ourselves?", H2))
    data = [[P(h, HEAD_S) for h in ["Line in the church report", "Numbers", "Full report"]]]
    for a in sel["about"]:
        nums = B.about_numbers(a["key"], rows, sel) or "Stage-matched comparison; passes the strict chance check. Not shown in the full report."
        pg = L.ABOUT_PAGE.get(a["key"]) if B.PAGES else None
        data.append([P(E(a["obs"]), CELL_S), P(E(nums), CELL_S), P("p. " + pg if pg else "Not shown", CELL_S)])
    s.append(table(data, [W * .44, W * .42, W * .14], HEAD_S))
    for gi, g in enumerate(L.GOALS):
        G = sel["goals"][g]
        blk = ([P("What did we learn about our journey together?", H2)] if gi == 0 else []) + [Spacer(1, 6), band(gi + 1, g, f"Full report pages {L.GOAL_PAGE[g] - 3}–{L.GOAL_PAGE[g]}" if B.PAGES else L.GOALS[g]), Spacer(1, 6)]
        if sel["greatest_strength"] == g or sel["greatest_opportunity"] == g:
            lab = "greatest strength" if sel["greatest_strength"] == g else "greatest opportunity"
            blk.append(P(E(f"Marked as our {lab}: this Goal's practices average {G['standing']:+.2f} compared with all our practices{f" (Goal chart, p. {L.GOAL_PAGE[g]})" if B.PAGES else ""}."), SMALL))
        data = [[P(h, HEAD_S) for h in ["", "Line", "Based on", "Numbers", "Page"]]]
        for side, lst in (("Strength", G["strengths"]), ("Opportunity", G["opportunities"])):
            for _, t, src in lst:
                based, nums = B.evidence(src, sel, full)
                data.append([P(side, CELL_S), P(E(t), CELL_S), P(E(based), CELL_S), P(E(nums), CELL_S), P(str(L.PATHWAY_PAGE[B.src_pathway(src)]) if B.PAGES else "–", CELL_S)])
        blk.append(table(data, [W * .14, W * .23, W * .19, W * .36, W * .08], HEAD_S, pad=7))
        if G["not_shown"]: blk.append(P(E("Also qualified but not shown (limit of 4 per cell): " + "; ".join(t for _, t, _ in G["not_shown"])), SMALL))
        s.append(KeepTogether(blk))
    s.append(KeepTogether([P("Summary thoughts and next steps", H2),
             P(E("Summary thoughts repeat the strongest four lines from each side above, so no new data is needed. “Where do we go from here?” is the same for every church."), BODY)]))
    s.append(KeepTogether([P("Notes for the facilitator", H2), ListFlowable([ListItem(P(E(t)), leftIndent=12) for t in [
        "A line appears only when the difference is clear (at least 0.2 points from the same-kind average, and unlikely to be chance).",
        "Stage lines need at least 10 people in each stage compared. They compare each pathway's rise with this church's typical rise across all 16 pathways.",
        "Group differences in the first table are stage-matched and use a strict whole-screen chance check. With groups of 10 to 15, about 1 report in 20 may still show one chance result, so treat these as questions, not conclusions.",
        "Distant and Exploring respondents answer the 38-statement short form, so the Goal tables use the Believing, Trusting and Jesus Centered stages. The full report also shows an Exploring column."]],
        bulletType="bullet", start="\u2022", leftIndent=12)]))
    d = doc(path, f"{name}: Facilitator's Report"); d.build(s, onFirstPage=footer(f"{name}  \u2022  Facilitator's Report"), onLaterPages=footer(f"{name}  \u2022  Facilitator's Report"))
