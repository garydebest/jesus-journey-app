"""Replace only the recognised legacy survey-process page on download.

No stored objects, report data, other pages or raw responses are changed.
Unrecognised legacy layouts fail closed rather than silently hiding data.
"""
import io
import re
import sys
from pypdf import PdfReader, PdfWriter
from demographic_privacy import PDF_POLICY


def protect_archived_demographics(data):
    """Old PDFs lack exact cell n. Replace demographic pages, not stored bytes."""
    reader = PdfReader(io.BytesIO(data))
    if reader.metadata and reader.metadata.get("/Subject") == PDF_POLICY:
        return data
    if len(reader.pages) != 38:
        # Legacy mixed layouts cannot be safely reconstructed from percentages.
        raise ValueError("Privacy review required before downloading this archived layout; original file remains preserved.")
    expected = {6: "Our Church Demographics", 7: "More Church Demographics",
                8: "Engagement in Our Church", 10: "Diversity in Church",
                11: "Diversity in Church", 14: "My Faith and Trust", 15: "My Faith and Trust"}
    for index, heading in expected.items():
        if heading not in (reader.pages[index].extract_text() or ""):
            raise ValueError("Unrecognised archived demographic layout; privacy review required")
    from reportlab.pdfgen import canvas
    from reportlab.lib.pagesizes import letter
    from reportlab.lib.utils import simpleSplit
    writer = PdfWriter()
    for i, page in enumerate(reader.pages):
        if i in expected:
            replacement = io.BytesIO()
            c = canvas.Canvas(replacement, pagesize=letter)
            c.setFont("Helvetica-Bold", 16)
            c.drawString(54, 720, "Archived demographic section withheld")
            c.setFont("Helvetica", 11)
            text = ("This saved report predates the 10-person demographic privacy rule. "
                    "Exact category counts are not available to verify every result safely. "
                    "This section is withheld on download; the stored original has not been changed. "
                    "Other report sections retain their original results.")
            y = 684
            for line in simpleSplit(text, "Helvetica", 11, 500):
                c.drawString(54, y, line)
                y -= 17
            c.drawString(54, 40, f"Page {i + 1}")
            c.save()
            page = PdfReader(replacement).pages[0]
        writer.add_page(page)
    if reader.metadata:
        writer.add_metadata({k: str(v) for k, v in reader.metadata.items() if v is not None})
    writer.add_metadata({"/Subject": PDF_POLICY})
    out = io.BytesIO()
    writer.write(out)
    return out.getvalue()

LEGACY = re.compile(r"(?:7|seven)\s+(?:core\s+|underlying\s+)?dimensions", re.I)


def project_church_pdf(data):
    data = protect_archived_demographics(data)
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
