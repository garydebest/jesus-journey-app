"""
generate_wordcloud.py -- bridge between the Node/Express app and the Comments
Wordcloud renderer (comments_wordcloud.py).

Reads one JSON object from stdin:
{
  "comments_pdf_path": "/abs/path/to/saved-comments-report.pdf",
  "out_path": "/abs/path/to/wordcloud.pdf",
  "church_name": "fallback name",   # optional; the PDF footer wins
  "report_date": "fallback date"    # optional
}
The comments come only from the saved, privacy-screened Comments Report.
Prints {"ok": true, "out_path": ..., "comment_count": n, "term_count": k} as
the last stdout line, or {"ok": false, "error": ...} and exits 1.
"""
import json
import sys
import traceback

sys.path.insert(0, __file__.rsplit("/", 1)[0])


def main():
    payload = json.loads(sys.stdin.read())
    from comments_wordcloud import extract_comments_from_pdf, build_wordcloud_pdf, read_report_identity
    source = payload["comments_pdf_path"]
    comments = extract_comments_from_pdf(source)
    # The Comments Report's own footer is authoritative, so both documents
    # carry the same church name and report date.
    name, date = read_report_identity(source)
    church_name = name or payload.get("church_name") or "Your church"
    report_date = date or payload.get("report_date") or ""
    analysis = build_wordcloud_pdf(payload["out_path"], church_name, report_date, comments)
    print(json.dumps({"ok": True, "out_path": payload["out_path"],
                      "comment_count": analysis["comment_count"], "term_count": len(analysis["terms"])}))


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(json.dumps({"ok": False, "error": str(e), "trace": traceback.format_exc()}))
        sys.exit(1)
