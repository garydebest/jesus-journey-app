"""Render the church Survey Review and the Facilitator's Report from raw response rows.

stdin JSON: {"church_name": str, "rows": [report-engine rows], "church_out": path, "facilitator_out": path}
stdout (last line) JSON: {"ok": true, "summary": {...aggregate selection, no respondent data...}} or {"ok": false, "error": str}
"""
import json
import sys
import traceback
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / "survey_review"))


def main():
    payload = json.loads(sys.stdin.read())
    import engine as B
    import phrase_library as L
    import render_pdf as RP
    B.PAGES = bool(payload.get("full_report_layout", True))
    rows = B.from_report_rows(payload.get("rows") or [])
    if not rows:
        raise ValueError("No responses with a valid journey stage")
    name = payload.get("church_name") or "Your Church"
    sel = B.select(rows)
    RP.church_pdf(Path(payload["church_out"]), name, sel, B, L)
    RP.facilitator_pdf(Path(payload["facilitator_out"]), name, rows, sel, B, L)
    summary = json.loads(json.dumps({k: v for k, v in sel.items()}, default=str))
    print(json.dumps({"ok": True, "summary": summary}))


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:  # noqa: BLE001
        traceback.print_exc(file=sys.stderr)
        print(json.dumps({"ok": False, "error": str(exc)}))
        sys.exit(1)
