"""
build_comments_report.py -- standalone PDF renderer for the Journey Survey
Comments Report. Reuses the same visual chrome (fonts, palette, cover photo,
footer/header) as build_full_report.py so the two reports feel like a set,
but is a fully separate document: verbatim written comments grouped by
spiritual-maturity band, each tagged only by gender.

Mirrors the structure confirmed from the original 2019 sample
(Sample-Church-Comments-Report-2019): cover page, an "interpreting this
report" page, then comment pages grouped under colored maturity-band
section headers with MALE/FEMALE tags.
"""
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib.colors import HexColor
from reportlab.pdfgen import canvas
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase import pdfmetrics
from reportlab.lib.utils import ImageReader

import os

_SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
FONT_DIR = os.path.join(_SCRIPT_DIR, "fonts")
_STATIC_ASSET_DIR = os.path.join(_SCRIPT_DIR, "assets")

# ---- Register fonts (idempotent: reportlab ignores duplicate registration) ----
pdfmetrics.registerFont(TTFont("Inter", f"{FONT_DIR}/Inter-Regular.ttf"))
pdfmetrics.registerFont(TTFont("Inter-Medium", f"{FONT_DIR}/Inter-Medium.ttf"))
pdfmetrics.registerFont(TTFont("Inter-SemiBold", f"{FONT_DIR}/Inter-SemiBold.ttf"))
pdfmetrics.registerFont(TTFont("Inter-Bold", f"{FONT_DIR}/Inter-Bold.ttf"))
pdfmetrics.registerFont(TTFont("DMSans", f"{FONT_DIR}/DMSans-Regular.ttf"))
pdfmetrics.registerFont(TTFont("DMSans-Bold", f"{FONT_DIR}/DMSans-Bold.ttf"))

# ---- Palette (matches build_full_report.py) ----
INK = HexColor("#1E2B2C")
INK_MUTED = HexColor("#5B6B6B")
PAPER = HexColor("#FFFFFF")
SURFACE = HexColor("#F4F7F6")
BORDER = HexColor("#E1E7E6")
TEAL_DARK = HexColor("#1B474D")
TEAL = HexColor("#20808D")
TEAL_LIGHT = HexColor("#BCE2E7")

PAGE_W, PAGE_H = letter
MARGIN = 0.75 * inch

LOGO_PATH = f"{_STATIC_ASSET_DIR}/jj_logo.png"
COVER_PHOTO = f"{_STATIC_ASSET_DIR}/cover_map_photo.png"

QUESTION_TEXT = "How would you like your local church to help you walk closer to Jesus?"


# ============================================================
# Shared chrome (mirrors build_full_report.py)
# ============================================================

def draw_footer(c, page_num, church_name, report_date):
    c.saveState()
    c.setFillColor(TEAL_DARK)
    c.rect(0, 0, PAGE_W, 0.62 * inch, fill=1, stroke=0)

    logo_h = 0.34 * inch
    logo_w = logo_h * (470 / 165)
    lx, ly = MARGIN, (0.62 * inch - logo_h) / 2 + 0.09 * inch
    c.drawImage(LOGO_PATH, lx, ly, width=logo_w, height=logo_h, mask="auto")
    c.setFont("Inter-SemiBold", 7.6)
    c.setFillColor(HexColor("#FFFFFF"))
    c.drawString(lx + 0.02 * inch, ly - 0.135 * inch, "J E S U S   J O U R N E Y")

    c.setFont("Inter", 9)
    c.setFillColor(HexColor("#CFE3E1"))
    c.drawCentredString(PAGE_W / 2, 0.24 * inch, f"{church_name}  \u2022  {report_date}")

    c.setFont("Inter-Medium", 9)
    c.drawRightString(PAGE_W - MARGIN, 0.24 * inch, f"pg {page_num}")
    c.restoreState()


def draw_header(c, kicker, title, title_size=25):
    y = PAGE_H - MARGIN
    c.setFillColor(TEAL)
    c.setFont("Inter-SemiBold", 10.5)
    c.drawString(MARGIN, y - 2, kicker.upper())
    c.setStrokeColor(TEAL)
    c.setLineWidth(1.4)
    c.line(MARGIN, y - 10, MARGIN + 0.34 * inch, y - 10)

    c.setFillColor(INK)
    c.setFont("DMSans-Bold", title_size)
    lines = title.split("\n")
    ty = y - 40
    for ln in lines:
        c.drawString(MARGIN, ty, ln)
        ty -= title_size * 1.15


def new_page(c, page_num, kicker, title, church_name, report_date, title_size=25):
    draw_header(c, kicker, title, title_size)
    draw_footer(c, page_num, church_name, report_date)


def wrapped_lines(c, text, font, size, max_width):
    c.setFont(font, size)
    words = text.split()
    lines, cur = [], ""
    for w in words:
        trial = (cur + " " + w).strip()
        if c.stringWidth(trial, font, size) <= max_width:
            cur = trial
        else:
            lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


def draw_body_paragraph(c, x, y, text, max_width, size=10.5, leading=15, color=INK_MUTED, font="Inter"):
    lines = wrapped_lines(c, text, font, size, max_width)
    c.setFont(font, size)
    c.setFillColor(color)
    for line in lines:
        c.drawString(x, y, line)
        y -= leading
    return y


def draw_bullet_block(c, x, y, items, max_width, bullet_color=TEAL, size=10.3, leading=14.5, gap=8):
    for text in items:
        c.setFillColor(bullet_color)
        c.circle(x + 0.035 * inch, y + 3.2, 2.1, fill=1, stroke=0)
        tx = x + 0.2 * inch
        tw = max_width - 0.2 * inch
        lines = wrapped_lines(c, text, "Inter", size, tw)
        c.setFont("Inter", size)
        c.setFillColor(INK_MUTED)
        yy = y
        for ln in lines:
            c.drawString(tx, yy, ln)
            yy -= leading
        y = yy - gap
    return y


# ============================================================
# Cover + interpreting page
# ============================================================

def page_cover(c, church_name, report_date):
    img = ImageReader(COVER_PHOTO)
    iw, ih = img.getSize()
    target_ratio = PAGE_W / PAGE_H
    img_ratio = iw / ih
    if img_ratio > target_ratio:
        draw_h = PAGE_H
        draw_w = draw_h * img_ratio
        draw_x = (PAGE_W - draw_w) / 2
        draw_y = 0
    else:
        draw_w = PAGE_W
        draw_h = draw_w / img_ratio
        draw_x = 0
        draw_y = PAGE_H - draw_h
    c.drawImage(COVER_PHOTO, draw_x, draw_y, width=draw_w, height=draw_h)

    scrim_h = 3.1 * inch
    steps = 40
    for i in range(steps):
        frac = i / steps
        alpha = 0.72 * (frac ** 1.4)
        c.saveState()
        c.setFillColor(HexColor("#0C1E1F"), alpha=alpha)
        c.rect(0, scrim_h * (1 - (i + 1) / steps), PAGE_W, scrim_h / steps + 1, fill=1, stroke=0)
        c.restoreState()

    c.setFillColor(HexColor("#FFFFFF"))
    c.setFont("DMSans-Bold", 34)
    c.drawCentredString(PAGE_W / 2, 1.95 * inch, "Comments")
    c.setFont("Inter", 15)
    c.setFillColor(HexColor("#E7F1EF"))
    c.drawCentredString(PAGE_W / 2, 1.55 * inch, f"From the Jesus Journey Survey: {church_name}")
    c.setFont("Inter-Medium", 12.5)
    c.setFillColor(TEAL_LIGHT)
    c.drawCentredString(PAGE_W / 2, 1.22 * inch, report_date)

    c.setFillColor(TEAL_DARK)
    c.rect(0, 0, PAGE_W, 0.62 * inch, fill=1, stroke=0)
    logo_h = 0.34 * inch
    logo_w = logo_h * (470 / 165)
    lx, ly = MARGIN, (0.62 * inch - logo_h) / 2 + 0.09 * inch
    c.drawImage(LOGO_PATH, lx, ly, width=logo_w, height=logo_h, mask="auto")
    c.setFont("Inter-SemiBold", 7.6)
    c.setFillColor(HexColor("#FFFFFF"))
    c.drawString(lx + 0.02 * inch, ly - 0.135 * inch, "J E S U S   J O U R N E Y")


def page_interpreting(c, church_name, report_date):
    new_page(c, 2, "Interpreting Your Comments Report", "Interpreting Your Journey\nSurvey Comments Report",
              church_name, report_date, title_size=22)
    y = PAGE_H - MARGIN - 1.7 * inch
    items = [
        f"The written comments in this report come from your people's honest answers to this "
        f"question at the end of the Journey survey: \u201c{QUESTION_TEXT}\u201d They answered this "
        "question after spending thoughtful time reflecting on their daily life with God when "
        "taking the survey. So this is not a response to an off-the-wall question; it is likely "
        "to be a heart-felt request for honest help.",
        "Take your time in reading this Comments report. It is easy to scan quickly and look "
        "for those very positive or very negative comments. Instead, start by first praying for "
        "spiritual eyes to read and hear from the people in your community, many who may never "
        "have felt comfortable in another setting telling you what they are thinking or hoping.",
        "The comments are organized according to the level of spiritual maturity. Look first for "
        "differences in comments between people at different levels of maturity in their walks "
        "with God. What is each group asking for? Are there some common issues, concerns, and "
        "desires among those who are Exploring God, compared to those who are Believing, "
        "Trusting, or Centered in God? What are they hoping the church might do to help them grow?",
        "Women and men may see the role of the church differently in helping them grow "
        "spiritually. Take a careful look just at the comments from the women, for example. What "
        "are women's perspectives about the church and their own desires to grow? Next, do the "
        "same with the answers from men \u2014 what are they asking for, and what themes emerge?",
        "Together, these comments tell an important story, one that complements the more "
        "numbers-oriented Journey Survey report. Listen and read with the eyes and heart of Jesus.",
    ]
    y = draw_bullet_block(c, MARGIN, y, items, PAGE_W - 2 * MARGIN, size=10.3, leading=14, gap=11)

    card_y = 0.95 * inch
    card_h = 0.85 * inch
    c.setFillColor(SURFACE)
    c.roundRect(MARGIN, card_y, PAGE_W - 2 * MARGIN, card_h, 6, fill=1, stroke=0)
    c.setStrokeColor(TEAL)
    c.setLineWidth(2.4)
    c.line(MARGIN, card_y, MARGIN, card_y + card_h)
    c.setFont("Inter", 10.5)
    c.setFillColor(TEAL_DARK)
    c.drawCentredString(PAGE_W / 2, card_y + card_h - 0.32 * inch,
                         "\u201cListen to advice and accept instruction,")
    c.drawCentredString(PAGE_W / 2, card_y + card_h - 0.55 * inch,
                         "that you may gain wisdom in the future.\u201d")
    c.setFont("Inter-Medium", 9.5)
    c.drawCentredString(PAGE_W / 2, card_y + 0.16 * inch, "Proverbs 19:20 (NASB)")


# ============================================================
# Comment pages (flowing, paginated dynamically)
# ============================================================

SECTION_HEADER_H = 0.34 * inch
GENDER_COL_W = 0.85 * inch
ROW_GAP = 6
GENDER_GAP = 9


def _wrap_for_width(c, text, font, size, max_width):
    lines = wrapped_lines(c, text, font, size, max_width)
    return lines if lines else [""]


def render_comment_pages(c, groups, church_name, report_date, start_page_num):
    """groups: OrderedDict[label -> list[{"gender": str, "comment": str}]].
    Flows section headers + gender-tagged comments down the page, starting a
    new page (with header/footer chrome) whenever content would overflow.
    Returns the next page number after the last comments page."""
    page_num = start_page_num
    content_top = PAGE_H - MARGIN - 1.45 * inch
    content_bottom = 0.85 * inch
    text_x = MARGIN + GENDER_COL_W
    text_w = PAGE_W - 2 * MARGIN - GENDER_COL_W
    body_font, body_size, body_leading = "Inter", 10, 13.5

    def start_new_page():
        nonlocal page_num
        new_page(c, page_num, "Comments", "Comments From Your Journey Survey", church_name, report_date, title_size=18)
        c.setFont("Inter-Medium", 9.5)
        c.setFillColor(INK_MUTED)
        q_lines = wrapped_lines(c, f"Q:  {QUESTION_TEXT}", "Inter-Medium", 9.5, PAGE_W - 2 * MARGIN)
        qy = PAGE_H - MARGIN - 1.05 * inch
        for ln in q_lines:
            c.drawString(MARGIN, qy, ln)
            qy -= 0.16 * inch
        page_num += 1
        return content_top

    y = start_new_page()

    for label, entries in groups.items():
        header_block_h = SECTION_HEADER_H + 0.08 * inch
        if y - header_block_h < content_bottom:
            c.showPage()
            y = start_new_page()

        c.setFillColor(TEAL_LIGHT)
        c.rect(MARGIN, y - SECTION_HEADER_H + 6, PAGE_W - 2 * MARGIN, SECTION_HEADER_H, fill=1, stroke=0)
        c.setFillColor(TEAL_DARK)
        c.setFont("Inter-SemiBold", 11.5)
        c.drawString(MARGIN + 0.12 * inch, y - SECTION_HEADER_H + 6 + 0.1 * inch, label)
        y -= header_block_h + 0.06 * inch

        for entry in entries:
            gender = (entry.get("gender") or "Unknown").upper()
            comment = entry.get("comment") or ""
            lines = _wrap_for_width(c, comment, body_font, body_size, text_w)
            row_h = len(lines) * body_leading

            if y - row_h < content_bottom:
                c.setStrokeColor(BORDER)
                c.setLineWidth(0.5)
                c.line(MARGIN, content_bottom - 4, PAGE_W - MARGIN, content_bottom - 4)
                c.showPage()
                y = start_new_page()

            c.setFont("Inter-SemiBold", 8.6)
            c.setFillColor(INK_MUTED)
            c.drawString(MARGIN, y, gender)

            c.setFont(body_font, body_size)
            c.setFillColor(INK)
            yy = y
            for ln in lines:
                c.drawString(text_x, yy, ln)
                yy -= body_leading
            y = yy - ROW_GAP

        y -= GENDER_GAP

    return page_num


# ============================================================
# Entry point
# ============================================================

def build_comments_report_pdf(out_path: str, church_name: str, report_date: str, comments_data: dict):
    """comments_data: the dict returned by church_profile_report.comments_report(rows),
    i.e. {"by_maturity_group": OrderedDict[label -> [{"gender","comment"}, ...]], ...}.

    Returns True if a PDF was written (there was at least one comment), False if
    there were no comments to report (caller should skip generating this file)."""
    groups = comments_data.get("by_maturity_group") or {}
    total_comments = sum(len(v) for v in groups.values())
    if total_comments == 0:
        return False

    c = canvas.Canvas(out_path, pagesize=letter)
    c.setTitle(f"Comments Report — {church_name}")
    c.setAuthor("Jesus Journey Survey")

    page_cover(c, church_name, report_date)
    c.showPage()

    page_interpreting(c, church_name, report_date)
    c.showPage()

    render_comment_pages(c, groups, church_name, report_date, start_page_num=3)

    c.save()
    return True
