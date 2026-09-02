"""
Full Jesus Journey Church Report — redesigned visual template.
Uses Canyon View Vineyard Church's real 10/15/2017 data throughout as example content.
Extends the approved 2-page mockup's design system across all 38 report pages.
"""
from PIL import Image
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.font_manager as fm

from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib.colors import HexColor
from reportlab.pdfgen import canvas
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase import pdfmetrics
from reportlab.lib.utils import ImageReader

import os
import tempfile

from report_data import ReportData, CANYON_VIEW_2017

# Resolve paths relative to this script's own location so the report engine
# works both in local dev and on a deployed host (Render, etc.) where the
# original hardcoded sandbox path (/home/user/workspace/report_mockup) does
# not exist. Fonts and the static logo/cover photo ship inside this
# directory's checked-in `fonts/` and `assets/` subfolders; generated chart
# PNGs are scratch files written to a temp dir at runtime.
_SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
FONT_DIR = os.path.join(_SCRIPT_DIR, "fonts")
_STATIC_ASSET_DIR = os.path.join(_SCRIPT_DIR, "assets")
ASSET_DIR = tempfile.mkdtemp(prefix="jj-report-assets-")

# The data instance to render. main() may override this via set_report_data().
REPORT_DATA: ReportData = CANYON_VIEW_2017

# ---- Register fonts ----
pdfmetrics.registerFont(TTFont("Inter", f"{FONT_DIR}/Inter-Regular.ttf"))
pdfmetrics.registerFont(TTFont("Inter-Medium", f"{FONT_DIR}/Inter-Medium.ttf"))
pdfmetrics.registerFont(TTFont("Inter-SemiBold", f"{FONT_DIR}/Inter-SemiBold.ttf"))
pdfmetrics.registerFont(TTFont("Inter-Bold", f"{FONT_DIR}/Inter-Bold.ttf"))
pdfmetrics.registerFont(TTFont("DMSans", f"{FONT_DIR}/DMSans-Regular.ttf"))
pdfmetrics.registerFont(TTFont("DMSans-Bold", f"{FONT_DIR}/DMSans-Bold.ttf"))

for f in ["Inter-Regular.ttf", "Inter-Medium.ttf", "Inter-SemiBold.ttf", "Inter-Bold.ttf",
          "DMSans-Regular.ttf", "DMSans-Bold.ttf"]:
    fm.fontManager.addfont(f"{FONT_DIR}/{f}")

# ---- Palette ----
INK = HexColor("#1E2B2C")
INK_MUTED = HexColor("#5B6B6B")
PAPER = HexColor("#FFFFFF")
SURFACE = HexColor("#F4F7F6")
BORDER = HexColor("#E1E7E6")
TEAL_DARK = HexColor("#1B474D")
TEAL = HexColor("#20808D")
TEAL_LIGHT = HexColor("#BCE2E7")
CORAL = HexColor("#D97B66")
SAND = HexColor("#D8CBB0")
OLIVE = HexColor("#848456")

MPL_TEAL_DARK = "#1B474D"
MPL_TEAL = "#20808D"
MPL_TEAL_LIGHT = "#BCE2E7"
MPL_CORAL = "#D97B66"
MPL_SAND = "#D8CBB0"
MPL_INK_MUTED = "#5B6B6B"

PAGE_W, PAGE_H = letter
MARGIN = 0.75 * inch

CHURCH_NAME = REPORT_DATA.church_name
REPORT_DATE = REPORT_DATA.report_date


def set_report_data(data: ReportData):
    """Swap the active REPORT_DATA before calling main(). Also refreshes the
    CHURCH_NAME/REPORT_DATE module-level aliases used by page_cover/draw_footer."""
    global REPORT_DATA, CHURCH_NAME, REPORT_DATE
    REPORT_DATA = data
    CHURCH_NAME = data.church_name
    REPORT_DATE = data.report_date

LOGO_PATH = f"{_STATIC_ASSET_DIR}/jj_logo.png"
COVER_PHOTO = f"{_STATIC_ASSET_DIR}/cover_map_photo.png"


# ============================================================
# Shared chrome
# ============================================================

def draw_footer(c, page_num):
    c.saveState()
    c.setFillColor(TEAL_DARK)
    c.rect(0, 0, PAGE_W, 0.62 * inch, fill=1, stroke=0)

    # Real JJ logo mark (transparent PNG) + wordmark
    logo_h = 0.34 * inch
    logo_w = logo_h * (470 / 165)
    lx, ly = MARGIN, (0.62 * inch - logo_h) / 2 + 0.09 * inch
    c.drawImage(LOGO_PATH, lx, ly, width=logo_w, height=logo_h, mask="auto")
    c.setFont("Inter-SemiBold", 7.6)
    c.setFillColor(HexColor("#FFFFFF"))
    c.drawString(lx + 0.02 * inch, ly - 0.135 * inch, "J E S U S   J O U R N E Y")

    c.setFont("Inter", 9)
    c.setFillColor(HexColor("#CFE3E1"))
    c.drawCentredString(PAGE_W / 2, 0.24 * inch, f"{CHURCH_NAME}  \u2022  {REPORT_DATE}")

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


def draw_bullet_block(c, x, y, items, max_width, bullet_color=TEAL, size=10.3, leading=14.5,
                       gap=8, bold_lead=None, font="Inter", bold_font="Inter-SemiBold"):
    """items: list of (lead_bold_or_None, text) tuples, drawn with a pin/dot bullet."""
    for lead, text in items:
        c.setFillColor(bullet_color)
        c.circle(x + 0.035 * inch, y + 3.2, 2.1, fill=1, stroke=0)
        tx = x + 0.2 * inch
        tw = max_width - 0.2 * inch
        if lead:
            full = f"{lead} {text}"
        else:
            full = text
        # Render with simple wrap; bold lead handled by drawing lead then continuing (approx: just bold whole first words)
        lines = wrapped_lines(c, full, font, size, tw)
        c.setFont(font, size)
        c.setFillColor(INK_MUTED if not lead else INK)
        yy = y
        for i, ln in enumerate(lines):
            if i == 0 and lead:
                lead_w = c.stringWidth(lead + " ", bold_font, size)
                c.setFont(bold_font, size)
                c.setFillColor(INK)
                c.drawString(tx, yy, lead + " ")
                c.setFont(font, size)
                c.setFillColor(INK_MUTED)
                c.drawString(tx + lead_w, yy, ln[len(lead) + 1:])
            else:
                c.drawString(tx, yy, ln)
            yy -= leading
        y = yy - gap
    return y


def new_page(c, page_num, kicker, title, title_size=25):
    draw_header(c, kicker, title, title_size)
    draw_footer(c, page_num)


# ============================================================
# COVER + TOC
# ============================================================

def page_cover(c):
    img = ImageReader(COVER_PHOTO)
    iw, ih = img.getSize()
    # cover full page with photo, cropping to fill
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

    # Gradient scrim at bottom for legible text
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
    c.drawCentredString(PAGE_W / 2, 1.95 * inch, "Our Journey with Jesus")
    c.setFont("Inter", 17)
    c.setFillColor(HexColor("#E7F1EF"))
    c.drawCentredString(PAGE_W / 2, 1.55 * inch, CHURCH_NAME)
    c.setFont("Inter-Medium", 12.5)
    c.setFillColor(TEAL_LIGHT)
    c.drawCentredString(PAGE_W / 2, 1.22 * inch, REPORT_DATE)

    # Footer band (no page number on cover)
    c.setFillColor(TEAL_DARK)
    c.rect(0, 0, PAGE_W, 0.62 * inch, fill=1, stroke=0)
    logo_h = 0.34 * inch
    logo_w = logo_h * (470 / 165)
    lx, ly = MARGIN, (0.62 * inch - logo_h) / 2 + 0.09 * inch
    c.drawImage(LOGO_PATH, lx, ly, width=logo_w, height=logo_h, mask="auto")
    c.setFont("Inter-SemiBold", 7.6)
    c.setFillColor(HexColor("#FFFFFF"))
    c.drawString(lx + 0.02 * inch, ly - 0.135 * inch, "J E S U S   J O U R N E Y")


def page_toc(c):
    new_page(c, 2, "Contents", "What's Inside This Report")
    y = PAGE_H - MARGIN - 1.05 * inch
    rows = [
        ("03\u201305", "Interpreting Your Journey Report", 0),
        ("06\u201309", "Your Church Profile", 0),
        ("10\u201313", "Your Church Spiritual Maturity Profile", 0),
        ("14\u201316", "Your Church Spiritual Change Profile", 0),
        ("17\u201334", "Your Church Jesus Journey Profile", 0),
        (None, "Jesus Journey Goals and Pathways", 1),
        (None, "Goal #1: Trusting Jesus Pathways", 1),
        (None, "Goal #2: Experiencing Jesus Pathways", 1),
        (None, "Goal #3: Reflecting Jesus Pathways", 1),
        (None, "Goal #4: Serving Jesus Pathways", 1),
        ("35\u201337", "Your Church Summary Profile", 0),
        ("38", "Reflecting on Your Jesus Journey Report", 0),
    ]
    row_h = 0.365 * inch
    for pg, label, indent in rows:
        if pg:
            c.setFont("Inter-SemiBold", 11)
            c.setFillColor(TEAL)
            c.drawString(MARGIN, y, pg)
        if indent:
            c.setFillColor(TEAL_LIGHT)
            c.circle(MARGIN + 1.55 * inch, y + 3.5, 2.6, fill=1, stroke=0)
            c.setFont("Inter", 10.5)
            c.setFillColor(INK_MUTED)
            c.drawString(MARGIN + 1.75 * inch, y, label)
        else:
            c.setFont("Inter-Medium", 12)
            c.setFillColor(INK)
            c.drawString(MARGIN + 1.05 * inch, y, label)
        if not indent and pg:
            c.setStrokeColor(BORDER)
            c.setLineWidth(0.6)
            c.line(MARGIN, y - 0.14 * inch, PAGE_W - MARGIN, y - 0.14 * inch)
        y -= row_h if not indent else row_h * 0.82


# ============================================================
# INTERPRETING YOUR JOURNEY REPORT (pg 3-5)
# ============================================================

def page_interpreting_1(c):
    new_page(c, 3, "Interpreting Your Journey Report", "Purposes of the Jesus\nJourney Survey", title_size=23)
    y = PAGE_H - MARGIN - 1.75 * inch
    items = [
        (None, "Reveal where we and our churches are in our journey to be more like Jesus. "
                "Following Jesus is not a contractual event; it is the beginning of a journey of "
                "invitation, a life-long realization of what life can be when lived fully with God."),
        (None, "Contribute to our awareness of areas in our spiritual life where we are stronger and "
                "less strong. We often grow unevenly in our spiritual journey. Periodically taking stock "
                "of where we are on this path can encourage and help us move together toward the "
                "spiritual health and growth that God's Spirit can enable."),
        (None, "Discover our \u201cgrowing edge,\u201d where God is inviting us toward continued growth and "
                "maturity. This opportunity to become like Jesus in new ways is not the same for every "
                "person: a new follower of Jesus may have different needs than a more mature follower."),
        (None, "Create an opportunity for churches to reflect, pray, and plan together on how best to "
                "grow the spiritual health and maturity of all our people."),
    ]
    y = draw_bullet_block(c, MARGIN, y, items, PAGE_W - 2 * MARGIN, size=10.8, leading=15, gap=14)

    # Scripture callout
    card_y = 1.05 * inch
    card_h = 0.85 * inch
    c.setFillColor(SURFACE)
    c.roundRect(MARGIN, card_y, PAGE_W - 2 * MARGIN, card_h, 6, fill=1, stroke=0)
    c.setStrokeColor(TEAL)
    c.setLineWidth(2.4)
    c.line(MARGIN, card_y, MARGIN, card_y + card_h)
    c.setFont("Inter", 11)
    c.setFillColor(TEAL_DARK)
    c.drawCentredString(PAGE_W / 2, card_y + card_h - 0.32 * inch,
                         "\u201cFor I know the plans I have for you,\u201d declares the Lord,")
    c.drawCentredString(PAGE_W / 2, card_y + card_h - 0.55 * inch,
                         "\u201cplans to prosper you and not to harm you, plans to give you hope and a future.\u201d")
    c.setFont("Inter-Medium", 9.5)
    c.drawCentredString(PAGE_W / 2, card_y + 0.16 * inch, "Jeremiah 29:11 (NIV)")


def page_interpreting_2(c):
    new_page(c, 4, "Interpreting Your Journey Report", "The Jesus Journey\nSurvey Process", title_size=23)
    y = PAGE_H - MARGIN - 1.7 * inch
    c.setFont("Inter-SemiBold", 12)
    c.setFillColor(TEAL_DARK)
    c.drawString(MARGIN, y, "The Survey Development Process")
    y -= 0.28 * inch
    items = [
        (None, "The Journey survey was conducted online; participation was voluntary. The survey "
                "included 6 demographics, 4 church participation indicators, 1 spiritual maturity "
                "indicator, 1 spiritual change indicator, and 63 attributes of spiritual growth on 7 "
                "dimensions \u2014 organized for this report into 4 major goals and 16 pathways."),
        (None, "Survey attributes were developed through extensive prayer and reflection by an invited "
                "group of pastors, theologians, and Christian survey specialists tasked with identifying "
                "the dimensions of spiritual growth evident in maturing followers of Jesus."),
        (None, "The 7 dimensions of spiritual growth included: understanding Jesus' teaching about his "
                "Father, understanding Jesus' central message, experiencing life with God, the inner "
                "effect of life with God, reflecting Jesus' life with others, communicating God's love "
                "and truth, and welcoming God's presence and power."),
        (None, "Draft questions were pretested with multiple church groups in Canada and the U.S., and "
                "substantially revised after each pretest. After the first church survey of over 400 "
                "persons, final questions were submitted to confirmatory factor analysis \u2014 all "
                "attributes across all 7 dimensions were statistically supported with high factor "
                "loadings, strongly supporting the empirical and theological integrity of the Journey."),
    ]
    draw_bullet_block(c, MARGIN, y, items, PAGE_W - 2 * MARGIN, size=10.5, leading=14.5, gap=13)


def page_interpreting_3(c):
    new_page(c, 5, "Interpreting Your Journey Report", "The Jesus Journey Survey\nat Your Church", title_size=23)
    y = PAGE_H - MARGIN - 1.75 * inch

    def stat_row(label, value, y):
        c.setFont("Inter-SemiBold", 11.5)
        c.setFillColor(INK)
        c.drawString(MARGIN, y, label)
        c.setFont("DMSans-Bold", 16)
        c.setFillColor(TEAL)
        c.drawRightString(PAGE_W - MARGIN, y - 0.02 * inch, value)
        c.setStrokeColor(BORDER)
        c.setLineWidth(0.6)
        c.line(MARGIN, y - 0.16 * inch, PAGE_W - MARGIN, y - 0.16 * inch)
        return y - 0.52 * inch

    c.setFont("Inter-SemiBold", 9.6)
    c.setFillColor(TEAL)
    c.drawString(MARGIN, y + 0.24 * inch, "SURVEY PERIOD")
    y = stat_row("Data collected", REPORT_DATA.survey_period, y)

    c.setFont("Inter-SemiBold", 9.6)
    c.setFillColor(TEAL)
    c.drawString(MARGIN, y + 0.24 * inch, "SURVEY RESPONSE")
    y = stat_row("People who completed the survey", str(REPORT_DATA.sample_size), y)

    y -= 0.15 * inch
    c.setFont("Inter-SemiBold", 12)
    c.setFillColor(TEAL_DARK)
    c.drawString(MARGIN, y, "Survey Interpretation")
    y -= 0.32 * inch
    text = ("To ease interpretation, data are typically reported as a percent of people who reported "
            "that a characteristic applies to them. When a 5-point scale is used, a person can indicate "
            "that this is almost never to always true for them. In this report, we summarize the data "
            "by including the percent who agree that an attribute is true all or most of the time for "
            "them. This can be interpreted as:")
    y = draw_body_paragraph(c, MARGIN, y, text, PAGE_W - 2 * MARGIN, size=10.8, leading=15.5)

    y -= 0.15 * inch
    card_h = 0.75 * inch
    c.setFillColor(SURFACE)
    c.roundRect(MARGIN, y - card_h, PAGE_W - 2 * MARGIN, card_h, 6, fill=1, stroke=0)
    c.setStrokeColor(TEAL)
    c.setLineWidth(2.4)
    c.line(MARGIN, y - card_h, MARGIN, y)
    c.setFont("Inter-SemiBold", 10.8)
    c.setFillColor(TEAL_DARK)
    c.drawCentredString(PAGE_W / 2, y - 0.32 * inch,
                         "\u201cIn our church, X% of people say that this is always")
    c.drawCentredString(PAGE_W / 2, y - 0.54 * inch, "or most of the time true for them.\u201d")


# ============================================================
# CHURCH PROFILE (pg 6-9)
# ============================================================

def page_profile_intro(c):
    new_page(c, 6, "Your Church Profile", "Profile of My Church")
    y = PAGE_H - MARGIN - 1.15 * inch
    text = ("Questions were asked on the survey about personal characteristics. The data reported on "
            "the following pages are for all those who responded to the survey. This is background "
            "information that will help in the interpretation of all the information in this report.")
    y = draw_body_paragraph(c, MARGIN, y, text, PAGE_W - 2 * MARGIN, size=10.8, leading=15.5)
    y -= 0.15 * inch

    c.setFont("Inter-SemiBold", 12)
    c.setFillColor(TEAL_DARK)
    c.drawString(MARGIN, y, "Demographics Included")
    y -= 0.3 * inch
    items = ["Gender", "Age distribution", "Relationship status", "Ages of children in each household",
             "Race and ethnic background"]
    for it in items:
        c.setFillColor(TEAL)
        c.circle(MARGIN + 0.035 * inch, y + 3.2, 2.1, fill=1, stroke=0)
        c.setFont("Inter", 10.6)
        c.setFillColor(INK_MUTED)
        c.drawString(MARGIN + 0.2 * inch, y, it)
        y -= 0.26 * inch

    y -= 0.18 * inch
    c.setFont("Inter-SemiBold", 12)
    c.setFillColor(TEAL_DARK)
    c.drawString(MARGIN, y, "Engagement in the Church Community")
    y -= 0.28 * inch
    text2 = ("Questions were also asked about the involvement of survey respondents in the church "
             "community. This can help in interpretation, since the level of involvement can be related "
             "to people's spiritual maturity and engagement.")
    y = draw_body_paragraph(c, MARGIN, y, text2, PAGE_W - 2 * MARGIN, size=10.6, leading=15)
    y -= 0.1 * inch
    items2 = ["Time involved in the church", "Frequency of attending formal church gatherings",
              "Frequency of participating in Christian small groups",
              "Frequency of volunteering in the activities of the church"]
    for it in items2:
        c.setFillColor(TEAL)
        c.circle(MARGIN + 0.035 * inch, y + 3.2, 2.1, fill=1, stroke=0)
        c.setFont("Inter", 10.6)
        c.setFillColor(INK_MUTED)
        c.drawString(MARGIN + 0.2 * inch, y, it)
        y -= 0.26 * inch


def stat_card(c, x, y, w, h, label, value, sub=None):
    c.setFillColor(SURFACE)
    c.roundRect(x, y, w, h, 6, fill=1, stroke=0)
    c.setFont("Inter-SemiBold", 9)
    c.setFillColor(INK_MUTED)
    c.drawCentredString(x + w / 2, y + h - 0.26 * inch, label.upper())
    c.setFont("DMSans-Bold", 22)
    c.setFillColor(TEAL_DARK)
    c.drawCentredString(x + w / 2, y + h / 2 - 0.18 * inch, value)
    if sub:
        c.setFont("Inter", 8.6)
        c.setFillColor(INK_MUTED)
        c.drawCentredString(x + w / 2, y + 0.16 * inch, sub)


def hbar_list(c, x, y, w, rows, max_value, color, value_suffix="%"):
    """rows: list of (label, value). Draws horizontal bars top-down, returns new y."""
    row_h = 0.32 * inch
    label_w = w * 0.4
    bar_zone = w - label_w - 0.4 * inch
    for label, val in rows:
        c.setFont("Inter", 9.6)
        c.setFillColor(INK)
        c.drawString(x, y - row_h + 10, label)
        bx = x + label_w
        c.setFillColor(SURFACE)
        c.roundRect(bx, y - row_h + 6, bar_zone, row_h - 12, 2, fill=1, stroke=0)
        bw = (val / max_value) * bar_zone if max_value else 0
        c.setFillColor(color)
        if bw > 2:
            c.roundRect(bx, y - row_h + 6, max(bw, 3), row_h - 12, 2, fill=1, stroke=0)
        c.setFont("Inter-SemiBold", 9.2)
        c.setFillColor(TEAL_DARK)
        c.drawString(bx + bar_zone + 0.08 * inch, y - row_h + 10, f"{val}{value_suffix}")
        y -= row_h
    return y


def page_demographics_1(c):
    new_page(c, 7, "Your Church Profile", "Our Church Demographics")
    y = PAGE_H - MARGIN - 1.1 * inch

    card_w = (PAGE_W - 2 * MARGIN - 0.3 * inch) / 2
    stat_card(c, MARGIN, y - 0.9 * inch, card_w, 0.9 * inch, "Church Sample Size", str(REPORT_DATA.sample_size))
    stat_card(c, MARGIN + card_w + 0.3 * inch, y - 0.9 * inch, card_w, 0.9 * inch, "Gender (% Female)", f"{REPORT_DATA.gender_pct_female}%")

    y -= 1.25 * inch
    c.setFont("Inter-SemiBold", 11.5)
    c.setFillColor(TEAL_DARK)
    c.drawString(MARGIN, y, "Ages (%)")
    y -= 0.3 * inch
    age_rows = REPORT_DATA.age_rows
    age_max = max(v for _, v in age_rows)
    y = hbar_list(c, MARGIN, y, PAGE_W - 2 * MARGIN, age_rows, age_max, TEAL)

    y -= 0.2 * inch
    c.setFont("Inter-SemiBold", 11.5)
    c.setFillColor(TEAL_DARK)
    c.drawString(MARGIN, y, "Relationship Status (%)")
    y -= 0.3 * inch
    rel_rows = REPORT_DATA.relationship_rows
    rel_max = max(v for _, v in rel_rows)
    hbar_list(c, MARGIN, y, PAGE_W - 2 * MARGIN, rel_rows, rel_max, CORAL)


def page_demographics_2(c):
    new_page(c, 8, "Your Church Profile", "More Church Demographics")
    y = PAGE_H - MARGIN - 1.1 * inch

    c.setFont("Inter-SemiBold", 11.5)
    c.setFillColor(TEAL_DARK)
    c.drawString(MARGIN, y, "Children in Household (%)")
    c.setFont("Inter", 9)
    c.setFillColor(INK_MUTED)
    c.drawString(MARGIN + 2.6 * inch, y, "(% of church with children in each age category)")
    y -= 0.32 * inch
    child_rows = REPORT_DATA.children_rows
    child_max = max(v for _, v in child_rows)
    y = hbar_list(c, MARGIN, y, PAGE_W - 2 * MARGIN, child_rows, child_max, SAND)

    y -= 0.25 * inch
    c.setFont("Inter-SemiBold", 11.5)
    c.setFillColor(TEAL_DARK)
    c.drawString(MARGIN, y, "Race / Ethnicity (%)")
    y -= 0.32 * inch
    race_rows = REPORT_DATA.race_rows
    race_max = max(v for _, v in race_rows)
    hbar_list(c, MARGIN, y, PAGE_W - 2 * MARGIN, race_rows, race_max, OLIVE)


def page_engagement(c):
    new_page(c, 9, "Your Church Profile", "Engagement in Our Church")
    y = PAGE_H - MARGIN - 1.05 * inch

    stat_card(c, MARGIN, y - 0.75 * inch, 1.9 * inch, 0.75 * inch, "Sample Size", str(REPORT_DATA.sample_size_engagement))

    y -= 1.05 * inch
    sections = [
        ("Time Involved in this Church (%)", REPORT_DATA.tenure_rows, TEAL),
        ("Frequency of Attending Church Gatherings (%)", REPORT_DATA.attendance_rows, TEAL_DARK),
    ]
    shared_max = max(v for _, rows, _ in sections for _, v in rows)
    for title, rows, color in sections:
        c.setFont("Inter-SemiBold", 10.8)
        c.setFillColor(TEAL_DARK)
        c.drawString(MARGIN, y, title)
        y -= 0.26 * inch
        y = hbar_list(c, MARGIN, y, PAGE_W - 2 * MARGIN, rows, shared_max, color)
        y -= 0.14 * inch

    two_col_sections = [
        ("Small Group Involvement (%)", REPORT_DATA.small_group_rows, CORAL),
        ("Volunteering Frequency (%)", REPORT_DATA.volunteer_rows, SAND),
    ]
    col_w = (PAGE_W - 2 * MARGIN - 0.3 * inch) / 2
    top_y = y
    shared_max_2col = max(v for _, rows, _ in two_col_sections for _, v in rows)
    for i, (title, rows, color) in enumerate(two_col_sections):
        cx = MARGIN + i * (col_w + 0.3 * inch)
        c.setFont("Inter-SemiBold", 10)
        c.setFillColor(TEAL_DARK)
        lines = wrapped_lines(c, title, "Inter-SemiBold", 10, col_w)
        yy = top_y
        for ln in lines:
            c.drawString(cx, yy, ln)
            yy -= 0.2 * inch
        yy -= 0.06 * inch
        hbar_list(c, cx, yy, col_w, rows, shared_max_2col, color)


def crop_to_content(path, margin_px=40):
    """Crop away fully-transparent margins around the drawn content.

    The chart is rendered with generous axis limits so labels never clip,
    but that leaves large transparent margins when the actual content
    (circle + labels) doesn't use the full plotted extent. Cropping to the
    alpha channel's bounding box (plus a small margin) removes that dead
    space before pad_to_square re-squares the image, so the donut fills
    its frame instead of floating in a mostly-empty box.
    """
    im = Image.open(path)
    if im.mode != "RGBA":
        return
    alpha = im.split()[-1]
    bbox = alpha.getbbox()
    if bbox is None:
        return
    left, top, right, bottom = bbox
    left = max(0, left - margin_px)
    top = max(0, top - margin_px)
    right = min(im.width, right + margin_px)
    bottom = min(im.height, bottom + margin_px)
    im.crop((left, top, right, bottom)).save(path)


def pad_to_square(path):
    """Pad a saved PNG with transparent margin so width == height.

    matplotlib's bbox_inches="tight" crops to the actual drawn content, which
    is not guaranteed to be square when side callouts extend the content
    asymmetrically. Downstream code (drawImage into a fixed square box on the
    PDF page) assumes a square source image; a non-square source gets
    stretched into an ellipse by some PDF renderers (notably iOS). Padding
    here guarantees a perfect circle regardless of chart layout.
    """
    im = Image.open(path)
    w, h = im.size
    if w == h:
        return
    size = max(w, h)
    canvas_img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    canvas_img.paste(im, ((size - w) // 2, (size - h) // 2))
    canvas_img.save(path)


# ============================================================
# SPIRITUAL MATURITY PROFILE (pg 10-13)
# ============================================================

def make_maturity_donut(path):
    labels = ["Distant", "Exploring", "Believing\nin Jesus", "Trusting\nJesus", "Jesus\nCentered"]
    values = REPORT_DATA.maturity_donut_values
    colors = [MPL_CORAL, MPL_SAND, MPL_TEAL_LIGHT, MPL_TEAL, MPL_TEAL_DARK]

    fig, ax = plt.subplots(figsize=(7.2, 7.2), dpi=300)
    wedges, _ = ax.pie(values, colors=colors, startangle=90, counterclock=False,
           wedgeprops=dict(width=0.42, edgecolor="white", linewidth=2.5))
    for w in wedges:
        w.set_zorder(3)

    ax.text(0, 0.06, REPORT_DATA.maturity_combined_stat, ha="center", va="center", fontsize=27, fontweight="bold",
            color=MPL_TEAL_DARK, family="DM Sans", zorder=6)
    ax.text(0, -0.16, "Trusting or Centered", ha="center", va="center", fontsize=10.5,
            color=MPL_INK_MUTED, family="Inter", zorder=6)

    total = sum(values)
    angle = 90
    n_small = sum(1 for v in values if v < 8)
    small_entries = []
    has_medium = False
    for val, lab, col in zip(values, labels, colors):
        theta = angle - (val / total) * 360 / 2
        angle -= (val / total) * 360
        rad = np.deg2rad(theta)
        x, y = np.cos(rad), np.sin(rad)
        pct_text = f"{val:.1f}%"
        slice_label_color = label_color_for_bg(col)
        if val >= 15:
            lx, ly = x * 0.80, y * 0.80
            ax.text(lx, ly, pct_text, ha="center", va="center", fontsize=12,
                    fontweight="bold", color=slice_label_color, family="DM Sans", zorder=6)
            ax.text(x * 0.80, y * 0.80 - 0.10, lab.replace("\n", " "), ha="center", va="center",
                    fontsize=5.8, color=slice_label_color, family="Inter", zorder=6)
        elif val >= 8:
            # Medium slice: percent inside (color contrasts with wedge), label callout outside in dark text
            has_medium = True
            lx, ly = x * 0.79, y * 0.79
            ax.text(lx, ly, pct_text, ha="center", va="center", fontsize=12,
                    fontweight="bold", color=slice_label_color, family="DM Sans", zorder=6)
            ox, oy = x * 1.32, y * 1.32
            ha = "left" if x >= 0.05 else ("right" if x <= -0.05 else "center")
            ax.text(ox, oy, lab.replace("\n", " "), ha=ha, va="center", fontsize=9,
                    fontweight="bold", color=MPL_TEAL_DARK, family="DM Sans", zorder=6)
        else:
            # Collect small slices; placed below in a stacked column to avoid overlap
            small_entries.append((x, y, lab, pct_text))

    # Stack small-slice callouts vertically to the right of the chart. A vertical
    # stack scales with label count and text length, unlike a fixed-width row.
    if small_entries:
        n = len(small_entries)
        col_x = 1.65
        top_y = 0.55 * (n - 1) / 2 if n > 1 else 0
        for i, (x, y, lab, pct_text) in enumerate(small_entries):
            lx, ly = x * 1.22, y * 1.22
            ty = top_y - i * 0.55
            ax.plot([lx, col_x - 0.08], [ly, ty], color="#9AA6A5", linewidth=0.8, zorder=1)
            ax.text(col_x, ty, f"{lab.replace(chr(10), ' ')}: {pct_text}", ha="left", va="center",
                    fontsize=8.6, fontweight="bold", color=MPL_TEAL_DARK, family="DM Sans", zorder=5)

    # Tight axis limits sized to the actual drawn content (donut radius 1.0 plus
    # a small margin for percent labels), not an oversized fixed box — an
    # over-wide extent leaves large blank margins around the visible circle.
    # bbox_inches="tight" is still avoided (it can crop asymmetrically and
    # produce a non-square image); instead we crop losslessly with PIL below,
    # then pad_to_square re-centers via transparent padding, not stretching.
    if small_entries:
        extent_right = 1.7 + 0.34 * len(small_entries)
    elif has_medium:
        extent_right = 1.5
    else:
        extent_right = 1.15
    ax.set_xlim(-1.15, extent_right)
    ax.set_ylim(-1.15, 1.15)
    ax.set_aspect("equal", adjustable="box")
    ax.axis("off")
    plt.savefig(path, transparent=True, pad_inches=0)
    plt.close()
    crop_to_content(path)
    pad_to_square(path)


def page_maturity_donut(c):
    new_page(c, 10, "Your Church Spiritual Maturity Profile", "Church Spiritual\nMaturity Profile", title_size=23)
    y = PAGE_H - MARGIN - 1.6 * inch

    c.setFont("Inter-SemiBold", 10.5)
    c.setFillColor(INK)
    c.drawString(MARGIN, y, "Pre-Christians:")
    y -= 0.22 * inch
    pre = [("Distant \u2014", "Jesus is not important"), ("Explorers \u2014", "Exploring Jesus")]
    for lead, txt in pre:
        c.setFillColor(TEAL)
        c.circle(MARGIN + 0.035 * inch, y + 3, 1.9, fill=1, stroke=0)
        c.setFont("Inter-SemiBold", 9.6)
        c.setFillColor(TEAL_DARK)
        lw = c.stringWidth(lead + " ", "Inter-SemiBold", 9.6)
        c.drawString(MARGIN + 0.2 * inch, y, lead + " ")
        c.setFont("Inter", 9.6)
        c.setFillColor(INK_MUTED)
        c.drawString(MARGIN + 0.2 * inch + lw, y, txt)
        y -= 0.2 * inch

    y -= 0.08 * inch
    c.setFont("Inter-SemiBold", 10.5)
    c.setFillColor(INK)
    c.drawString(MARGIN, y, "Christians:")
    y -= 0.22 * inch
    chr_ = [("Believing in Jesus \u2014", "Believe in Jesus; following him in some of their life"),
            ("Trusting Jesus \u2014", "Trusting Jesus with more of their life"),
            ("Jesus Centered \u2014", "Jesus is center of life; committed to becoming like him")]
    for lead, txt in chr_:
        c.setFillColor(TEAL)
        c.circle(MARGIN + 0.035 * inch, y + 3, 1.9, fill=1, stroke=0)
        c.setFont("Inter-SemiBold", 9.6)
        c.setFillColor(TEAL_DARK)
        lw = c.stringWidth(lead + " ", "Inter-SemiBold", 9.6)
        c.drawString(MARGIN + 0.2 * inch, y, lead + " ")
        c.setFont("Inter", 9.6)
        c.setFillColor(INK_MUTED)
        c.drawString(MARGIN + 0.2 * inch + lw, y, txt)
        y -= 0.2 * inch

    chart_path = f"{ASSET_DIR}/maturity_donut.png"
    make_maturity_donut(chart_path)

    footer_top = 0.62 * inch
    available_bottom = footer_top + 0.55 * inch
    available_top = y - 0.15 * inch
    available_h = available_top - available_bottom

    # Match the change-profile page (14): a chart sized to fill most of the
    # remaining space, plus a callout card directly beneath it, anchored
    # just below the intro text. Anchoring to the top (rather than
    # centering in the full available region) avoids a dead gap appearing
    # above the block on pages with a short intro and lots of vertical room.
    callout_h = 0.62 * inch
    gap = 0.3 * inch
    # Cap at 5.6in tall, but never wider than the callout card below it
    # (5.1in) so the block reads as one coherent, proportioned unit.
    chart_size = min(5.6 * inch, 5.1 * inch, available_h - gap - callout_h)
    block_top = available_top

    chart_y = block_top - chart_size
    c.drawImage(chart_path, (PAGE_W - chart_size) / 2, chart_y, width=chart_size, height=chart_size, mask="auto")

    callout_y = chart_y - gap - callout_h
    card_w = 5.1 * inch
    card_x = (PAGE_W - card_w) / 2
    c.setFillColor(SURFACE)
    c.roundRect(card_x, callout_y, card_w, callout_h, 6, fill=1, stroke=0)
    c.setStrokeColor(TEAL)
    c.setLineWidth(2.4)
    c.line(card_x, callout_y, card_x, callout_y + callout_h)
    c.setFont("Inter-SemiBold", 10)
    c.setFillColor(INK)
    c.drawString(card_x + 0.22 * inch, callout_y + callout_h - 0.24 * inch,
                 f"{REPORT_DATA.maturity_combined_stat} of your church is Trusting Jesus or Jesus Centered.")
    c.setFont("Inter", 9)
    c.setFillColor(INK_MUTED)
    c.drawString(card_x + 0.22 * inch, callout_y + 0.14 * inch,
                 "Note: if a category is missing, it indicates zero percent of respondents.")


def cross_tab_page(c, page_num, subtitle, col_labels, col_colors, sections, note=True, max_value=100):
    new_page(c, page_num, "Your Church Spiritual Maturity Profile", "Diversity in Church\nSpiritual Maturity", title_size=22)
    top = PAGE_H - MARGIN - 1.55 * inch
    label_col_w = 2.15 * inch
    table_w = PAGE_W - 2 * MARGIN
    data_w = table_w - label_col_w
    col_w = data_w / len(col_labels)

    hy = top
    c.setFont("Inter-SemiBold", 8.4)
    for i, (lab, col) in enumerate(zip(col_labels, col_colors)):
        cx = MARGIN + label_col_w + i * col_w + col_w / 2
        lines = lab.split("\n")
        c.setFillColor(col)
        c.roundRect(cx - col_w * 0.36, hy - 2, col_w * 0.72, 4, 2, fill=1, stroke=0)
        ty = hy - 16
        c.setFillColor(INK)
        for ln in lines:
            c.drawCentredString(cx, ty, ln)
            ty -= 10
    y = hy - 0.5 * inch
    row_h = 0.245 * inch
    section_gap = 0.1 * inch

    for label, values in sections:
        if values is None:
            y -= section_gap
            c.setFont("Inter-SemiBold", 8.8)
            c.setFillColor(TEAL_DARK)
            c.drawString(MARGIN, y, label)
            c.setStrokeColor(BORDER)
            c.setLineWidth(0.6)
            c.line(MARGIN, y - 6, PAGE_W - MARGIN, y - 6)
            y -= 0.22 * inch
            continue
        c.setFont("Inter", 9)
        c.setFillColor(INK)
        c.drawString(MARGIN, y - row_h + 6, label)
        for i, val in enumerate(values):
            cx = MARGIN + label_col_w + i * col_w + 0.06 * inch
            cell_w = col_w - 0.12 * inch
            label_zone = 0.32 * inch
            track_w = cell_w - label_zone
            bw = (val / max_value) * track_w if max_value else 0
            c.setFillColor(SURFACE)
            c.roundRect(cx, y - row_h + 3, track_w, row_h - 6, 2, fill=1, stroke=0)
            c.setFillColor(col_colors[i])
            if bw > 2:
                c.roundRect(cx, y - row_h + 3, max(bw, 3), row_h - 6, 2, fill=1, stroke=0)
            c.setFont("Inter-SemiBold", 8)
            c.setFillColor(TEAL_DARK if val > 0 else INK_MUTED)
            c.drawString(cx + track_w + 0.06 * inch, y - row_h + 6, f"{val}%")
        y -= row_h

    if note:
        c.setFont("Inter", 7.8)
        c.setFillColor(INK_MUTED)
        c.drawString(MARGIN, y - 0.1 * inch, subtitle)


def page_maturity_diversity_1(c):
    col_labels = ["Exploring\nJesus", "Believing\nin Jesus", "Trusting\nJesus", "Jesus\nCentered"]
    col_colors = [SAND, TEAL_LIGHT, TEAL, TEAL_DARK]
    sections = REPORT_DATA.maturity_crosstab_1
    cross_tab_page(c, 11, "Note: if a category is missing, it indicates zero percent of respondents.",
                   col_labels, col_colors, sections)


def page_maturity_diversity_2(c):
    col_labels = ["Exploring\nJesus", "Believing\nin Jesus", "Trusting\nJesus", "Jesus\nCentered"]
    col_colors = [SAND, TEAL_LIGHT, TEAL, TEAL_DARK]
    sections = REPORT_DATA.maturity_crosstab_2
    cross_tab_page(c, 12, "Note: if a category is missing, it indicates zero percent of respondents.",
                   col_labels, col_colors, sections)


# ============================================================
# SPIRITUAL CHANGE PROFILE (pg 14-16)
# ============================================================

def page_change_intro(c):
    new_page(c, 13, "Your Church Spiritual Change Profile", "Church Spiritual\nChange Profile", title_size=23)
    y = PAGE_H - MARGIN - 1.6 * inch
    c.setFont("Inter-SemiBold", 11)
    c.setFillColor(INK)
    text0 = ("A following question was asked on the survey: \u201cCompared to where you were 2 years ago, "
             "where is your faith and trust in God today?\u201d People reflected on this question and "
             "chose one of the following answers:")
    y = draw_body_paragraph(c, MARGIN, y, text0, PAGE_W - 2 * MARGIN, size=10.8, leading=15.5,
                             color=INK, font="Inter-Medium")
    y -= 0.1 * inch
    for it in ["Growing significantly", "Growing a little", "About the same", "Fading somewhat", "Fading a lot"]:
        c.setFillColor(TEAL)
        c.circle(MARGIN + 0.035 * inch, y + 3.2, 2.1, fill=1, stroke=0)
        c.setFont("Inter", 10.4)
        c.setFillColor(INK_MUTED)
        c.drawString(MARGIN + 0.2 * inch, y, it)
        y -= 0.24 * inch

    y -= 0.15 * inch
    c.setFont("Inter-SemiBold", 12)
    c.setFillColor(TEAL_DARK)
    c.drawString(MARGIN, y, "Reporting on the Spiritual Change Levels")
    y -= 0.3 * inch
    text = ("Of course, we hope that a high proportion of your church reports that they are growing in "
            "their faith and trust in God. You can celebrate that! But you will probably find that some "
            "people see themselves as stuck where they were, and others may feel their faith has been "
            "fading some. Knowing this can help you understand how to support the spiritual growth and "
            "maturity of your people.")
    y = draw_body_paragraph(c, MARGIN, y, text, PAGE_W - 2 * MARGIN, size=10.6, leading=15.5)
    y -= 0.1 * inch
    text2 = ("To help you, the analysis that follows gives you valuable information on the "
             "characteristics of people in your community who fall into each of the levels of "
             "self-described spiritual growth.")
    draw_body_paragraph(c, MARGIN, y, text2, PAGE_W - 2 * MARGIN, size=10.6, leading=15.5)


def make_donut_chart(path):
    labels = ["Growing\nsignificantly", "Growing\na little", "About\nthe same", "Fading\nsomewhat", "Fading\na lot"]
    values = REPORT_DATA.change_donut_values
    colors = [MPL_TEAL_DARK, MPL_TEAL, MPL_TEAL_LIGHT, MPL_SAND, MPL_CORAL]

    fig, ax = plt.subplots(figsize=(7.2, 7.2), dpi=300)
    ax.pie(values, colors=colors, startangle=90, counterclock=False,
           wedgeprops=dict(width=0.42, edgecolor="white", linewidth=2.5))

    ax.text(0, 0.08, REPORT_DATA.change_donut_combined_stat, ha="center", va="center", fontsize=27,
            fontweight="bold", color=MPL_TEAL_DARK, family="DM Sans")
    ax.text(0, -0.14, "reported growth", ha="center", va="center", fontsize=11.5,
            color="#5B6B6B", family="Inter")

    total = sum(values)
    angle = 90
    n_small = sum(1 for v in values if v < 8)
    small_entries = []
    for val, lab, col in zip(values, labels, colors):
        theta = angle - (val / total) * 360 / 2
        angle -= (val / total) * 360
        rad = np.deg2rad(theta)
        x, y = np.cos(rad), np.sin(rad)
        pct_text = f"{val:.1f}%"
        slice_label_color = label_color_for_bg(col)
        if val >= 8:
            lx, ly = x * 0.79, y * 0.79
            ax.text(lx, ly, pct_text, ha="center", va="center", fontsize=13.5,
                    fontweight="bold", color=slice_label_color, family="DM Sans")
        else:
            # Collect small slices; placed below in a stacked column to avoid overlap
            small_entries.append((x, y, lab, pct_text))

    # Stack small-slice callouts vertically to the right of the chart. A vertical
    # stack scales with label count and text length, unlike a fixed-width row.
    if small_entries:
        n = len(small_entries)
        col_x = 1.55
        top_y = 0.55 * (n - 1) / 2 if n > 1 else 0
        for i, (x, y, lab, pct_text) in enumerate(small_entries):
            lx, ly = x * 1.22, y * 1.22
            ty = top_y - i * 0.55
            ax.plot([lx, col_x - 0.08], [ly, ty], color="#9AA6A5", linewidth=0.8, zorder=1)
            ax.text(col_x, ty, f"{lab.replace(chr(10), ' ')}: {pct_text}", ha="left", va="center",
                    fontsize=8.6, fontweight="bold", color=MPL_TEAL_DARK, family="DM Sans", zorder=5)

    # Tight axis limits sized to the actual drawn content (donut radius 1.0 plus
    # a small margin for percent labels), not an oversized fixed box — an
    # over-wide extent leaves large blank margins around the visible circle.
    # bbox_inches="tight" is still avoided (it can crop asymmetrically and
    # produce a non-square image); instead we crop losslessly with PIL below,
    # then pad_to_square re-centers via transparent padding, not stretching.
    extent_right = 1.7 + 0.34 * len(small_entries) if small_entries else 1.15
    extent = max(extent_right, 1.15)
    ax.set_xlim(-1.15, extent)
    ax.set_ylim(-1.15, 1.15)
    ax.set_aspect("equal", adjustable="box")
    ax.axis("off")
    plt.savefig(path, transparent=True, pad_inches=0)
    plt.close()
    crop_to_content(path)
    pad_to_square(path)


def page_change_profile(c):
    new_page(c, 14, "Church Spiritual Change Profile", "Levels of Spiritual Change")

    intro_y = PAGE_H - MARGIN - 0.75 * inch
    c.setFont("Inter", 10.5)
    c.setFillColor(INK_MUTED)
    c.drawString(MARGIN, intro_y, "Compared to 2 years ago, faith and trust in God is:")

    legend_items = [
        ("Growing significantly", TEAL_DARK), ("Growing a little", TEAL),
        ("About the same", TEAL_LIGHT), ("Fading somewhat", SAND), ("Fading a lot", CORAL),
    ]
    ly = intro_y - 0.34 * inch
    lx = MARGIN
    c.setFont("Inter-Medium", 9.5)
    for label, col in legend_items:
        c.setFillColor(col)
        c.roundRect(lx, ly - 3, 0.14 * inch, 0.14 * inch, 2, fill=1, stroke=0)
        c.setFillColor(INK)
        tw = c.stringWidth(label, "Inter-Medium", 9.5)
        c.drawString(lx + 0.22 * inch, ly, label)
        lx += 0.22 * inch + tw + 0.3 * inch

    chart_path = f"{ASSET_DIR}/donut.png"
    make_donut_chart(chart_path)

    footer_top = 0.62 * inch
    available_bottom = footer_top + 0.55 * inch
    available_top = ly - 0.35 * inch
    available_h = available_top - available_bottom

    callout_h = 0.62 * inch
    gap = 0.3 * inch
    # Size the chart to fill most of the available space (capped at 5.6in
    # tall, and never wider than the callout card below it at 5.1in). Anchor
    # the block just below the legend rather than centering it in the full
    # available region — centering split unused space evenly above AND below,
    # which looked like the block was floating with a dead gap on top.
    chart_size = min(5.6 * inch, 5.1 * inch, available_h - gap - callout_h)
    block_top = available_top

    chart_y = block_top - chart_size
    c.drawImage(chart_path, (PAGE_W - chart_size) / 2, chart_y, width=chart_size, height=chart_size, mask="auto")

    callout_y = chart_y - 0.3 * inch - callout_h
    card_w = 5.1 * inch
    card_x = (PAGE_W - card_w) / 2
    c.setFillColor(SURFACE)
    c.roundRect(card_x, callout_y, card_w, callout_h, 6, fill=1, stroke=0)
    c.setStrokeColor(TEAL)
    c.setLineWidth(2.4)
    c.line(card_x, callout_y, card_x, callout_y + callout_h)
    c.setFont("Inter-SemiBold", 10)
    c.setFillColor(INK)
    c.drawString(card_x + 0.22 * inch, callout_y + callout_h - 0.24 * inch,
                 REPORT_DATA.change_callout_combined_stat)
    c.setFont("Inter", 9)
    c.setFillColor(INK_MUTED)
    c.drawString(card_x + 0.22 * inch, callout_y + 0.14 * inch,
                 "Note: if a category is missing, it indicates zero percent of respondents.")


def page_diversity_table(c):
    new_page(c, 15, "Diversity in Church Spiritual Change", "My Faith and Trust in God Is\u2026")

    col_labels = ["Growing\nSignificantly", "Growing\na little", "Not\nChanging", "Fading"]
    col_colors = [TEAL_DARK, TEAL, SAND, CORAL]

    rows = REPORT_DATA.change_crosstab_diversity_table

    top = PAGE_H - MARGIN - 0.78 * inch
    label_col_w = 2.35 * inch
    table_w = PAGE_W - 2 * MARGIN
    data_w = table_w - label_col_w
    col_w = data_w / 4

    hy = top
    c.setFont("Inter-SemiBold", 8.6)
    for i, (lab, col) in enumerate(zip(col_labels, col_colors)):
        cx = MARGIN + label_col_w + i * col_w + col_w / 2
        lines = lab.split("\n")
        c.setFillColor(col)
        c.roundRect(cx - col_w * 0.36, hy - 2, col_w * 0.72, 4, 2, fill=1, stroke=0)
        ty = hy - 16
        c.setFillColor(INK)
        for ln in lines:
            c.drawCentredString(cx, ty, ln)
            ty -= 10.5

    y = hy - 0.58 * inch
    row_h = 0.29 * inch
    section_gap = 0.16 * inch

    for label, values in rows:
        if values is None:
            y -= section_gap
            c.setFont("Inter-SemiBold", 9)
            c.setFillColor(TEAL_DARK)
            c.drawString(MARGIN, y, label)
            c.setStrokeColor(BORDER)
            c.setLineWidth(0.6)
            c.line(MARGIN, y - 6, PAGE_W - MARGIN, y - 6)
            y -= 0.28 * inch
            continue

        c.setFont("Inter", 9.6)
        c.setFillColor(INK)
        c.drawString(MARGIN, y - row_h + 6.5, label)

        for i, val in enumerate(values):
            cx = MARGIN + label_col_w + i * col_w + 0.08 * inch
            cell_w = col_w - 0.16 * inch
            label_zone = 0.34 * inch
            track_w = cell_w - label_zone
            bw = (val / 71) * track_w if 71 else 0
            c.setFillColor(SURFACE)
            c.roundRect(cx, y - row_h + 3, track_w, row_h - 6, 2, fill=1, stroke=0)
            c.setFillColor(col_colors[i])
            if bw > 2:
                c.roundRect(cx, y - row_h + 3, max(bw, 3), row_h - 6, 2, fill=1, stroke=0)
            c.setFont("Inter-SemiBold", 8.6)
            c.setFillColor(TEAL_DARK if val > 0 else INK_MUTED)
            c.drawString(cx + track_w + 0.08 * inch, y - row_h + 6.5, f"{val}%")
        y -= row_h

    c.setFont("Inter", 8.2)
    c.setFillColor(INK_MUTED)
    c.drawString(MARGIN, y - 0.12 * inch, "Note: if a category is missing, it indicates zero percent of respondents in that group.")


def page_change_diversity_2(c):
    col_labels = ["Growing\nSignificantly", "Growing\na little", "Not\nChanging", "Fading"]
    col_colors = [TEAL_DARK, TEAL, SAND, CORAL]
    sections = REPORT_DATA.change_crosstab_2
    new_page(c, 16, "Diversity in Church Spiritual Change", "My Faith and Trust in God Is\u2026 (cont.)")
    top = PAGE_H - MARGIN - 0.9 * inch
    label_col_w = 2.35 * inch
    table_w = PAGE_W - 2 * MARGIN
    data_w = table_w - label_col_w
    col_w = data_w / 4
    hy = top
    c.setFont("Inter-SemiBold", 8.6)
    for i, (lab, col) in enumerate(zip(col_labels, col_colors)):
        cx = MARGIN + label_col_w + i * col_w + col_w / 2
        lines = lab.split("\n")
        c.setFillColor(col)
        c.roundRect(cx - col_w * 0.36, hy - 2, col_w * 0.72, 4, 2, fill=1, stroke=0)
        ty = hy - 16
        c.setFillColor(INK)
        for ln in lines:
            c.drawCentredString(cx, ty, ln)
            ty -= 10.5
    y = hy - 0.58 * inch
    row_h = 0.29 * inch
    for label, values in sections:
        if values is None:
            y -= 0.16 * inch
            c.setFont("Inter-SemiBold", 9)
            c.setFillColor(TEAL_DARK)
            c.drawString(MARGIN, y, label)
            c.setStrokeColor(BORDER)
            c.setLineWidth(0.6)
            c.line(MARGIN, y - 6, PAGE_W - MARGIN, y - 6)
            y -= 0.28 * inch
            continue
        c.setFont("Inter", 9.6)
        c.setFillColor(INK)
        c.drawString(MARGIN, y - row_h + 6.5, label)
        for i, val in enumerate(values):
            cx = MARGIN + label_col_w + i * col_w + 0.08 * inch
            cell_w = col_w - 0.16 * inch
            label_zone = 0.34 * inch
            track_w = cell_w - label_zone
            bw = (val / 71) * track_w
            c.setFillColor(SURFACE)
            c.roundRect(cx, y - row_h + 3, track_w, row_h - 6, 2, fill=1, stroke=0)
            c.setFillColor(col_colors[i])
            if bw > 2:
                c.roundRect(cx, y - row_h + 3, max(bw, 3), row_h - 6, 2, fill=1, stroke=0)
            c.setFont("Inter-SemiBold", 8.6)
            c.setFillColor(TEAL_DARK if val > 0 else INK_MUTED)
            c.drawString(cx + track_w + 0.08 * inch, y - row_h + 6.5, f"{val}%")
        y -= row_h


# ============================================================
# JESUS JOURNEY PROFILE INTRO (pg 17-19)
# ============================================================

def page_jj_profile_intro(c):
    new_page(c, 17, "Your Church Jesus Journey Profile", "Jesus Journey Profile")
    y = PAGE_H - MARGIN - 1.2 * inch
    c.setFont("Inter-SemiBold", 11.5)
    c.setFillColor(INK)
    c.drawString(MARGIN, y, "Attributes of Movement on the Journey Toward Jesus")
    y -= 0.34 * inch
    items = [
        (None, "The Jesus Journey survey asks 63 questions that delve into the life and beliefs of the "
                "person being surveyed. This is the heart of the Journey profile \u2014 less about "
                "experiences in church and more about the life one lives day by day in growing toward "
                "God and living a life guided by God's Spirit."),
        (None, "Each person was asked \u201cHow true is this of you now?\u201d followed by a series of 45 "
                "statements. Possible answers were: 1) Never or not yet true; 2) Occasionally true; "
                "3) Quite often true; 4) Most of the time true; or 5) Always true."),
        (None, "In addition, everyone was asked, \u201cHow often do you believe these to be true?\u201d, "
                "followed by a series of 18 statements, with a parallel 5-point belief scale."),
        (None, "It would be unusual for anyone other than Jesus to say that each attribute is \u201calways "
                "true\u201d for them. We are all in process, and the statements reveal how far along we "
                "are in our Journey to be aligned with God and his purposes in our lives."),
    ]
    draw_bullet_block(c, MARGIN, y, items, PAGE_W - 2 * MARGIN, size=10.8, leading=15.5, gap=15)


def page_jj_goals_overview(c):
    new_page(c, 18, "Your Church Jesus Journey Profile", "Journey Goals\nand Pathways", title_size=23)
    y = PAGE_H - MARGIN - 1.65 * inch
    text0 = ("Four major Journey Goals are revealed in the following pages. For each Journey Goal, "
             "there are 4 Journey Pathways that reveal where we are on our walk with Jesus:")
    y = draw_body_paragraph(c, MARGIN, y, text0, PAGE_W - 2 * MARGIN, size=10.6, leading=15, color=INK, font="Inter-Medium")
    y -= 0.14 * inch

    goals = [
        ("Goal 1: Trusting Jesus", "knowing God's story; receiving God's love; identity in God; trusting God in challenges"),
        ("Goal 2: Experiencing Jesus", "responding to God; communicating with God; growing in faith; worshiping"),
        ("Goal 3: Reflecting Jesus", "expressing God's love; practicing faith; journeying with others; reconciling"),
        ("Goal 4: Serving Jesus", "partnering with God; stewarding resources; showing compassion; acting justly"),
    ]
    for title, sub in goals:
        c.setFillColor(TEAL)
        c.circle(MARGIN + 0.035 * inch, y + 3.2, 2.3, fill=1, stroke=0)
        c.setFont("Inter-SemiBold", 10.6)
        c.setFillColor(TEAL_DARK)
        c.drawString(MARGIN + 0.2 * inch, y, title)
        y -= 0.19 * inch
        y2 = draw_body_paragraph(c, MARGIN + 0.2 * inch, y, sub, PAGE_W - 2 * MARGIN - 0.2 * inch,
                                  size=9.6, leading=13.5)
        y = y2 - 0.1 * inch

    # Flow diagram
    y -= 0.25 * inch
    labels = ["My Life\nNow", "Jesus Journey\nPathways", "Jesus Journey\nGoals"]
    n = len(labels)
    oval_w, oval_h = 1.7 * inch, 0.62 * inch
    total_w = PAGE_W - 2 * MARGIN
    gap = (total_w - n * oval_w) / (n - 1)
    ox = MARGIN
    centers = []
    for lab in labels:
        c.setStrokeColor(TEAL)
        c.setLineWidth(1.3)
        c.setFillColor(PAPER)
        c.ellipse(ox, y - oval_h, ox + oval_w, y, fill=1, stroke=1)
        c.setFont("Inter-Medium", 10)
        c.setFillColor(INK)
        lines = lab.split("\n")
        ty = y - oval_h / 2 + (len(lines) - 1) * 6
        for ln in lines:
            c.drawCentredString(ox + oval_w / 2, ty, ln)
            ty -= 13
        centers.append((ox + oval_w, y - oval_h / 2))
        ox += oval_w + gap
    for i in range(n - 1):
        x1, ay = centers[i]
        x2 = x1 + gap
        c.setStrokeColor(TEAL)
        c.setLineWidth(1.6)
        c.line(x1 + 4, ay, x2 - 8, ay)
        c.line(x2 - 8, ay, x2 - 14, ay + 5)
        c.line(x2 - 8, ay, x2 - 14, ay - 5)


def page_goal_intro(c, page_num, goal_num, goal_name, question, pathways):
    """pathways: list of (name, desc, extra) tuples"""
    new_page(c, page_num, "Jesus Journey Goals and Pathways", f"Journey Goal #{goal_num}:\n{goal_name}", title_size=23)
    y = PAGE_H - MARGIN - 1.7 * inch
    c.setFont("Inter-SemiBold", 12.5)
    c.setFillColor(INK)
    lines = wrapped_lines(c, question, "Inter-SemiBold", 12.5, PAGE_W - 2 * MARGIN)
    for ln in lines:
        c.drawCentredString(PAGE_W / 2, y, ln)
        y -= 0.24 * inch
    y -= 0.15 * inch
    c.setFont("Inter", 10.3)
    c.setFillColor(INK_MUTED)
    c.drawString(MARGIN, y, f"The Journey profile captures 4 Pathways that reveal our progress in the Goal of {goal_name}:")
    y -= 0.32 * inch

    for name, desc, extra in pathways:
        c.setFillColor(TEAL)
        c.circle(MARGIN + 0.045 * inch, y + 2.5, 3.2, fill=1, stroke=0)
        c.setFillColor(PAPER)
        c.circle(MARGIN + 0.045 * inch, y + 4.5, 1.1, fill=1, stroke=0)
        c.setFont("Inter-SemiBold", 10.4)
        c.setFillColor(TEAL_DARK)
        lead = f"{name}:"
        lw = c.stringWidth(lead + " ", "Inter-SemiBold", 10.4)
        c.drawString(MARGIN + 0.24 * inch, y, lead + " ")
        c.setFont("Inter-Medium", 10.4)
        c.setFillColor(INK)
        rest_lines = wrapped_lines(c, desc, "Inter-Medium", 10.4, PAGE_W - 2 * MARGIN - 0.24 * inch - lw)
        c.drawString(MARGIN + 0.24 * inch + lw, y, rest_lines[0])
        y -= 0.19 * inch
        for ln in rest_lines[1:]:
            c.drawString(MARGIN + 0.24 * inch, y, ln)
            y -= 0.19 * inch
        for ex in extra:
            c.setFillColor(TEAL_LIGHT)
            c.circle(MARGIN + 0.48 * inch, y + 3, 1.6, fill=1, stroke=0)
            y = draw_body_paragraph(c, MARGIN + 0.62 * inch, y, ex, PAGE_W - 2 * MARGIN - 0.62 * inch,
                                     size=9.3, leading=13, color=INK_MUTED)
        y -= 0.14 * inch


# ============================================================
# GOAL PATHWAY RESULT PAGES (generic template)
# ============================================================

def pathway_result_page(c, page_num, goal_name, items, col_labels=("Exploring\nJesus", "Believing\nin Jesus", "Trusting\nJesus", "Jesus\nCentered")):
    """items: list of (num, title, bold_desc, [(stmt, [v1,v2,v3,v4]), ...])"""
    new_page(c, page_num, "Jesus Journey Goals and Pathways", "Journey Pathway Results:\n" + goal_name + " Pathways", title_size=18)

    col_colors = [SAND, TEAL_LIGHT, TEAL, TEAL_DARK]
    right_w = 3.05 * inch
    left_w = PAGE_W - 2 * MARGIN - right_w - 0.2 * inch
    top = PAGE_H - MARGIN - 1.55 * inch

    # column headers
    c.setFont("Inter-SemiBold", 7.6)
    c.setFillColor(INK_MUTED)
    c.drawRightString(PAGE_W - MARGIN, top + 0.24 * inch, "% Always / Mostly True of Me")
    col_w = right_w / 4
    for i, lab in enumerate(col_labels):
        cx = MARGIN + left_w + 0.2 * inch + i * col_w + col_w / 2
        lines = lab.split("\n")
        c.setFillColor(col_colors[i])
        c.roundRect(cx - col_w * 0.34, top - 2, col_w * 0.68, 3.5, 1.5, fill=1, stroke=0)
        ty = top - 13
        c.setFillColor(INK)
        c.setFont("Inter-SemiBold", 7.6)
        for ln in lines:
            c.drawCentredString(cx, ty, ln)
            ty -= 8.6

    y = top - 0.34 * inch
    for num, title, bold_desc, stmts in items:
        c.setFont("Inter-SemiBold", 10.4)
        c.setFillColor(TEAL_DARK)
        head = f"{num}. {title}:"
        lw = c.stringWidth(head + " ", "Inter-SemiBold", 10.4)
        c.drawString(MARGIN, y, head + " ")
        c.setFont("Inter-Medium", 10.4)
        c.setFillColor(INK)
        rest_lines = wrapped_lines(c, bold_desc, "Inter-Medium", 10.4, left_w - lw)
        c.drawString(MARGIN + lw, y, rest_lines[0] if rest_lines else "")
        y -= 0.185 * inch
        for ln in rest_lines[1:]:
            c.drawString(MARGIN, y, ln)
            y -= 0.185 * inch
        y -= 0.03 * inch

        for stmt, vals in stmts:
            row_top = y
            stmt_lines = wrapped_lines(c, stmt, "Inter", 8.9, left_w - 0.14 * inch)
            c.setFont("Inter", 8.9)
            c.setFillColor(INK_MUTED)
            ty = row_top
            for ln in stmt_lines:
                c.drawString(MARGIN + 0.14 * inch, ty, ln)
                ty -= 11.5
            row_h = max(len(stmt_lines) * 11.5, 13)
            vy = row_top - (row_h - 11.5) / 2 - 2
            for i, v in enumerate(vals):
                cx = MARGIN + left_w + 0.2 * inch + i * col_w + col_w / 2
                c.setFont("Inter-SemiBold", 9.3)
                c.setFillColor(TEAL_DARK if (v is not None and v > 0) else INK_MUTED)
                c.drawCentredString(cx, vy, str(v) if v is not None else "\u2014")
            y = row_top - row_h - 3
        y -= 0.14 * inch

    c.setFont("Inter", 7.6)
    c.setFillColor(INK_MUTED)
    footnote = ("* Percent within each maturity group who said this is always or most of the time true "
                "of me.")
    lines = wrapped_lines(c, footnote, "Inter", 7.6, PAGE_W - 2 * MARGIN)
    yy = 0.9 * inch
    for ln in lines:
        c.drawString(MARGIN, yy, ln)
        yy -= 10


def goal_summary_chart_page(c, page_num, goal_num, goal_name, pathway_names, values, color):
    new_page(c, page_num, "Jesus Journey Goals and Pathways", "Journey Pathways in\nOur Church", title_size=23)
    y = PAGE_H - MARGIN - 1.55 * inch
    c.setFont("Inter-SemiBold", 13.5)
    c.setFillColor(TEAL_DARK)
    c.drawString(MARGIN, y, f"Summary for Goal {goal_num}: {goal_name}")
    y -= 0.3 * inch
    text = (f"This graph combines the data from the previous 2 pages for all the questions on the 4 "
            f"Journey Pathways under Goal {goal_num}: {goal_name}. It provides the average percent who "
            "said these attributes are always or most of the time true for them across all church "
            "respondents, not broken down by spiritual maturity.")
    y = draw_body_paragraph(c, MARGIN, y, text, PAGE_W - 2 * MARGIN, size=10, leading=14.5)
    y -= 0.35 * inch

    chart_path = f"{ASSET_DIR}/goal_{goal_num}_chart.png"
    make_hbar_chart(chart_path, pathway_names, values, color, f"Goal {goal_num}: {goal_name} Pathways")
    chart_w = PAGE_W - 2 * MARGIN
    footer_top = 0.62 * inch + 0.3 * inch
    max_h = y - footer_top
    draw_chart_image_fit(c, chart_path, MARGIN, chart_w, y, max_h, anchor="top")


def label_color_for_bg(hex_color):
    """Return white or dark ink text color depending on relative luminance of the
    given background hex color, for legible bar-chart data labels."""
    hc = hex_color.lstrip("#")
    r, g, b = (int(hc[i:i + 2], 16) / 255.0 for i in (0, 2, 4))

    def lin(v):
        return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4

    lum = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
    return "white" if lum < 0.5 else MPL_TEAL_DARK


def draw_chart_image_fit(c, path, x, max_w, y_top_or_bottom, max_h, anchor="top"):
    """Draw a chart PNG preserving its true aspect ratio (from bbox_inches='tight'
    savefig output) so it is never stretched. Scales to fit within max_w x max_h.
    anchor='top': y_top_or_bottom is the top y-coordinate, image grows downward.
    anchor='bottom': y_top_or_bottom is the bottom y-coordinate, image grows upward.
    Returns the actual (w, h) drawn and the bottom y-coordinate used.
    """
    img = ImageReader(path)
    iw, ih = img.getSize()
    aspect = ih / float(iw)
    w = max_w
    h = w * aspect
    if h > max_h:
        h = max_h
        w = h / aspect
    if anchor == "top":
        bottom_y = y_top_or_bottom - h
    else:
        bottom_y = y_top_or_bottom
    c.drawImage(path, x, bottom_y, width=w, height=h, mask="auto")
    return w, h, bottom_y


def make_hbar_chart(path, labels, values, color, title):
    fig, ax = plt.subplots(figsize=(8.5, 4.6), dpi=220)
    y_pos = np.arange(len(labels))
    bars = ax.barh(y_pos, values, color=color, height=0.55)
    ax.set_yticks(y_pos)
    ax.set_yticklabels(labels, fontsize=12, family="Inter", color=MPL_INK_MUTED)
    ax.invert_yaxis()
    ax.set_xlim(0, 100)
    for spine in ["top", "right", "left"]:
        ax.spines[spine].set_visible(False)
    ax.spines["bottom"].set_color("#D0D5D4")
    ax.tick_params(axis="x", labelsize=10, colors=MPL_INK_MUTED)
    ax.tick_params(axis="y", length=0)
    ax.set_axisbelow(True)
    ax.xaxis.grid(True, color="#E7ECEB", linewidth=0.8)
    label_color = label_color_for_bg(color)
    for bar, val in zip(bars, values):
        ax.text(val - 3, bar.get_y() + bar.get_height() / 2, f"{val}", va="center", ha="right",
                fontsize=12, fontweight="bold", color=label_color, family="DM Sans")
    ax.set_title(title, fontsize=13, family="DM Sans", fontweight="bold", color=MPL_TEAL_DARK, loc="left", pad=12)
    plt.tight_layout()
    plt.savefig(path, transparent=True, bbox_inches="tight")
    plt.close()


# ============================================================
# SUMMARY PROFILE (pg 35-37) + REFLECTING (pg 38)
# ============================================================

def page_summary_intro(c):
    new_page(c, 35, "Your Church Summary Profile", "Our Journey Summary")
    y = PAGE_H - MARGIN - 1.15 * inch
    c.setFont("Inter-SemiBold", 11.5)
    c.setFillColor(INK)
    c.drawString(MARGIN, y, "Patterns of Our People's Spiritual Lives")
    y -= 0.3 * inch
    text0 = "The final section of this report provides a summary of the Jesus Journey for the people of this church:"
    y = draw_body_paragraph(c, MARGIN, y, text0, PAGE_W - 2 * MARGIN, size=10.6, leading=15.5)
    y -= 0.12 * inch
    items = [
        (None, "On the next page, a summary value is given for each of the 16 Pathways measured in the "
                "Journey survey. The values represent the average % who agreed that this is true for "
                "them across the questions on each Pathway."),
        (None, "The following page provides a picture of the differences across the 3 Christian "
                "spiritual maturity groups on the 16 Pathways: people who are \u201cBelieving in "
                "Jesus,\u201d \u201cTrusting in Jesus,\u201d and \u201cJesus Centered.\u201d"),
    ]
    y = draw_bullet_block(c, MARGIN, y, items, PAGE_W - 2 * MARGIN, size=10.4, leading=15, gap=14)

    y -= 0.1 * inch
    c.setFillColor(SURFACE)
    card_h = 1.1 * inch
    c.roundRect(MARGIN, y - card_h, PAGE_W - 2 * MARGIN, card_h, 6, fill=1, stroke=0)
    c.setStrokeColor(TEAL)
    c.setLineWidth(2.4)
    c.line(MARGIN, y - card_h, MARGIN, y)
    note = ("Note: People who are \u201cExploring Jesus\u201d (including pre-Christian groups) are not "
            "included here. They are smaller in number and answered fewer survey questions, making "
            "their data less comparable. It's best to examine their responses individually.")
    draw_body_paragraph(c, MARGIN + 0.22 * inch, y - 0.28 * inch, note,
                         PAGE_W - 2 * MARGIN - 0.4 * inch, size=9.4, leading=13.5)


ALL_16 = [
    "1. Believing God's Story", "2. Receiving God's Love", "3. My Identity", "4. Facing Challenges",
    "5. Responding to God", "6. Communicating with God", "7. Growing My Faith", "8. Worshiping God",
    "9. Expressing God's Love", "10. Practicing My Faith", "11. Journeying with Others",
    "12. Reconciling with Others", "13. Partnering with God", "14. Stewarding Resources",
    "15. Showing Compassion", "16. Acting Justly",
]
ALL_16_COLORS = ([MPL_TEAL_DARK] * 4 + [MPL_TEAL_LIGHT] * 4 + [MPL_CORAL] * 4 + [MPL_SAND] * 4)


def make_all16_chart(path):
    all16_values = REPORT_DATA.all16_values
    fig, ax = plt.subplots(figsize=(8.6, 7.6), dpi=220)
    y_pos = np.arange(len(ALL_16))
    bars = ax.barh(y_pos, all16_values, color=ALL_16_COLORS, height=0.62)
    ax.set_yticks(y_pos)
    ax.set_yticklabels(ALL_16, fontsize=10.5, family="Inter", color=MPL_INK_MUTED)
    ax.invert_yaxis()
    ax.set_xlim(0, 100)
    for spine in ["top", "right", "left"]:
        ax.spines[spine].set_visible(False)
    ax.spines["bottom"].set_color("#D0D5D4")
    ax.tick_params(axis="x", labelsize=9.5, colors=MPL_INK_MUTED)
    ax.tick_params(axis="y", length=0)
    ax.set_axisbelow(True)
    ax.xaxis.grid(True, color="#E7ECEB", linewidth=0.8)
    for bar, val, bar_color in zip(bars, all16_values, ALL_16_COLORS):
        ax.text(val - 3, bar.get_y() + bar.get_height() / 2, f"{val}", va="center", ha="right",
                fontsize=10.5, fontweight="bold", color=label_color_for_bg(bar_color), family="DM Sans")
    plt.tight_layout()
    plt.savefig(path, transparent=True, bbox_inches="tight")
    plt.close()


def page_all16_chart(c):
    new_page(c, 36, "Your Church Summary Profile", "Journey Pathways in\nOur Church", title_size=23)
    y = PAGE_H - MARGIN - 1.55 * inch
    c.setFont("Inter", 10.2)
    c.setFillColor(INK_MUTED)
    c.drawString(MARGIN, y, "Average % who agree this is true of them across all questions on each pathway.")
    chart_path = f"{ASSET_DIR}/all16_chart.png"
    make_all16_chart(chart_path)
    chart_w = PAGE_W - 2 * MARGIN
    footer_top = 0.62 * inch + 0.2 * inch
    max_h = y - footer_top
    draw_chart_image_fit(c, chart_path, MARGIN, chart_w, y, max_h, anchor="top")


def make_maturity_line_chart(path):
    labels = ["Believing\nGod's Story", "Receive\nGod's Love", "Identity\nin Jesus", "Face\nChallenges",
              "Respond\nto God", "Commune\nwith God", "Growing\nMy Faith", "Worship\nGod",
              "Express\nGod's Love", "Practice\nFaith", "Journey\nwith Others", "Reconcile /\nForgive",
              "Partner\nwith God", "Steward\nResources", "Show\nCompassion", "Act\nJustly"]
    believing = REPORT_DATA.maturity_line_believing
    trusting = REPORT_DATA.maturity_line_trusting
    centered = REPORT_DATA.maturity_line_centered

    x = np.arange(len(labels))
    fig, ax = plt.subplots(figsize=(9.2, 5.2), dpi=220)
    ax.plot(x, believing, color=MPL_TEAL_LIGHT, marker="o", markersize=4, linewidth=2, label="Believing")
    ax.plot(x, trusting, color=MPL_CORAL, marker="o", markersize=4, linewidth=2, label="Trusting")
    ax.plot(x, centered, color=MPL_SAND, marker="o", markersize=4, linewidth=2.3, label="Centered")
    ax.set_xticks(x)
    ax.set_xticklabels(labels, fontsize=7.6, rotation=45, ha="right", family="Inter", color=MPL_INK_MUTED)
    ax.set_ylim(0, 100)
    ax.tick_params(axis="y", labelsize=9, colors=MPL_INK_MUTED)
    for spine in ["top", "right"]:
        ax.spines[spine].set_visible(False)
    ax.spines["left"].set_color("#D0D5D4")
    ax.spines["bottom"].set_color("#D0D5D4")
    ax.yaxis.grid(True, color="#E7ECEB", linewidth=0.8)
    ax.set_axisbelow(True)
    ax.legend(loc="lower left", frameon=False, fontsize=10, ncol=3, bbox_to_anchor=(0, -0.42))
    plt.tight_layout()
    plt.savefig(path, transparent=True, bbox_inches="tight")
    plt.close()


def page_maturity_comparison(c):
    new_page(c, 37, "Your Church Summary Profile", "Journey Pathways Summary")
    y = PAGE_H - MARGIN - 1.05 * inch
    c.setFont("Inter", 10.2)
    c.setFillColor(INK_MUTED)
    c.drawString(MARGIN, y, "Comparison across levels of spiritual maturity \u2014 average % who agree")
    y -= 0.16 * inch
    c.drawString(MARGIN, y, "this is true for them, for all questions on each Journey pathway.")

    chart_path = f"{ASSET_DIR}/maturity_line.png"
    make_maturity_line_chart(chart_path)
    chart_w = PAGE_W - 2 * MARGIN
    footer_top = 0.62 * inch + 0.25 * inch
    max_h = y - footer_top
    draw_chart_image_fit(c, chart_path, MARGIN, chart_w, y, max_h, anchor="top")


def page_reflecting(c):
    new_page(c, 38, "Reflecting on Your Jesus Journey Report", "Understanding Your\nCommunity", title_size=23)
    y = PAGE_H - MARGIN - 1.6 * inch
    text0 = ("This report is a picture of your community. You may see things that you did not know or "
             "now need to understand better. We hope it gives you information that you can pray over "
             "together, and make whatever adjustments your church needs to grow stronger in your "
             "journey with Jesus.")
    y = draw_body_paragraph(c, MARGIN, y, text0, PAGE_W - 2 * MARGIN, size=10.4, leading=15)
    y -= 0.14 * inch
    c.setFont("Inter-SemiBold", 11)
    c.setFillColor(TEAL_DARK)
    c.drawString(MARGIN, y, "Here are some questions to begin your reflections and conversations:")
    y -= 0.28 * inch

    questions = [
        "Any surprises in your church demographics? Any worries to highlight? (pages 6\u20138)",
        "How well are your people getting connected? How about small groups or volunteering? (page 9)",
        "What is your church mix of spiritual maturity? Who are your less mature people? (pages 10\u201313)",
        "Are your people growing or fading in their spiritual maturity? Who is not growing? (pages 14\u201316)",
        "Which Trusting Jesus Pathways are doing well; which are not? (pages 19\u201322)",
        "Which Experiencing Jesus Pathways deserve your focus and attention? (pages 23\u201326)",
        "How big are the differences between less mature and more Jesus-centered people on the Reflecting Jesus Pathways? (pages 27\u201330)",
        "How well are your people doing on the Serving Jesus Pathways? (pages 31\u201334)",
        "Overall, what patterns are you pleased to see? Which concern you most? (pages 35\u201337)",
    ]
    items = [(None, q) for q in questions]
    y = draw_bullet_block(c, MARGIN, y, items, PAGE_W - 2 * MARGIN, size=9.8, leading=13.5, gap=9)

    y -= 0.1 * inch
    card_h = 0.75 * inch
    c.setFillColor(SURFACE)
    c.roundRect(MARGIN, y - card_h, PAGE_W - 2 * MARGIN, card_h, 6, fill=1, stroke=0)
    c.setStrokeColor(TEAL)
    c.setLineWidth(2.4)
    c.line(MARGIN, y - card_h, MARGIN, y)
    c.setFont("Inter", 10.8)
    c.setFillColor(TEAL_DARK)
    c.drawCentredString(PAGE_W / 2, y - 0.32 * inch,
                         "\u201cMany are the plans in the mind of man, but it is the purpose")
    c.drawCentredString(PAGE_W / 2, y - 0.54 * inch, "of the Lord that will stand.\u201d \u2014 Proverbs 19:21 (ESV)")


# ============================================================
# MAIN
# ============================================================

OUT_PATH = "/home/user/workspace/report_mockup/full_report.pdf"


def main():
    out_path = OUT_PATH
    c = canvas.Canvas(out_path, pagesize=letter)
    c.setTitle(f"Our Journey with Jesus Report — {REPORT_DATA.church_name}")
    c.setAuthor("Jesus Journey Survey")

    # Cover + TOC
    page_cover(c); c.showPage()
    page_toc(c); c.showPage()

    # Interpreting (3-5)
    page_interpreting_1(c); c.showPage()
    page_interpreting_2(c); c.showPage()
    page_interpreting_3(c); c.showPage()

    # Church Profile (6-9)
    page_profile_intro(c); c.showPage()
    page_demographics_1(c); c.showPage()
    page_demographics_2(c); c.showPage()
    page_engagement(c); c.showPage()

    # Maturity Profile (10-13)
    page_maturity_donut(c); c.showPage()
    page_maturity_diversity_1(c); c.showPage()
    page_maturity_diversity_2(c); c.showPage()

    page_change_intro(c); c.showPage()
    page_change_profile(c); c.showPage()
    page_diversity_table(c); c.showPage()
    page_change_diversity_2(c); c.showPage()

    # Jesus Journey Profile intro (17-19)
    page_jj_profile_intro(c); c.showPage()
    page_jj_goals_overview(c); c.showPage()

    goal1_pathways = [
        ("Believing God's Story", "God the Creator is completely renewing the world from its broken state.",
         ["5 questions on beliefs about God's character and plan to renew creation.",
          "How much do I believe in God's good plans for all of creation? (Jeremiah 29:11)"]),
        ("Receiving God's Love", "I am secure in God's unconditional love for me.",
         ["4 questions on believing and being secure in God's unconditional love.",
          "How much do I believe that God actively loves and cares for me? (John 15:9\u201313)"]),
        ("My Identity in God", "My identity is rooted in the way God sees me.",
         ["3 questions on seeing oneself as rooted in how God truly sees each person.",
          "How secure is my identity in Jesus and God's good intentions for me? (1 John 3:1)"]),
        ("Facing Challenges", "I trust in God's commitment to me in the midst of challenge.",
         ["3 questions on trusting God's commitment in the midst of challenges.",
          "How able am I to experience God's peace even when challenges come? (Philippians 4:6)"]),
    ]
    page_goal_intro(c, 19, 1, "Trusting Jesus", "How well do I know God's story and trust Jesus with my life?", goal1_pathways)
    c.showPage()

    pathway_result_page(c, 20, "Trusting Jesus", REPORT_DATA.pathway_results[1][0:2]); c.showPage()

    pathway_result_page(c, 21, "Trusting Jesus", REPORT_DATA.pathway_results[1][2:4]); c.showPage()

    goal_summary_chart_page(c, 22, 1, "Trusting Jesus",
                             REPORT_DATA.goal_summaries[1]["labels"],
                             REPORT_DATA.goal_summaries[1]["values"], MPL_TEAL); c.showPage()

    goal2_pathways = [
        ("Responding to God", "I am sensitive to God's leading and respond to God's will.",
         ["4 questions on sensitivity to God's leading and responding to God's will.",
          "How aware and open am I to being guided by God day-to-day? (Romans 12:1\u20132)"]),
        ("Communicating with God", "My relationship with God is strengthened by frequent and meaningful communication.",
         ["4 questions on faithfully communicating with God as a basis for relationship.",
          "How often do I pray and seek God's guidance for my life? (1 Thessalonians 5:17\u201318)"]),
        ("Growing My Faith", "I intentionally respond to the invitation of God in tangible ways.",
         ["4 questions on intentionally responding to God's invitation in tangible ways.",
          "How faithful am I in setting aside time to develop practices that draw me close to God? (1 Tim. 4:8)"]),
        ("Worshiping God", "I take time individually and with others to express my gratitude and commitment to God.",
         ["3 questions on taking time to express gratitude to God, personally and with others.",
          "How often do I express praise and thankfulness to God for acting in my life? (Psalms 86:12)"]),
    ]
    page_goal_intro(c, 23, 2, "Experiencing Jesus", "How well do I know God's story and trust Jesus with my life?", goal2_pathways)
    c.showPage()

    pathway_result_page(c, 24, "Experiencing Jesus", REPORT_DATA.pathway_results[2][0:2]); c.showPage()

    pathway_result_page(c, 25, "Experiencing Jesus", REPORT_DATA.pathway_results[2][2:4]); c.showPage()

    goal_summary_chart_page(c, 26, 2, "Experiencing Jesus",
                             REPORT_DATA.goal_summaries[2]["labels"],
                             REPORT_DATA.goal_summaries[2]["values"], MPL_TEAL_LIGHT); c.showPage()

    goal3_pathways = [
        ("Expressing God's Love", "A central goal of my life is to be an expression of God's love.",
         ["5 questions on loving others as an expression of God's love working through me.",
          "How is my love for God reflected in how I treat others? (1 John 4:11\u201312)"]),
        ("Practicing My Faith", "I express my faith by practically acting as I believe Jesus would act.",
         ["5 questions on translating belief into practical, everyday action.",
          "How consistently does my behavior reflect what I believe? (James 2:14\u201318)"]),
        ("Journeying with Others", "I walk out my Jesus journey in a give-and-take relationship with others.",
         ["4 questions on mutual, honest relationships that support spiritual growth.",
          "Do I have people I trust to walk this journey alongside me? (Hebrews 10:24\u201325)"]),
        ("Reconciling", "I embrace others as they are and am committed to asking for and releasing forgiveness.",
         ["3 questions on pursuing reconciliation and forgiveness in relationships.",
          "How readily do I extend and receive forgiveness? (Colossians 3:13)"]),
    ]
    page_goal_intro(c, 27, 3, "Reflecting Jesus", "How much does my life reflect the character and love of Jesus?", goal3_pathways)
    c.showPage()

    pathway_result_page(c, 28, "Reflecting Jesus", REPORT_DATA.pathway_results[3][0:2]); c.showPage()

    pathway_result_page(c, 29, "Reflecting Jesus", REPORT_DATA.pathway_results[3][2:4]); c.showPage()

    goal_summary_chart_page(c, 30, 3, "Reflecting Jesus",
                             REPORT_DATA.goal_summaries[3]["labels"],
                             REPORT_DATA.goal_summaries[3]["values"], MPL_CORAL); c.showPage()

    goal4_pathways = [
        ("Partnering with God", "I live my life in an active partnership with God.",
         ["5 questions on seeing ourselves as partnering with God in serving others.",
          "How aware are we of God's presence in our relationships with others? (Colossians 3:12)"]),
        ("Stewarding Resources", "I act as a steward, not an owner of the resources available to me.",
         ["4 questions on willingness to yield all we have to God's service.",
          "How much do I see what I have as mine, or as a gift to use for God's purposes? (Matthew 6:19\u201324)"]),
        ("Showing Compassion", "God's compassion moves me to be a vehicle of God's grace to people in need.",
         ["4 questions on responding to the needs of others with compassion.",
          "Do I see the needs of others and respond with Godly kindness and grace? (James 2:14\u201318)"]),
        ("Acting Justly", "I fulfill God's heart by advocating for the weak and powerless.",
         ["3 questions on responsiveness to injustice and people who are not always accepted.",
          "How sensitive am I to community and personal injustices? (Luke 10:30\u201337)"]),
    ]
    page_goal_intro(c, 31, 4, "Serving Jesus", "How much of my life involves seeing needs and serving others?", goal4_pathways)
    c.showPage()

    pathway_result_page(c, 32, "Serving Jesus", REPORT_DATA.pathway_results[4][0:2]); c.showPage()

    pathway_result_page(c, 33, "Serving Jesus", REPORT_DATA.pathway_results[4][2:4]); c.showPage()

    goal_summary_chart_page(c, 34, 4, "Serving Jesus",
                             REPORT_DATA.goal_summaries[4]["labels"],
                             REPORT_DATA.goal_summaries[4]["values"], MPL_SAND); c.showPage()

    # Summary Profile (35-37)
    page_summary_intro(c); c.showPage()
    page_all16_chart(c); c.showPage()
    page_maturity_comparison(c); c.showPage()

    # Reflecting (38)
    page_reflecting(c); c.showPage()

    c.save()
    print("Wrote", out_path)


if __name__ == "__main__":
    main()
