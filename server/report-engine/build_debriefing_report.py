"""
build_debriefing_report.py -- standalone PDF renderer for the Journey Survey
Debriefing Report: an admin-only, internal analysis document (NOT the
client-facing church report). Reuses the exact visual chrome established in
build_comments_report.py / build_full_report.py (fonts, palette, logo, cover
photo, footer) so the family of reports feels consistent, but the tone here
is an analyst brief rather than a church-facing gift -- every page carries a
small "ADMIN ONLY -- INTERNAL USE" tag.

Renders the DebriefingReport shape defined in shared/debriefing/types.ts, in
the exact section order required by the build spec:

  1. Cover page
  2. Executive Summary (Strengths to Celebrate / Opportunities to Explore)
  3. Demographic Observations (per demographics[] section)
  4. Engagement Observations
  5. Spiritual Maturity & Change Observations
  6. Pathway Observations by Goal
  7. Dimension-Level View
  8. Discipleship Bottleneck Map
  9. Cross-Cutting Insights
  10. Suggested Debrief Questions
  (+ Data Notes / caveats block at the end)

Entry point: build_debriefing_report_pdf(out_path, report) -> bool
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

# ---- Palette (matches build_full_report.py / build_comments_report.py) ----
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

# Insight kind -> accent color (used everywhere an Insight is rendered, not
# just the executive summary, per the spec).
KIND_COLOR = {"strength": TEAL, "opportunity": CORAL}
KIND_LABEL = {"strength": "STRENGTH", "opportunity": "OPPORTUNITY"}

PAGE_W, PAGE_H = letter
MARGIN = 0.75 * inch

LOGO_PATH = f"{_STATIC_ASSET_DIR}/jj_logo.png"
COVER_PHOTO = f"{_STATIC_ASSET_DIR}/cover_map_photo.png"

ADMIN_TAG = "ADMIN ONLY \u2014 INTERNAL USE"

CONTENT_TOP = PAGE_H - MARGIN - 1.35 * inch
CONTENT_BOTTOM = 0.85 * inch


# ============================================================
# Shared chrome
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

    c.setFont("Inter-SemiBold", 7.6)
    c.setFillColor(CORAL)
    c.drawCentredString(PAGE_W / 2, 0.395 * inch, ADMIN_TAG)

    c.setFont("Inter-Medium", 9)
    c.setFillColor(HexColor("#CFE3E1"))
    c.drawRightString(PAGE_W - MARGIN, 0.24 * inch, f"pg {page_num}")
    c.restoreState()


def draw_admin_chip(c, x, y):
    """Small coral 'ADMIN ONLY' chip used near the top of content pages."""
    c.saveState()
    label = ADMIN_TAG
    c.setFont("Inter-SemiBold", 7.4)
    tw = c.stringWidth(label, "Inter-SemiBold", 7.4)
    chip_w = tw + 0.22 * inch
    chip_h = 0.19 * inch
    c.setFillColor(CORAL)
    c.roundRect(x, y - chip_h, chip_w, chip_h, chip_h / 2, fill=1, stroke=0)
    c.setFillColor(HexColor("#FFFFFF"))
    c.drawCentredString(x + chip_w / 2, y - chip_h + 0.055 * inch, label)
    c.restoreState()
    return chip_w


def draw_header(c, kicker, title, title_size=23):
    y = PAGE_H - MARGIN
    chip_w = draw_admin_chip(c, PAGE_W - MARGIN - 1.55 * inch, y + 0.03 * inch)

    c.setFillColor(TEAL)
    c.setFont("Inter-SemiBold", 10.5)
    c.drawString(MARGIN, y - 2, kicker.upper())
    c.setStrokeColor(TEAL)
    c.setLineWidth(1.4)
    c.line(MARGIN, y - 10, MARGIN + 0.34 * inch, y - 10)

    c.setFillColor(INK)
    c.setFont("DMSans-Bold", title_size)
    lines = title.split("\n")
    ty = y - 38
    for ln in lines:
        c.drawString(MARGIN, ty, ln)
        ty -= title_size * 1.12


def new_page(c, page_num, kicker, title, church_name, report_date, title_size=23):
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
            if cur:
                lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines or [""]


def draw_body_paragraph(c, x, y, text, max_width, size=10.5, leading=15, color=INK_MUTED, font="Inter"):
    lines = wrapped_lines(c, text, font, size, max_width)
    c.setFont(font, size)
    c.setFillColor(color)
    for line in lines:
        c.drawString(x, y, line)
        y -= leading
    return y


def measure_paragraph_height(c, text, font, size, leading, max_width):
    lines = wrapped_lines(c, text, font, size, max_width)
    return len(lines) * leading


def fmt_num(v, digits=2):
    if v is None:
        return "\u2014"
    try:
        return f"{float(v):.{digits}f}"
    except (TypeError, ValueError):
        return str(v)


def fmt_pct(v, digits=1):
    if v is None:
        return "\u2014"
    try:
        return f"{float(v):.{digits}f}%"
    except (TypeError, ValueError):
        return str(v)


def fmt_delta(v, digits=2):
    if v is None:
        return "\u2014"
    try:
        v = float(v)
    except (TypeError, ValueError):
        return str(v)
    sign = "+" if v > 0 else ("" if v == 0 else "\u2212")
    return f"{sign}{abs(v):.{digits}f}"


# ============================================================
# Flowing-page engine: a tiny helper so every section below can
# emit content top-to-bottom and roll to a fresh chrome-wrapped
# page automatically when space runs out.
# ============================================================

class Flow:
    """Tracks (page_num, y) and knows how to start a new page with the
    right kicker/title chrome whenever content would overflow."""

    def __init__(self, c, church_name, report_date, page_num, kicker, title, title_size=23):
        self.c = c
        self.church_name = church_name
        self.report_date = report_date
        self.page_num = page_num
        self.kicker = kicker
        self.title = title
        self.title_size = title_size
        self._start_page(first=True)

    def _start_page(self, first=False):
        self.c.showPage()
        if not first:
            self.page_num += 1
        new_page(self.c, self.page_num, self.kicker, self.title, self.church_name,
                  self.report_date, self.title_size)
        self.y = CONTENT_TOP

    def ensure(self, needed_h):
        """Roll to a new page if `needed_h` won't fit before CONTENT_BOTTOM."""
        if self.y - needed_h < CONTENT_BOTTOM:
            self._start_page()

    def set_section(self, kicker, title, title_size=23):
        """Switch chrome for subsequent pages within the same flow (used
        when one Flow instance spans more than one logical report section,
        e.g. continuing into a new numbered section on overflow)."""
        self.kicker = kicker
        self.title = title
        self.title_size = title_size


# ============================================================
# Small reusable drawing primitives
# ============================================================

def section_divider(c, x, y, w, label, color=TEAL_DARK):
    """A slim colored bar with a label -- used for sub-section headers
    (goal groups, demographic sections, etc.)."""
    bar_h = 0.30 * inch
    c.setFillColor(color)
    c.roundRect(x, y - bar_h, w, bar_h, 4, fill=1, stroke=0)
    c.setFillColor(HexColor("#FFFFFF"))
    c.setFont("Inter-SemiBold", 11)
    c.drawString(x + 0.14 * inch, y - bar_h + 0.095 * inch, label)
    return y - bar_h


# Consistent gap reserved above every plain-text subheading ("Maturity
# Distribution", "INSIGHTS", etc.) so headings never sit flush against
# whatever content (table, card, insight block) preceded them. Also used
# as the gap reserved above a colored section-divider banner.
HEADING_GAP_BEFORE = 0.22 * inch
HEADING_BLOCK_H = 0.30 * inch  # space the heading text itself occupies


def draw_subheading(flow, text, size=11.5, color=TEAL_DARK, min_trailing=0.0,
                     gap_before=HEADING_GAP_BEFORE):
    """Draws a plain-text subheading (e.g. 'Maturity Distribution',
    'INSIGHTS') via `flow`, guaranteeing:
      1. a consistent gap above it, regardless of what preceded it
         (table, card, another block) -- fixes headings landing flush
         against the element above them;
      2. that it is never left as the last thing on a page with no body
         content following -- by reserving `min_trailing` worth of body
         height (the first row/item's height) together with the heading
         in a single `ensure()` call, so a page break (if needed) happens
         *before* the heading instead of after it.
    Returns nothing; advances flow.y past the heading.
    """
    flow.ensure(gap_before + HEADING_BLOCK_H + min_trailing)
    flow.y -= gap_before
    c = flow.c
    c.setFont("Inter-SemiBold", size)
    c.setFillColor(color)
    c.drawString(MARGIN, flow.y, text)
    flow.y -= HEADING_BLOCK_H


def draw_banner_heading(flow, label, color=TEAL_DARK, min_trailing=0.0,
                         gap_before=HEADING_GAP_BEFORE):
    """Same orphan-avoidance guarantee as draw_subheading, but for the
    colored section_divider banner style (executive summary, demographic
    sections, pathway goal groups). Reserves gap + banner height +
    min_trailing atomically before drawing, so the banner is never the
    last element on a page with no body content beneath it."""
    bar_h = 0.30 * inch
    flow.ensure(gap_before + bar_h + min_trailing)
    flow.y -= gap_before
    flow.y = section_divider(flow.c, MARGIN, flow.y, PAGE_W - 2 * MARGIN, label, color)


def kind_tag(c, x, y, kind):
    """Small colored pill tag ('STRENGTH' / 'OPPORTUNITY') drawn inline."""
    color = KIND_COLOR.get(kind, INK_MUTED)
    label = KIND_LABEL.get(kind, kind.upper() if kind else "")
    c.setFont("Inter-SemiBold", 6.9)
    tw = c.stringWidth(label, "Inter-SemiBold", 6.9)
    pad = 0.09 * inch
    chip_w = tw + 2 * pad
    chip_h = 0.155 * inch
    c.setFillColor(color)
    c.roundRect(x, y, chip_w, chip_h, chip_h / 2, fill=1, stroke=0)
    c.setFillColor(HexColor("#FFFFFF"))
    c.drawCentredString(x + chip_w / 2, y + 0.043 * inch, label)
    return chip_w


def directional_note(c, x, y, note="directional only \u00b7 n<15"):
    c.setFont("Inter-Medium", 7.6)
    c.setFillColor(OLIVE)
    c.drawString(x, y, f"\u25b3 {note}")


def measure_insight_height(c, insight, max_width, indent=0.0):
    """Height needed to render one Insight block (tag + headline + detail
    [+ directional-only note])."""
    tw = max_width - indent
    h_lines = wrapped_lines(c, insight.get("headline", ""), "Inter-SemiBold", 10.3, tw)
    d_lines = wrapped_lines(c, insight.get("detail", ""), "Inter", 9.6, tw)
    h = 0.20 * inch  # tag row
    h += len(h_lines) * 13.4
    h += len(d_lines) * 12.6
    if insight.get("directionalOnly"):
        h += 0.16 * inch
    h += 10  # gap after block
    return h


def draw_insight_block(c, x, y, insight, max_width):
    """Draws a single Insight: kind tag, bold headline, regular detail,
    directional-only flag if applicable. Returns new y."""
    kind = insight.get("kind", "")
    kind_tag(c, x, y - 0.135 * inch, kind)
    y -= 0.135 * inch + 0.20 * inch

    h_lines = wrapped_lines(c, insight.get("headline", ""), "Inter-SemiBold", 10.3, max_width)
    c.setFont("Inter-SemiBold", 10.3)
    c.setFillColor(INK)
    for ln in h_lines:
        c.drawString(x, y, ln)
        y -= 13.4

    d_lines = wrapped_lines(c, insight.get("detail", ""), "Inter", 9.6, max_width)
    c.setFont("Inter", 9.6)
    c.setFillColor(INK_MUTED)
    for ln in d_lines:
        c.drawString(x, y, ln)
        y -= 12.6

    if insight.get("directionalOnly"):
        directional_note(c, x, y - 0.02 * inch)
        y -= 0.16 * inch

    return y - 10


def draw_insight_list(flow, insights, indent=0.0, heading=None):
    """Flows a list of Insight dicts down the page via `flow`, starting new
    pages as needed. Skips entirely (no heading) if the list is empty --
    per spec, an empty Insights list must not render an empty header."""
    if not insights:
        return
    x = MARGIN + indent
    w = PAGE_W - 2 * MARGIN - indent

    if heading:
        # Reserve the heading together with the *first* insight's height in
        # one atomic check, so a page break -- if one is needed -- happens
        # before the heading, never leaving the heading orphaned alone at
        # the bottom of a page with its insights stranded on the next one.
        first_h = measure_insight_height(flow.c, insights[0], w, indent)
        draw_subheading(flow, heading, min_trailing=first_h)

    for insight in insights:
        needed = measure_insight_height(flow.c, insight, w)
        flow.ensure(needed)
        flow.y = draw_insight_block(flow.c, x, flow.y, insight, w)


def draw_two_col_bullets(flow, left_title, left_items, left_color, right_title, right_items, right_color):
    """Executive-summary style: renders left/right insight lists stacked
    (full width) each under a colored section title -- used because insight
    detail text needs full page width to stay legible."""
    w = PAGE_W - 2 * MARGIN
    for title, items, color in ((left_title, left_items, left_color), (right_title, right_items, right_color)):
        c = flow.c
        # Reserve the banner together with either its first item's height,
        # or the empty-state line's height, in one atomic check -- so the
        # banner is never left as the last element on a page with no body
        # content beneath it (a page break, if needed, happens before the
        # banner instead of after it).
        min_trailing = measure_insight_height(c, items[0], w) if items else 0.22 * inch
        draw_banner_heading(flow, title, color, min_trailing=min_trailing, gap_before=0.12 * inch)
        flow.y -= 0.18 * inch
        if not items:
            c.setFont("Inter", 9.8)
            c.setFillColor(INK_MUTED)
            c.drawString(MARGIN, flow.y, "No items flagged for this wave.")
            flow.y -= 0.30 * inch
            continue
        for insight in items:
            needed = measure_insight_height(c, insight, w)
            flow.ensure(needed)
            flow.y = draw_insight_block(c, MARGIN, flow.y, insight, w)
        flow.y -= 0.10 * inch


# ---- simple ranked table (used for dimension rollups, demographic
# breakdowns, funnel, crosstabs) ----

def table_heading_min_trailing(headers, rows, row_h=0.26 * inch):
    """Height of a table's header row + first data row -- used as the
    `min_trailing` amount when reserving space for a heading that
    introduces a table, so the heading is never orphaned from its table."""
    if not rows:
        return row_h
    return row_h * 2


def draw_table(flow, headers, rows, col_widths, row_h=0.26 * inch, header_color=TEAL_DARK,
               zebra=True, font_size=8.6, note_col=None):
    """rows: list of list[str]. note_col: optional index whose cell should be
    rendered in OLIVE italic-ish small font (used for 'directional only')."""
    c = flow.c
    total_w = sum(col_widths)
    x0 = MARGIN

    def draw_header_row():
        flow.ensure(row_h + 0.02 * inch)
        c.setFillColor(header_color)
        c.rect(x0, flow.y - row_h, total_w, row_h, fill=1, stroke=0)
        c.setFont("Inter-SemiBold", font_size)
        c.setFillColor(HexColor("#FFFFFF"))
        cx = x0
        for h, w in zip(headers, col_widths):
            c.drawString(cx + 0.06 * inch, flow.y - row_h + 0.085 * inch, h)
            cx += w
        flow.y -= row_h

    draw_header_row()
    for i, row in enumerate(rows):
        if flow.y - row_h < CONTENT_BOTTOM:
            flow._start_page()
            draw_header_row()
        if zebra and i % 2 == 1:
            c.setFillColor(SURFACE)
            c.rect(x0, flow.y - row_h, total_w, row_h, fill=1, stroke=0)
        c.setStrokeColor(BORDER)
        c.setLineWidth(0.4)
        c.line(x0, flow.y - row_h, x0 + total_w, flow.y - row_h)
        cx = x0
        for ci, (val, w) in enumerate(zip(row, col_widths)):
            color = OLIVE if (note_col is not None and ci == note_col) else INK
            c.setFont("Inter", font_size)
            c.setFillColor(color)
            c.drawString(cx + 0.06 * inch, flow.y - row_h + 0.085 * inch, str(val))
            cx += w
        flow.y -= row_h
    flow.y -= 0.14 * inch


# ============================================================
# 1. Cover page
# ============================================================

def page_cover(c, report):
    church_name = report.get("churchName", "")
    wave_label = report.get("waveLabel", "")
    respondent_count = report.get("respondentCount", 0)
    report_date = _format_date(report.get("generatedAt", ""))

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

    # Desaturating, darker scrim than the client-facing cover -- this
    # should read as an internal analyst brief, not a gift.
    c.saveState()
    c.setFillColor(HexColor("#0C1E1F"), alpha=0.55)
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    c.restoreState()

    scrim_h = 3.6 * inch
    steps = 40
    for i in range(steps):
        frac = i / steps
        alpha = 0.78 * (frac ** 1.4)
        c.saveState()
        c.setFillColor(HexColor("#0C1E1F"), alpha=alpha)
        c.rect(0, scrim_h * (1 - (i + 1) / steps), PAGE_W, scrim_h / steps + 1, fill=1, stroke=0)
        c.restoreState()

    # Admin-only tag banner near the top
    c.saveState()
    label = ADMIN_TAG
    c.setFont("Inter-SemiBold", 10.5)
    tw = c.stringWidth(label, "Inter-SemiBold", 10.5)
    chip_w = tw + 0.5 * inch
    chip_h = 0.36 * inch
    chip_x = (PAGE_W - chip_w) / 2
    chip_y = PAGE_H - 1.05 * inch
    c.setFillColor(CORAL)
    c.roundRect(chip_x, chip_y, chip_w, chip_h, chip_h / 2, fill=1, stroke=0)
    c.setFillColor(HexColor("#FFFFFF"))
    c.drawCentredString(PAGE_W / 2, chip_y + 0.115 * inch, label)
    c.restoreState()

    c.setFillColor(HexColor("#FFFFFF"))
    c.setFont("DMSans-Bold", 32)
    c.drawCentredString(PAGE_W / 2, 2.35 * inch, "Debriefing Report")
    c.setFont("Inter", 14)
    c.setFillColor(HexColor("#E7F1EF"))
    c.drawCentredString(PAGE_W / 2, 1.95 * inch, f"Internal analysis \u2014 {church_name}")
    c.setFont("Inter-Medium", 11.5)
    c.setFillColor(TEAL_LIGHT)
    c.drawCentredString(PAGE_W / 2, 1.62 * inch,
                         f"{wave_label}  \u2022  {respondent_count} respondents  \u2022  {report_date}")
    c.setFont("Inter", 9.5)
    c.setFillColor(HexColor("#BFD3D1"))
    c.drawCentredString(PAGE_W / 2, 1.32 * inch,
                         "Prepared for staff and analysts. Not intended for distribution to the congregation.")

    c.setFillColor(TEAL_DARK)
    c.rect(0, 0, PAGE_W, 0.62 * inch, fill=1, stroke=0)
    logo_h = 0.34 * inch
    logo_w = logo_h * (470 / 165)
    lx, ly = MARGIN, (0.62 * inch - logo_h) / 2 + 0.09 * inch
    c.drawImage(LOGO_PATH, lx, ly, width=logo_w, height=logo_h, mask="auto")
    c.setFont("Inter-SemiBold", 7.6)
    c.setFillColor(HexColor("#FFFFFF"))
    c.drawString(lx + 0.02 * inch, ly - 0.135 * inch, "J E S U S   J O U R N E Y")
    c.setFont("Inter-SemiBold", 7.6)
    c.setFillColor(CORAL)
    c.drawRightString(PAGE_W - MARGIN, ly - 0.055 * inch, ADMIN_TAG)


def _format_date(iso_str):
    if not iso_str:
        return ""
    try:
        # tolerate "2026-09-10T..." or plain date
        date_part = iso_str.split("T")[0]
        y, m, d = date_part.split("-")
        months = ["", "January", "February", "March", "April", "May", "June", "July",
                  "August", "September", "October", "November", "December"]
        return f"{months[int(m)]} {int(d)}, {y}"
    except Exception:
        return iso_str


# ============================================================
# 2. Executive Summary
# ============================================================

def render_executive_summary(c, report, church_name, report_date, page_num):
    flow = Flow(c, church_name, report_date, page_num, "Executive Summary",
                "Strengths & Opportunities", title_size=22)
    exec_summary = report.get("executiveSummary", {}) or {}
    flow.y -= 0.06 * inch

    flow.c.setFont("Inter", 10)
    flow.c.setFillColor(INK_MUTED)
    intro = ("The items below are ranked by corroboration \u2014 how many independent "
             "analyses in this wave point the same direction. Higher corroboration means "
             "higher confidence this is a real pattern, not noise.")
    flow.y = draw_body_paragraph(flow.c, MARGIN, flow.y, intro, PAGE_W - 2 * MARGIN,
                                  size=9.8, leading=13.6, color=INK_MUTED)
    flow.y -= 0.12 * inch

    draw_two_col_bullets(
        flow,
        "STRENGTHS TO CELEBRATE", exec_summary.get("strengths") or [], TEAL,
        "OPPORTUNITIES TO EXPLORE", exec_summary.get("opportunities") or [], CORAL,
    )
    return flow.page_num + 1


# ============================================================
# 3. Demographic Observations
# ============================================================

DEMO_TABLE_HEADERS = ["Group", "n", "% church", "Avg maturity", "vs church", "Growing %", "Fading %"]


def render_demographics(c, report, church_name, report_date, page_num):
    demographics = report.get("demographics") or []
    flow = Flow(c, church_name, report_date, page_num, "Demographic Observations",
                "Demographic Observations", title_size=22)
    flow.y -= 0.04 * inch

    if not demographics:
        flow.c.setFont("Inter", 10)
        flow.c.setFillColor(INK_MUTED)
        flow.c.drawString(MARGIN, flow.y, "No demographic sections available for this wave.")
        return flow.page_num + 1

    for section in demographics:
        title = section.get("title", section.get("id", ""))
        breakdown = section.get("breakdown") or []
        insights = section.get("insights") or []
        # First body element under this banner is either the breakdown
        # table's header+first row, or the first insight, or (if both are
        # empty) nothing extra -- reserve whichever applies so the banner
        # never lands alone at the bottom of a page.
        if breakdown:
            banner_trailing = table_heading_min_trailing([], breakdown)
        elif insights:
            banner_trailing = measure_insight_height(flow.c, insights[0], PAGE_W - 2 * MARGIN)
        else:
            banner_trailing = 0.0
        draw_banner_heading(flow, title.upper(), TEAL_DARK, min_trailing=banner_trailing)
        flow.y -= 0.16 * inch

        if breakdown:
            col_w = [1.7 * inch, 0.45 * inch, 0.72 * inch, 0.85 * inch, 0.75 * inch, 0.75 * inch, 1.03 * inch]
            rows = []
            has_directional = False
            for r in breakdown:
                group_label = r.get("group", "")
                if r.get("directionalOnly"):
                    group_label += "  \u25b3"
                    has_directional = True
                rows.append([
                    group_label,
                    str(r.get("n", "")),
                    fmt_pct(r.get("pctOfChurch")),
                    fmt_num(r.get("avgMaturity")),
                    fmt_delta(r.get("maturityVsChurch")),
                    fmt_pct(r.get("growingPct")),
                    fmt_pct(r.get("fadingPct")),
                ])
            draw_table(flow, DEMO_TABLE_HEADERS, rows, col_w)
            if has_directional:
                flow.ensure(0.2 * inch)
                directional_note(flow.c, MARGIN, flow.y, "directional only \u00b7 group n<15")
                flow.y -= 0.24 * inch

        draw_insight_list(flow, insights)
        flow.y -= 0.08 * inch

    return flow.page_num + 1


# ============================================================
# 4. Engagement Observations
# ============================================================

def render_engagement(c, report, church_name, report_date, page_num):
    engagement = report.get("engagement", {}) or {}
    flow = Flow(c, church_name, report_date, page_num, "Engagement Observations",
                "Engagement Observations", title_size=22)
    flow.y -= 0.06 * inch

    insights = engagement.get("insights") or []
    if not insights:
        flow.c.setFont("Inter", 10)
        flow.c.setFillColor(INK_MUTED)
        flow.c.drawString(MARGIN, flow.y, "No engagement-pattern insights were flagged for this wave.")
        return flow.page_num + 1

    draw_insight_list(flow, insights)
    return flow.page_num + 1


# ============================================================
# 5. Spiritual Maturity & Change Observations
# ============================================================

def render_maturity(c, report, church_name, report_date, page_num):
    m = report.get("maturityAndChange", {}) or {}
    flow = Flow(c, church_name, report_date, page_num, "Maturity & Change",
                "Spiritual Maturity & Change", title_size=21)
    flow.y -= 0.02 * inch

    # Average maturity callout
    avg = m.get("averageMaturity")
    flow.ensure(0.55 * inch)
    c = flow.c
    card_h = 0.5 * inch
    c.setFillColor(SURFACE)
    c.roundRect(MARGIN, flow.y - card_h, PAGE_W - 2 * MARGIN, card_h, 6, fill=1, stroke=0)
    c.setFont("Inter-Medium", 10)
    c.setFillColor(INK_MUTED)
    c.drawString(MARGIN + 0.18 * inch, flow.y - card_h + 0.30 * inch, "Church average maturity score")
    c.setFont("DMSans-Bold", 20)
    c.setFillColor(TEAL_DARK)
    c.drawRightString(PAGE_W - MARGIN - 0.18 * inch, flow.y - card_h + 0.16 * inch, fmt_num(avg))
    flow.y -= card_h + 0.22 * inch

    # Maturity distribution table
    dist = m.get("distribution") or []
    if dist:
        rows = [[d.get("label", ""), str(d.get("count", "")), fmt_pct(d.get("pct"))] for d in dist]
        draw_subheading(flow, "Maturity Distribution", min_trailing=table_heading_min_trailing([], rows))
        draw_table(flow, ["Stage", "n", "% of respondents"], rows,
                   [3.0 * inch, 1.0 * inch, 1.55 * inch])

    # Funnel
    funnel = m.get("funnel") or []
    if funnel:
        rows = []
        for f in funnel:
            rows.append([
                f"{f.get('fromLabel','')} \u2192 {f.get('toLabel','')}",
                str(f.get("fromCount", "")),
                str(f.get("toOrHigherCount", "")),
                fmt_pct((f.get("advanceRate") or 0) * 100),
            ])
        draw_subheading(flow, "Advancement Funnel", min_trailing=table_heading_min_trailing([], rows))
        draw_table(flow, ["Transition", "From n", "At/above target n", "Advance rate"], rows,
                   [2.55 * inch, 0.85 * inch, 1.5 * inch, 1.15 * inch])

    # Plateau flag callout
    if m.get("plateauAtTopFlag"):
        flow.ensure(0.6 * inch)
        c = flow.c
        card_h = 0.55 * inch
        c.setFillColor(HexColor("#FBEDE8"))
        c.roundRect(MARGIN, flow.y - card_h, PAGE_W - 2 * MARGIN, card_h, 6, fill=1, stroke=0)
        c.setStrokeColor(CORAL)
        c.setLineWidth(2.2)
        c.line(MARGIN, flow.y - card_h, MARGIN, flow.y)
        c.setFont("Inter-SemiBold", 10)
        c.setFillColor(CORAL)
        c.drawString(MARGIN + 0.18 * inch, flow.y - 0.22 * inch, "\u26a0 PLATEAU AT TOP FLAGGED")
        c.setFont("Inter", 9.3)
        c.setFillColor(INK_MUTED)
        c.drawString(MARGIN + 0.18 * inch, flow.y - 0.40 * inch,
                     "The most mature group (God Centered) shows the lowest active-growth rate.")
        flow.y -= card_h + 0.2 * inch

    # Change-by-maturity crosstab
    crosstab = m.get("changeByMaturity") or []
    if crosstab:
        rows = [[
            r.get("maturityLabel", ""), str(r.get("n", "")),
            fmt_pct(r.get("growingPct")), fmt_pct(r.get("sameOrFadingPct")),
        ] for r in crosstab]
        draw_subheading(flow, "Change by Maturity Stage", min_trailing=table_heading_min_trailing([], rows))
        draw_table(flow, ["Stage", "n", "Growing %", "Same/fading %"], rows,
                   [2.3 * inch, 0.85 * inch, 1.4 * inch, 1.5 * inch])

    draw_insight_list(flow, m.get("insights") or [], heading="INSIGHTS")
    return flow.page_num + 1


# ============================================================
# 6. Pathway Observations by Goal
# ============================================================

BAND_COLOR = {"high": TEAL, "medium": SAND, "low": CORAL}


def measure_pathway_block_height(c, pw):
    """Height needed for one pathway row (name + meta + any reversal
    lines) -- shared by the per-row page-break check and by the goal
    banner's min_trailing reservation, so a goal header is never orphaned
    from its first pathway."""
    reversals = pw.get("reversals") or []
    name_lines = wrapped_lines(c, f"{pw.get('num','')}. {pw.get('name','')}", "Inter-SemiBold", 10.5,
                                PAGE_W - 2 * MARGIN - 1.6 * inch)
    block_h = max(len(name_lines) * 13.4, 0.28 * inch) + 0.30 * inch
    if reversals:
        block_h += 0.16 * inch * len(reversals) + 0.06 * inch
    return block_h + 0.08 * inch


def render_pathways(c, report, church_name, report_date, page_num):
    goals = report.get("pathwaysByGoal") or []
    flow = Flow(c, church_name, report_date, page_num, "Pathway Observations",
                "Pathway Observations by Goal", title_size=20)
    flow.y -= 0.02 * inch

    for goal in goals:
        goal_name = goal.get("goal", "")
        goal_avg = goal.get("goalAverage")
        pathways = goal.get("pathways") or []
        label = f"{goal_name.upper()}   \u00b7   goal average {fmt_num(goal_avg)}"
        banner_trailing = measure_pathway_block_height(flow.c, pathways[0]) if pathways else 0.0
        draw_banner_heading(flow, label, TEAL_DARK, min_trailing=banner_trailing, gap_before=0.12 * inch)
        flow.y -= 0.18 * inch

        for pw in pathways:
            c = flow.c
            band = pw.get("band", "medium")
            reversals = pw.get("reversals") or []
            name_lines = wrapped_lines(c, f"{pw.get('num','')}. {pw.get('name','')}", "Inter-SemiBold", 10.5,
                                        PAGE_W - 2 * MARGIN - 1.6 * inch)
            flow.ensure(measure_pathway_block_height(c, pw))

            row_top = flow.y
            # band swatch
            c.setFillColor(BAND_COLOR.get(band, SAND))
            c.roundRect(MARGIN, row_top - 0.20 * inch, 0.12 * inch, 0.20 * inch, 2, fill=1, stroke=0)

            tx = MARGIN + 0.24 * inch
            c.setFont("Inter-SemiBold", 10.5)
            c.setFillColor(INK)
            yy = row_top - 0.02 * inch
            for ln in name_lines:
                c.drawString(tx, yy, ln)
                yy -= 13.4

            c.setFont("Inter-Medium", 9.3)
            c.setFillColor(INK_MUTED)
            shape = (pw.get("trajectoryShape") or "").replace("-", " ")
            meta = f"avg {fmt_num(pw.get('churchAverage'))}  \u00b7  {band} band  \u00b7  {shape}"
            c.drawRightString(PAGE_W - MARGIN, row_top - 0.02 * inch, meta)

            flow.y = yy - 0.06 * inch

            if reversals:
                for rv in reversals:
                    c.setFont("Inter", 8.8)
                    c.setFillColor(OLIVE)
                    txt = (f"\u21b3 reversal: {rv.get('fromStage','')} \u2192 {rv.get('toStage','')} "
                           f"(\u2212{fmt_num(rv.get('pointDrop'), 2)} pts)")
                    c.drawString(tx, flow.y, txt)
                    flow.y -= 0.155 * inch
            flow.y -= 0.10 * inch

        flow.y -= 0.06 * inch

    return flow.page_num + 1


# ============================================================
# 7. Dimension-Level View
# ============================================================

def render_dimensions(c, report, church_name, report_date, page_num):
    dims = report.get("dimensions", {}) or {}
    flow = Flow(c, church_name, report_date, page_num, "Dimension-Level View",
                "Dimension-Level View", title_size=22)
    flow.y -= 0.04 * inch

    rollups = sorted(dims.get("rollups") or [], key=lambda r: r.get("rank", 999))
    if rollups:
        rows = []
        for r in rollups:
            type_tag = "BELIEF" if r.get("type") == "belief" else "PRACTICE"
            rows.append([f"#{r.get('rank','')}", r.get("name", ""), type_tag, fmt_num(r.get("churchAverage"))])
        draw_subheading(flow, "Ranked Dimensions", min_trailing=table_heading_min_trailing([], rows))
        draw_table(flow, ["Rank", "Dimension", "Type", "Church avg"], rows,
                   [0.6 * inch, 3.55 * inch, 0.95 * inch, 1.0 * inch])

    gaps = dims.get("beliefPracticeGaps") or []
    if gaps:
        rows = []
        for g in gaps:
            rows.append([
                f"{g.get('pathwayNum','')}. {g.get('pathwayName','')}",
                fmt_num(g.get("beliefAvg")) if g.get("beliefAvg") is not None else "\u2014",
                fmt_num(g.get("practiceAvg")) if g.get("practiceAvg") is not None else "\u2014",
                fmt_delta(g.get("gap")) if g.get("gap") is not None else "\u2014",
            ])
        draw_subheading(flow, "Belief \u2013 Practice Gaps", min_trailing=table_heading_min_trailing([], rows))
        draw_table(flow, ["Pathway", "Belief avg", "Practice avg", "Gap"], rows,
                   [2.9 * inch, 1.05 * inch, 1.1 * inch, 1.05 * inch])

    draw_insight_list(flow, dims.get("insights") or [], heading="INSIGHTS")
    return flow.page_num + 1


# ============================================================
# 8. Discipleship Bottleneck Map
# ============================================================

def render_bottlenecks(c, report, church_name, report_date, page_num):
    bm = report.get("bottleneckMap", {}) or {}
    flow = Flow(c, church_name, report_date, page_num, "Bottleneck Map",
                "Discipleship Bottleneck Map", title_size=20)
    flow.y -= 0.04 * inch

    weakest = bm.get("weakestPathways") or []
    if weakest:
        rows = [[w.get("name", ""), w.get("goal", ""), fmt_num(w.get("score"))] for w in weakest]
        draw_subheading(flow, "Weakest Pathways", min_trailing=table_heading_min_trailing([], rows))
        draw_table(flow, ["Pathway", "Goal", "Score"], rows, [2.9 * inch, 2.2 * inch, 1.0 * inch])

    checks = bm.get("reciprocityChecks") or []
    if checks:
        rows = []
        has_directional = False
        for rc in checks:
            name = rc.get("pathwayName", "")
            if rc.get("directionalOnly"):
                name += "  \u25b3"
                has_directional = True
            rows.append([
                name, fmt_num(rc.get("givingScore")), fmt_num(rc.get("receivingScore")),
                fmt_delta(rc.get("gap")), str(rc.get("n", "")),
            ])
        draw_subheading(flow, "Reciprocity Checks \u2014 Giving vs. Receiving",
                         min_trailing=table_heading_min_trailing([], rows))
        draw_table(flow, ["Pathway", "Giving", "Receiving", "Gap", "n"], rows,
                   [2.35 * inch, 0.85 * inch, 0.95 * inch, 0.85 * inch, 0.6 * inch])
        if has_directional:
            flow.ensure(0.2 * inch)
            directional_note(flow.c, MARGIN, flow.y, "directional only \u00b7 n<15")
            flow.y -= 0.24 * inch

    draw_insight_list(flow, bm.get("insights") or [], heading="INSIGHTS")
    return flow.page_num + 1


# ============================================================
# 9. Cross-Cutting Insights
# ============================================================

def render_cross_cutting(c, report, church_name, report_date, page_num):
    cc = report.get("crossCutting", {}) or {}
    flow = Flow(c, church_name, report_date, page_num, "Cross-Cutting Insights",
                "Cross-Cutting Insights", title_size=22)
    flow.y -= 0.06 * inch

    insights = cc.get("insights") or []
    if not insights:
        flow.c.setFont("Inter", 10)
        flow.c.setFillColor(INK_MUTED)
        flow.c.drawString(MARGIN, flow.y, "No cross-cutting patterns were flagged for this wave.")
        return flow.page_num + 1

    draw_insight_list(flow, insights)
    return flow.page_num + 1


# ============================================================
# 10. Suggested Debrief Questions (+ Data Notes)
# ============================================================

def render_debrief_questions(c, report, church_name, report_date, page_num):
    questions = report.get("suggestedDebriefQuestions") or []
    notes = report.get("dataNotes") or []

    flow = Flow(c, church_name, report_date, page_num, "Suggested Debrief Questions",
                "Suggested Debrief Questions", title_size=20)
    flow.y -= 0.02 * inch
    flow.c.setFont("Inter", 9.8)
    flow.c.setFillColor(INK_MUTED)
    intro = "Discussion prompts for the debrief conversation with church leadership, phrased in their language."
    flow.y = draw_body_paragraph(flow.c, MARGIN, flow.y, intro, PAGE_W - 2 * MARGIN,
                                  size=9.8, leading=13.6, color=INK_MUTED)
    flow.y -= 0.14 * inch

    max_w = PAGE_W - 2 * MARGIN - 0.4 * inch
    for i, q in enumerate(questions, start=1):
        lines = wrapped_lines(flow.c, q, "Inter", 10.4, max_w)
        needed = len(lines) * 14.6 + 0.14 * inch
        flow.ensure(needed)
        c = flow.c
        c.setFont("Inter-Bold", 10.4)
        c.setFillColor(TEAL_DARK)
        c.drawString(MARGIN, flow.y, f"{i}.")
        c.setFont("Inter", 10.4)
        c.setFillColor(INK)
        yy = flow.y
        for ln in lines:
            c.drawString(MARGIN + 0.32 * inch, yy, ln)
            yy -= 14.6
        flow.y = yy - 0.12 * inch

    if notes:
        first_note_lines = wrapped_lines(flow.c, notes[0], "Inter", 9, PAGE_W - 2 * MARGIN - 0.2 * inch)
        first_note_h = len(first_note_lines) * 12.4 + 0.1 * inch
        draw_subheading(flow, "DATA NOTES & CAVEATS", size=10.5, color=OLIVE, min_trailing=first_note_h)
        c = flow.c
        for note in notes:
            lines = wrapped_lines(c, note, "Inter", 9, PAGE_W - 2 * MARGIN - 0.2 * inch)
            needed = len(lines) * 12.4 + 0.1 * inch
            flow.ensure(needed)
            c = flow.c
            c.setFillColor(OLIVE)
            c.circle(MARGIN + 0.035 * inch, flow.y + 3.0, 1.8, fill=1, stroke=0)
            yy = flow.y
            c.setFont("Inter", 9)
            c.setFillColor(INK_MUTED)
            for ln in lines:
                c.drawString(MARGIN + 0.18 * inch, yy, ln)
                yy -= 12.4
            flow.y = yy - 0.08 * inch

    return flow.page_num + 1


# ============================================================
# Entry point
# ============================================================

def build_debriefing_report_pdf(out_path: str, report: dict) -> bool:
    """Renders `report` (a DebriefingReport dict, matching
    shared/debriefing/types.ts / debriefing/sample_fixture.json) to a PDF at
    `out_path`. Returns True on success."""
    church_name = report.get("churchName", "")
    wave_label = report.get("waveLabel", "")
    report_date = _format_date(report.get("generatedAt", "")) or wave_label

    c = canvas.Canvas(out_path, pagesize=letter)
    c.setTitle(f"Debriefing Report (Admin) \u2014 {church_name}")
    c.setAuthor("Jesus Journey Survey")
    c.setSubject("Internal use only \u2014 not for congregation distribution")

    # 1. Cover
    page_cover(c, report)
    page_num = 2

    # 2. Executive Summary
    page_num = render_executive_summary(c, report, church_name, report_date, page_num)

    # 3. Demographic Observations
    page_num = render_demographics(c, report, church_name, report_date, page_num)

    # 4. Engagement Observations
    page_num = render_engagement(c, report, church_name, report_date, page_num)

    # 5. Spiritual Maturity & Change Observations
    page_num = render_maturity(c, report, church_name, report_date, page_num)

    # 6. Pathway Observations by Goal
    page_num = render_pathways(c, report, church_name, report_date, page_num)

    # 7. Dimension-Level View
    page_num = render_dimensions(c, report, church_name, report_date, page_num)

    # 8. Discipleship Bottleneck Map
    page_num = render_bottlenecks(c, report, church_name, report_date, page_num)

    # 9. Cross-Cutting Insights
    page_num = render_cross_cutting(c, report, church_name, report_date, page_num)

    # 10. Suggested Debrief Questions (+ Data Notes caveats block)
    page_num = render_debrief_questions(c, report, church_name, report_date, page_num)

    c.save()
    return True
