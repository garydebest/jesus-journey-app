import sys
import unittest
import tempfile
import subprocess
sys.path.insert(0, __file__.rsplit("/tests/", 1)[0])
from cohort_report import redact_comment, build_private_comments


class CommentPrivacyTests(unittest.TestCase):
    def test_obvious_identifiers_withheld(self):
        for text in [
            "Email me at person@example.test please.",
            "Call 604-555-1234 about this.",
            "My name is Gary. I would like prayer.",
            "I'm Example Person, the group leader.",
            "I'm Gary, and I would like prayer.",
            "Please visit https://example.test/my-name.",
            "I live at 123 Main Street.",
        ]:
            self.assertIsNone(redact_comment(text), text)

    def test_plain_feedback_preserved(self):
        text = "More opportunities to learn and pray together would help."
        self.assertEqual(redact_comment(text), text)

    def test_comment_pool_below_five_suppressed(self):
        with tempfile.TemporaryDirectory() as directory:
            path = directory + "/comments.pdf"
            build_private_comments(path, "Synthetic", "Review", [{"comment_text": "PRIVATE_SENTINEL"}] * 4)
            text = subprocess.check_output(["pdftotext", path, "-"], text=True)
            self.assertIn("Insufficient responses", text)
            self.assertNotIn("PRIVATE_SENTINEL", text)

    def test_comment_output_does_not_link_author_metadata(self):
        with tempfile.TemporaryDirectory() as directory:
            path = directory + "/comments.pdf"
            rows = [{"comment_text": "More prayer opportunities please.", "gender": "PRIVATE_GENDER",
                     "journey_post": 2, "respondent_id": "PRIVATE_ID"} for _ in range(5)]
            rows.append({"comment_text": "My name is Private Person. Contact me at private@example.test."})
            build_private_comments(path, "Synthetic", "Review", rows)
            text = subprocess.check_output(["pdftotext", path, "-"], text=True)
            self.assertIn("More prayer opportunities", text)
            for value in ["PRIVATE_GENDER", "PRIVATE_ID", "Private Person", "private@example.test"]:
                self.assertNotIn(value, text)

    def test_excluded_incomplete_comments_still_save_privacy_notice(self):
        with tempfile.TemporaryDirectory() as directory:
            path = directory + "/comments.pdf"
            self.assertTrue(build_private_comments(path, "Synthetic", "Review", [], True))
            self.assertIn("Insufficient responses", subprocess.check_output(["pdftotext", path, "-"], text=True))


if __name__ == "__main__":
    unittest.main()
