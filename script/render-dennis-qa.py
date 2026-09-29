"""Render and verify a synthetic report through the production Python bridge."""
import json
import re
import subprocess
from pathlib import Path
from pypdf import PdfReader

root = Path(__file__).resolve().parents[1]
rows = json.loads((root / "qa-output/dennis-rows.json").read_text())
converted = []
for row in rows:
    out = {}
    for key, value in row.items():
        out[re.sub(r"([A-Z])", lambda m: "_" + m[1].lower(), key)] = value
    out["children_in_household"] = json.loads(row["childrenInHousehold"])
    converted.append(out)
payload = {"church_name": "Synthetic Review Church", "report_date": "9/29/2026",
           "survey_period": "9/1/2026 - 9/29/2026",
           "out_path": str(root / "qa-output/dennis-church.pdf"), "rows": converted}
result = subprocess.run(["python3", "generate_report.py"], cwd=root / "server/report-engine",
                        input=json.dumps(payload), capture_output=True, text=True)
assert result.returncode == 0, result.stdout + result.stderr
pdf = PdfReader(payload["out_path"])
assert len(pdf.pages) == 38
expected = {9: "Reflection during the survey", 10: "Exploring Jesus includes Distant",
            11: "Exploring Jesus includes Distant", 17: "final self-assessment",
            19: "Blank = no valid answers", 34: "same half", 35: "Goal averages"}
for page, text in expected.items():
    assert text in " ".join(pdf.pages[page].extract_text().split()), f"Page {page + 1}: {text}"
assert "not spiritual growth over time" in " ".join(pdf.pages[9].extract_text().split())
print("PASS: 38-page synthetic production-engine PDF and all corrected explanations")
