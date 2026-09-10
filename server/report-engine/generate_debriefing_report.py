"""
generate_debriefing_report.py -- bridge between the Node/Express app and
build_debriefing_report.py.

Unlike generate_report.py, no scoring/aggregation happens here: the
TypeScript debriefing engine (shared/debriefing/engine.ts) already computed
the full structured DebriefingReport object. This script only renders it.

Reads a single JSON object from stdin shaped like:
{
  "out_path": "/absolute/path/to/output.pdf",
  "report": { ... DebriefingReport, see shared/debriefing/types.ts ... }
}

Writes the rendered PDF to out_path. Prints {"ok": true, "out_path": ...}
as the last line of stdout on success. On failure prints
{"ok": false, "error": "..."} to stdout and exits with code 1.
"""
import sys
import json
import traceback

sys.path.insert(0, __file__.rsplit("/", 1)[0])


def main():
    raw = sys.stdin.read()
    payload = json.loads(raw)

    out_path = payload["out_path"]
    report = payload["report"]

    from build_debriefing_report import build_debriefing_report_pdf

    ok = build_debriefing_report_pdf(out_path, report)
    print(json.dumps({"ok": bool(ok), "out_path": out_path if ok else None}))


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(json.dumps({"ok": False, "error": str(e), "trace": traceback.format_exc()}))
        sys.exit(1)
