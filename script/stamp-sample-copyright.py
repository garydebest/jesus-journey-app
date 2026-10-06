"""Add the approved survey notice to an existing public sample report PDF.

For public sample reports only (never stored customer reports). The notice is
placed in the existing 0.62 in footer band exactly where newly generated
reports place it: above the church/date line, or centred on the cover.
Verifies that all other text is unchanged. Usage:
python3 script/stamp-sample-copyright.py SOURCE.pdf DESTINATION.pdf
"""
import re
import sys
from collections import Counter
from pathlib import Path
import pymupdf as fitz

NOTICE = "\u00a9 2017\u20132026 Jesus Journey Group. All rights reserved."
source, destination = sys.argv[1:]
doc = fitz.open(source)
before = [page.get_text() for page in doc]
assert all(NOTICE not in t for t in before), "Notice already present"
font_file = str(Path(__file__).resolve().parent.parent / "server/report-engine/fonts/Inter-Regular.ttf")
width = fitz.Font(fontfile=font_file).text_length(NOTICE, fontsize=6.8)
for page, text in zip(doc, before):
    assert "J E S U S   J O U R N E Y" in text, "Unrecognised footer layout"
    numbered = re.search(r"\bpg \d+\b", text) is not None
    y = page.rect.height - (0.43 if numbered else 0.26) * 72
    page.insert_font(fontname="JJCopy", fontfile=font_file)
    page.insert_text(((page.rect.width - width) / 2, y), NOTICE, fontname="JJCopy", fontsize=6.8,
                     color=(0xCF / 255, 0xE3 / 255, 0xE1 / 255))
doc.save(destination, garbage=4, deflate=True)
after = fitz.open(destination)
assert len(after) == len(before)
for index, page in enumerate(after):
    text = page.get_text()
    assert NOTICE in text and Counter(text.replace(NOTICE, "").split()) == Counter(before[index].split()), index + 1
print(f"PASS: notice added to all {len(after)} pages; all other text preserved.")
