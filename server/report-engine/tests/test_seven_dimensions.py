"""Run after script/seven-dimensions-qa.ts; uses only synthetic files."""
import io
import json
import re
import sys
import unittest
from pathlib import Path
from pypdf import PdfReader, PdfWriter
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from project_church_pdf import project_church_pdf
from report_projection import project_report

ROOT = Path(__file__).resolve().parents[3]
FORBIDDEN = re.compile(r"\bdimensions?\b|relationships\s*(?:&|and)\s*growth|stated belief runs ahead|practice keeps pace with", re.I)


class ReportCleanup(unittest.TestCase):
    def test_all_generated_pdfs_have_no_legacy_text(self):
        files = list((ROOT / "qa-output").glob("*.pdf"))
        self.assertGreaterEqual(len(files), 14)
        for file in files:
            with self.subTest(file=file.name):
                text = "\n".join(p.extract_text() or "" for p in PdfReader(file).pages)
                self.assertNotRegex(text, FORBIDDEN)

    def test_legacy_church_page_replacement_is_narrow(self):
        source = (ROOT / "script/fixtures/legacy-church-report.pdf").read_bytes()
        old = PdfReader(io.BytesIO(source))
        clean = project_church_pdf(source)
        new = PdfReader(io.BytesIO(clean))
        self.assertEqual(len(old.pages), len(new.pages))
        self.assertEqual(old.metadata, new.metadata)
        for i in range(len(old.pages)):
            if i != 3:
                self.assertEqual(old.pages[i].get_contents().get_data(), new.pages[i].get_contents().get_data())
                self.assertEqual(old.pages[i].extract_text(), new.pages[i].extract_text())
        self.assertIn("4 major goals and 16 pathways", new.pages[3].extract_text())
        for line in old.pages[3].extract_text().splitlines():
            if "  •  " in line:
                self.assertIn(line, new.pages[3].extract_text())
        self.assertEqual(project_church_pdf(clean), clean)

    def test_unknown_archive_layout_fails_closed(self):
        old = PdfReader(ROOT / "script/fixtures/legacy-church-report.pdf")
        writer = PdfWriter()
        writer.add_page(old.pages[3])
        out = io.BytesIO()
        writer.write(out)
        with self.assertRaisesRegex(ValueError, "review required"):
            project_church_pdf(out.getvalue())

    def test_python_legacy_projection(self):
        legacy = json.loads((ROOT / "script/fixtures/legacy-dimensions.json").read_text())
        original = json.dumps(legacy)
        projected = project_report(legacy)
        self.assertNotIn("dimensions", projected)
        self.assertNotRegex(json.dumps(projected), FORBIDDEN)
        self.assertEqual(json.dumps(legacy), original)
        self.assertEqual(projected["pathwaysByGoal"], legacy["pathwaysByGoal"])

    def test_stale_paired_model(self):
        report = {"pairedPresentation": {"sections": [
            {"id": "dimensions", "title": "Seven underlying dimensions", "topics": []},
            {"id": "summary", "topics": [{"topic": "Beliefs and everyday practice", "strengths": []}]},
            {"id": "goal-1", "topics": [{"topic": "Pathway", "strengths": [
                {"headline": "A foundation of belief to build on.", "detail": "Belief items average 4.0."},
                {"headline": "Scores are higher in more mature groups.", "detail": "Retained pathway evidence."}
            ]}]}
        ]}}
        projected = project_report(report)
        self.assertNotRegex(json.dumps(projected), FORBIDDEN)
        self.assertNotIn("Belief items average", json.dumps(projected))
        self.assertIn("Retained pathway evidence", json.dumps(projected))


if __name__ == "__main__":
    unittest.main()
