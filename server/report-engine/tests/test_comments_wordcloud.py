import os
import sys
import subprocess
import tempfile
import unittest

sys.path.insert(0, __file__.rsplit("/tests/", 1)[0])
from comments_wordcloud import analyse_comments, build_wordcloud_pdf, extract_comments_from_pdf, APPRECIATION, REQUEST, EXPERIENCE
from cohort_report import build_private_comments

SAMPLE = [
    "Somewhere I can ask blunt questions about faith without people getting uncomfortable.",
    "I'd like a smaller setting to talk about faith questions instead of just sitting in a service.",
    "Trusting God with my job situation has been hard this year. Prayer support from a small group has carried me through it.",
    "Practical teaching on prayer, not just 'pray more' but how, when I'm distracted and busy.",
    "Keep pointing us back to Scripture. That's what's kept me anchored at Grace Fellowship.",
    "I need more support from the pastor and the church.",
    "Learning to trust God's timing instead of my own.",
]


def labels(result):
    return {t["label"]: t for t in result["terms"]}


class WordcloudAnalysisTests(unittest.TestCase):
    def test_background_words_and_church_name_never_shown_alone(self):
        result = analyse_comments(SAMPLE * 3, "Grace Fellowship Community Church")
        shown = {t["label"].lower() for t in result["terms"]}
        for word in ["church", "pastor", "god", "jesus", "faith", "grace", "fellowship"]:
            self.assertNotIn(word, shown)

    def test_counts_once_per_comment(self):
        result = analyse_comments(["Questions, questions and more questions. So many questions."] * 2)
        self.assertEqual(labels(result)["Safe space for questions"]["count"], 2)

    def test_appreciation_kept_distinct_from_request(self):
        found = labels(analyse_comments(SAMPLE, "Grace Fellowship Community Church"))
        self.assertEqual(found["Prayer support received"]["category"], APPRECIATION)
        self.assertEqual(found["Anchored in Scripture"]["category"], APPRECIATION)
        self.assertEqual(found["More care & support"]["category"], REQUEST)
        self.assertEqual(found["Learning to trust God"]["category"], EXPERIENCE)
        self.assertNotIn("Prayer support", found)

    def test_church_name_word_not_treated_as_theme(self):
        found = labels(analyse_comments(["We love Grace Fellowship."] * 6, "Grace Fellowship Community Church"))
        self.assertNotIn("Understanding grace", found)


class WordcloudPdfTests(unittest.TestCase):
    def test_reads_current_comments_layout_and_withholds_identifiers(self):
        with tempfile.TemporaryDirectory() as d:
            src, out = os.path.join(d, "c.pdf"), os.path.join(d, "w.pdf")
            rows = [{"comment_text": t} for t in SAMPLE]
            rows.append({"comment_text": "My name is Private Person. Email private@example.test about prayer."})
            build_private_comments(src, "Synthetic", "Review", rows)
            comments = extract_comments_from_pdf(src)
            self.assertEqual(sorted(comments), sorted(SAMPLE))
            build_wordcloud_pdf(out, "Synthetic", "Review", comments)
            text = subprocess.check_output(["pdftotext", out, "-"], text=True)
            self.assertIn("Safe space for questions", text)
            self.assertNotIn("Private Person", text)
            self.assertNotIn("private@example.test", text)

    def test_small_comment_pool_produces_no_cloud(self):
        with tempfile.TemporaryDirectory() as d:
            src, out = os.path.join(d, "c.pdf"), os.path.join(d, "w.pdf")
            build_private_comments(src, "Synthetic", "Review", [{"comment_text": "More prayer PRIVATE_SENTINEL"}] * 4)
            comments = extract_comments_from_pdf(src)
            self.assertEqual(comments, [])
            build_wordcloud_pdf(out, "Synthetic", "Review", comments)
            text = subprocess.check_output(["pdftotext", out, "-"], text=True)
            self.assertIn("not enough written comments", text)
            self.assertNotIn("PRIVATE_SENTINEL", text)
            self.assertNotIn("Learning to pray", text)


if __name__ == "__main__":
    unittest.main()
