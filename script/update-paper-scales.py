"""Narrow, verified update of the practice rating keys in the existing PDF."""
import sys
from collections import Counter
from pathlib import Path
import pymupdf as fitz

source, destination = sys.argv[1:]
doc = fitz.open(source)
font_file = str(Path(__file__).resolve().parent.parent / "server/report-engine/fonts/Inter-Regular.ttf")
replacements = {
    "Never true of what I believe": "Never or not yet true",
    "Always true of what I believe": "Always true",
}
changed = 0
before = [page.get_text() for page in doc]
for index in (3, 4, 5):
    page = doc[index]
    targets = [
        span for block in page.get_text("dict")["blocks"]
        for line in block.get("lines", []) for span in line["spans"]
        if span["text"].strip() in replacements
    ]
    assert len(targets) == 2, f"Expected two rating labels on page {index + 1}, got {len(targets)}"
    pixels = page.get_pixmap()
    for span in targets:
        background = pixels.pixel(int(span["bbox"][0]) - 3, int(span["bbox"][1]) + 3)
        page.add_redact_annot(span["bbox"], fill=tuple(channel / 255 for channel in background[:3]))
    page.apply_redactions(images=0, graphics=0)
    page.insert_font(fontname="JJScale", fontfile=font_file)
    for span in targets:
        page.insert_text(span["origin"], replacements[span["text"].strip()],
                         fontname="JJScale", fontsize=span["size"],
                         color=fitz.sRGB_to_pdf(span["color"]))
        changed += 1
assert changed == 6
doc.set_metadata({**doc.metadata, "title": "Jesus Journey Paper Survey", "author": "Perplexity Computer"})
doc.save(destination, garbage=4, deflate=True)
after = fitz.open(destination)
assert len(after) == len(doc) == 7
for index, page in enumerate(after):
    expected = before[index]
    if index in (3, 4, 5):
        for old, new in replacements.items():
            expected = expected.replace(old, new)
    assert Counter(expected.split()) == Counter(page.get_text().split()), f"Unexpected text change on page {index + 1}"
print("PASS: six practice scale labels corrected; all other text and seven-page layout preserved.")
