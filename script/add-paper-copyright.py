"""Add the approved survey copyright notice to every paper-survey page footer.

Narrow, verified edit: only the notice is added; all existing text, the
seven-page layout and print size are preserved. Usage:
python3 script/add-paper-copyright.py SOURCE.pdf DESTINATION.pdf
"""
import sys
from collections import Counter
from pathlib import Path
import pymupdf as fitz

NOTICE = "\u00a9 2017\u20132026 Jesus Journey Group. All rights reserved."
source, destination = sys.argv[1:]
doc = fitz.open(source)
before = [page.get_text() for page in doc]
assert len(doc) == 7 and all(NOTICE not in t for t in before), "Unexpected source PDF"
font_file = str(Path(__file__).resolve().parent.parent / "server/report-engine/fonts/Inter-Regular.ttf")
font = fitz.Font(fontfile=font_file)
size = 6.8
width = font.text_length(NOTICE, fontsize=size)
for page in doc:
    assert page.rect.width == 612 and page.rect.height == 792
    page.insert_font(fontname="JJCopy", fontfile=font_file)
    x = (page.rect.width - width) / 2
    y = page.rect.height - 0.43 * 72  # baseline inside the 0.62 in footer band, above "Paper Survey"
    page.insert_text((x, y), NOTICE, fontname="JJCopy", fontsize=size, color=(0xCF / 255, 0xE3 / 255, 0xE1 / 255))
doc.save(destination, garbage=4, deflate=True)
after = fitz.open(destination)
assert len(after) == 7
for index, page in enumerate(after):
    text = page.get_text()
    assert NOTICE in text, f"Notice missing on page {index + 1}"
    assert Counter(text.replace(NOTICE, "").split()) == Counter(before[index].split()), f"Unexpected text change on page {index + 1}"
print("PASS: survey notice added to all seven pages; all other text preserved.")
