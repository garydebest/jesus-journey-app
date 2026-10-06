"""Approved survey ownership notice (Gary, October 6, 2026). Use this exact text."""
SURVEY_COPYRIGHT = "\u00a9 2017\u20132026 Jesus Journey Group. All rights reserved."

# Footer bands are 0.62 in tall. Ordinary pages carry church/date at 0.24 in,
# so the notice sits above it; covers have no centre text, so it sits lower.
PAGE_Y_IN = 0.43
COVER_Y_IN = 0.26


def draw_copyright(c, page_w, y, colour="#CFE3E1", font="Inter", size=6.8):
    c.saveState()
    c.setFont(font, size)
    from reportlab.lib.colors import HexColor
    c.setFillColor(HexColor(colour))
    c.drawCentredString(page_w / 2, y, SURVEY_COPYRIGHT)
    c.restoreState()
