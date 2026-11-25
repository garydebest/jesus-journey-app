"""Render the Core Leaders Review and its facilitator companion from raw response rows of an open survey.

Only rows that came in through the leader code are used. Nothing is deleted or closed.
stdin JSON: {"church_name": str, "rows": [report-engine rows with "core_leader"], "church_out": path, "facilitator_out": path}
stdout (last line) JSON: {"ok": true, "summary": {...aggregate selection...}} or {"ok": false, "error": str}
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
    import leaders as LD
    import render_leaders_pdf as RL
    B.PAGES = False
    rows = LD.leader_rows(B.from_report_rows(payload.get("rows") or []))
    if len(rows) < LD.MIN_LEADERS:
        raise ValueError(f"The Core Leaders Review needs at least {LD.MIN_LEADERS} leader responses; there are {len(rows)}.")
    name = payload.get("church_name") or "Your Church"
    sel = LD.select(rows)
    RL.church_pdf(Path(payload["church_out"]), name, sel, B, L, LD)
    RL.facilitator_pdf(Path(payload["facilitator_out"]), name, rows, sel, B, L, LD)
    summary = json.loads(json.dumps({k: v for k, v in sel.items()}, default=str))
    print(json.dumps({"ok": True, "summary": summary}))


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:  # noqa: BLE001
        traceback.print_exc(file=sys.stderr)
        print(json.dumps({"ok": False, "error": str(exc)}))
        sys.exit(1)
