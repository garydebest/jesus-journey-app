"""Paired-layout renderer. The shared TypeScript model also drives the admin UI."""
from xml.sax.saxutils import escape
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, CondPageBreak
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.colors import HexColor, white
from reportlab.lib.pagesizes import letter
from reportlab.pdfbase import pdfmetrics


def build_paired_debriefing_pdf(out_path, report):
    # Reuse the established report family fonts, logo and palette.
    from build_debriefing_report import LOGO_PATH, TEAL_DARK, INK, INK_MUTED, BORDER, SURFACE
    pdfmetrics.registerFontFamily("Inter", normal="Inter", bold="Inter-SemiBold")
    model = report["pairedPresentation"]
    width = 504
    styles = {
        "title": ParagraphStyle("pt", fontName="DMSans-Bold", fontSize=22, leading=27, textColor=TEAL_DARK, spaceAfter=10),
        "section": ParagraphStyle("ps", fontName="Inter-SemiBold", fontSize=15, leading=19, textColor=TEAL_DARK, spaceBefore=16, spaceAfter=9, keepWithNext=True),
        "topic": ParagraphStyle("topic", fontName="Inter-SemiBold", fontSize=10.5, leading=14, textColor=TEAL_DARK),
        "body": ParagraphStyle("pb", fontName="Inter", fontSize=10, leading=14, textColor=INK, spaceAfter=5),
        "small": ParagraphStyle("pn", fontName="Inter", fontSize=9, leading=12, textColor=INK_MUTED, spaceAfter=7),
        "table": ParagraphStyle("pc", fontName="Inter", fontSize=9, leading=12, textColor=INK),
        "white": ParagraphStyle("pw", fontName="Inter-SemiBold", fontSize=9, leading=12, textColor=white),
        "strength": ParagraphStyle("ph", fontName="Inter-SemiBold", fontSize=9, leading=12, textColor=TEAL_DARK),
        "opportunity": ParagraphStyle("po", fontName="Inter-SemiBold", fontSize=9, leading=12, textColor=HexColor("#914937")),
    }
    def p(text, style="body"):
        # All narrative and group labels are text, never executable PDF markup.
        return Paragraph(escape(str(text)), styles[style])
    story = [
        p(report.get("churchName", ""), "title"),
        p("Debriefing report • Paired findings", "section"),
        p(f'{report.get("waveLabel", "")} • {report.get("respondentCount", 0)} respondents', "small"),
        p(f'Analysis generated: {str(report.get("generatedAt", ""))[:10]} • Layout: {model["version"]}', "small"),
    ]
    for section in model["sections"]:
        if section["id"].startswith("goal-"):
            story.append(CondPageBreak(180))
        story.append(p(section["title"], "section"))
        if section.get("intro"):
            story.append(p(section["intro"], "small"))
        for topic in section["topics"]:
            available = [(label, key, topic[key]) for label, key in
                         [("STRENGTHS TO CELEBRATE", "strengths"), ("OPPORTUNITIES TO EXPLORE", "opportunities")]
                         if topic[key]]
            if not available:
                continue
            cells = []
            for label, key, findings in available:
                items = []
                for item in findings:
                    items.extend([p(item["headline"], "topic"), Spacer(1, 3), p(item["detail"])])
                    if item.get("directionalOnly"):
                        items.append(p("Directional only · small group", "small"))
                    items.append(Spacer(1, 5))
                cells.append(items)
            columns = len(available)
            title_row = [p(topic["topic"], "topic")] + [""] * (columns - 1)
            headers = [p(label, "strength" if key == "strengths" else "opportunity") for label, key, _ in available]
            t = Table([title_row, headers, cells], colWidths=[width / columns] * columns,
                      repeatRows=2, splitByRow=1, splitInRow=1, hAlign="LEFT")
            commands = [
                ("SPAN", (0, 0), (-1, 0)), ("BACKGROUND", (0, 0), (-1, 0), SURFACE),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 10), ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                ("TOPPADDING", (0, 0), (-1, -1), 5), ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ("LINEBELOW", (0, -1), (-1, -1), .5, BORDER),
            ]
            if columns == 2:
                commands.append(("LINEAFTER", (0, 1), (0, -1), .5, BORDER))
            t.setStyle(TableStyle(commands))
            story.extend([t, Spacer(1, 9)])
        for table in section["tables"]:
            if not table["rows"]:
                continue
            story.append(p(table["title"], "section"))
            columns = len(table["headers"])
            first_width = 178 if columns >= 6 else 250 if columns <= 4 else 166
            widths = [first_width] + [(width - first_width) / (columns - 1)] * (columns - 1)
            cells = [[p(h, "white") for h in table["headers"]]]
            cells += [[p(x, "table") for x in row] for row in table["rows"]]
            t = Table(cells, colWidths=widths, repeatRows=1, splitInRow=1, hAlign="LEFT")
            t.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), TEAL_DARK),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [white, SURFACE]),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 6), ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 5), ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]))
            story.extend([t, Spacer(1, 10)])
        for note in section["notes"]:
            story.append(p(note, "small"))
    story.append(p("Data notes and caveats", "section"))
    story.extend(p(note, "small") for note in model["notes"])

    def chrome(c, doc):
        c.saveState()
        c.setFillColor(TEAL_DARK)
        c.rect(0, 748, 612, 44, fill=1, stroke=0)
        c.drawImage(LOGO_PATH, 54, 758, width=72, height=25.3, mask="auto")
        c.setFont("Inter-SemiBold", 9)
        c.setFillColor(white)
        c.drawRightString(558, 765, "JESUS JOURNEY / DEBRIEFING")
        c.setStrokeColor(BORDER)
        c.line(54, 43, 558, 43)
        c.setFillColor(INK_MUTED)
        c.setFont("Inter", 8)
        c.drawString(54, 29, "ADMIN ONLY • INTERNAL USE")
        c.drawRightString(558, 29, str(doc.page))
        c.restoreState()
    doc = SimpleDocTemplate(
        out_path, pagesize=letter, leftMargin=54, rightMargin=54, topMargin=62, bottomMargin=55,
        title=f'Debriefing Report | {report.get("churchName", "")}',
        author="Perplexity Computer", subject="Admin-only paired strengths and opportunities",
    )
    doc.build(story, onFirstPage=chrome, onLaterPages=chrome)
    return True
