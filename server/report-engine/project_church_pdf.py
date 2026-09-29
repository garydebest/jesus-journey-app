"""Replace only the recognised legacy survey-process page on download.

No stored objects, report data, other pages or raw responses are changed.
Unrecognised legacy layouts fail closed rather than silently hiding data.
"""
import io
import re
import sys
from pypdf import PdfReader, PdfWriter

LEGACY = re.compile(r"(?:7|seven)\s+(?:core\s+|underlying\s+)?dimensions", re.I)


def project_church_pdf(data):
    reader = PdfReader(io.BytesIO(data))
    targets = [i for i, page in enumerate(reader.pages) if LEGACY.search(page.extract_text() or "")]
    if not targets:
        return data
    if targets != [3]:
        raise ValueError("Unrecognised legacy report layout; review required")
    text = reader.pages[3].extract_text() or ""
    if "The Survey Development Process" not in text or "Survey Process" not in text:
        raise ValueError("Unrecognised survey-process page; review required")
    footer = next((line for line in text.splitlines() if "  •  " in line), None)
    if not footer:
        raise ValueError("Report footer could not be preserved")
    import build_full_report as template
    from reportlab.pdfgen import canvas
    template.CHURCH_NAME, template.REPORT_DATE = footer.rsplit("  •  ", 1)
    replacement = io.BytesIO()
    c = canvas.Canvas(replacement, pagesize=template.letter)
    template.page_interpreting_2(c)
    c.save()
    new_page = PdfReader(replacement).pages[0]
    writer = PdfWriter()
    for i, page in enumerate(reader.pages):
        writer.add_page(new_page if i == 3 else page)
    if reader.metadata:
        writer.add_metadata({k: str(v) for k, v in reader.metadata.items() if v is not None})
    out = io.BytesIO()
    writer.write(out)
    return out.getvalue()


if __name__ == "__main__":
    sys.stdout.buffer.write(project_church_pdf(sys.stdin.buffer.read()))
