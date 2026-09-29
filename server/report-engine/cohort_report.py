"""Mixed-wave report rendering from the already privacy-filtered TS contract.

Never re-score, merge versions, reconstruct suppressed cells, or attach comments
to a journey stage, demographic, row ID or timestamp. Full-only church reports
continue using the established full report renderer.
"""
import re
from xml.sax.saxutils import escape
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.colors import white
from reportlab.lib.pagesizes import letter

PRIVACY_MESSAGE = "Insufficient responses to protect confidentiality"


def styles():
    from build_comments_report import TEAL_DARK, INK, INK_MUTED
    return {
        "title": ParagraphStyle("ctitle", fontName="DMSans-Bold", fontSize=22, leading=27, textColor=TEAL_DARK, spaceAfter=16),
        "heading": ParagraphStyle("cheading", fontName="Inter-SemiBold", fontSize=14, leading=18, textColor=TEAL_DARK, spaceBefore=16, spaceAfter=9, keepWithNext=True),
        "body": ParagraphStyle("cbody", fontName="Inter", fontSize=10, leading=15, textColor=INK, spaceAfter=8),
        "muted": ParagraphStyle("cmuted", fontName="Inter", fontSize=9, leading=13, textColor=INK_MUTED, spaceAfter=8),
        "white": ParagraphStyle("cwhite", fontName="Inter-SemiBold", fontSize=10, leading=14, textColor=white),
    }


def cohort_story(report, include_profiles=True):
    from build_comments_report import TEAL_DARK, SURFACE, BORDER
    s = styles()
    def p(text, kind="body"):
        return Paragraph(escape(str(text)), s[kind])
    story = [p(report["note"])]
    if report.get("dataQualityNote"):
        story.append(p(report["dataQualityNote"], "muted"))
    for cohort in report["cohorts"]:
        story.append(p(cohort["label"], "heading"))
        if cohort["suppressed"]:
            story.append(p(PRIVACY_MESSAGE, "muted"))
            continue
        story.append(p(f'{cohort["respondentCount"]} respondents. Percentage answering 4 or 5.', "muted"))
        if cohort["variant"] != "full":
            story.append(p("Fifteen pathways are measured. My Identity is not measured in this survey version. Single-item pathways reflect a narrower measure.", "muted"))
        for pathway in cohort["pathways"]:
            suffix = " (single item)" if pathway["measurement"] == "single_item" else ""
            story.append(p(f'Pathway {pathway["num"]}: {pathway["name"]}{suffix}', "heading"))
            cells = [[p("Full-survey statement" if cohort["variant"] == "full" else "Short-form statement", "white"), p("4 or 5", "white")]]
            cells += [[p(item["text"]), p(f'{item["agreementPct"]:g}%')] for item in pathway["items"]]
            table = Table(cells, colWidths=[438, 66], repeatRows=1, splitInRow=1, hAlign="LEFT")
            table.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), TEAL_DARK),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [white, SURFACE]),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 7),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ("LINEBELOW", (0, -1), (-1, -1), .5, BORDER),
            ]))
            story.extend([table, Spacer(1, 8)])
    if include_profiles:
        story.extend([PageBreak(), p("Combined journey and demographic profiles", "heading")])
        for name, distribution in report["profiles"].items():
            if distribution.get("note"):
                story.append(p(distribution["note"], "muted"))
            story.append(p(name, "heading"))
            if distribution["suppressed"]:
                story.append(p(PRIVACY_MESSAGE, "muted"))
            elif not distribution["values"]:
                story.append(p("No reportable responses.", "muted"))
            else:
                for value in distribution["values"]:
                    story.append(p(f'{value["label"]}: {value["count"]} ({value["pct"]:g}%)'))
    return story


def build_document(out_path, title, church_name, report_date, story):
    from build_comments_report import draw_footer, LOGO_PATH, TEAL_DARK
    s = styles()
    heading = [Paragraph(escape(title), s["title"]), Paragraph(escape(church_name), s["heading"]), Paragraph(escape(report_date), s["muted"])]
    def chrome(canvas, doc):
        draw_footer(canvas, doc.page, church_name, report_date)
    SimpleDocTemplate(out_path, pagesize=letter, leftMargin=54, rightMargin=54,
                      topMargin=54, bottomMargin=66, title=title,
                      author="Jesus Journey").build(heading + story, onFirstPage=chrome, onLaterPages=chrome)


def build_cohort_report(out_path, church_name, report_date, report):
    build_document(out_path, "Our Journey with Jesus", church_name, report_date, cohort_story(report))


def redact_comment(text):
    # Deliberately conservative: withhold the entire comment when obvious direct
    # identifiers are present, rather than guessing what context is identifying.
    identifiers = [
        r"\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b", r"https?://\S+", r"\bwww\.\S+",
        r"(?:\+?\d[\d ().-]{7,}\d)", r"\b(?:my name is|I am called|I'm called)\b",
        r"\b(?:I am|I'm)\s+[A-Z][a-z]+\s+[A-Z][a-z]+\b",
        r"\b(?:I am|I'm)\s+[A-Z][a-z]+(?=[,.!]|$)",
        r"\b\d+\s+\w+(?:\s+\w+)?\s+(?:Street|Road|Avenue|Drive|Lane|St|Rd|Ave)\b",
    ]
    if any(re.search(pattern, text, re.I if "my name" in pattern else 0) for pattern in identifiers):
        return None
    return text.strip()


def build_private_comments(out_path, church_name, report_date, rows, had_comments=False):
    """A separate, unlinked report. Never export original row order or labels."""
    original = [str(row.get("comment_text") or "").strip() for row in rows if str(row.get("comment_text") or "").strip()]
    if not original and not had_comments:
        return False
    approved = [redact_comment(text) for text in original]
    approved = sorted(text for text in approved if text)
    s = styles()
    story = [Paragraph("Comments are presented without journey-stage or demographic labels. Obvious identifying content is withheld. Written accounts may still contain recognizable context; handle this report confidentially.", s["body"])]
    # The reporting pool is the set of usable comment authors, not total survey n.
    if len(approved) < 5:
        story.append(Paragraph(PRIVACY_MESSAGE, s["body"]))
    else:
        for text in approved:
            story.append(Paragraph(escape(text), s["body"]))
            story.append(Spacer(1, 10))
    build_document(out_path, "Comments", church_name, report_date, story)
    return True
