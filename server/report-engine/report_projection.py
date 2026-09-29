"""Read-only compatibility projection for old debriefing JSON."""
import re
from demographic_privacy import safe_counts, MIN_N, disclosed

LEGACY = re.compile(
    r"\bdimensions?\b|relationships\s*(?:&|and)\s*growth|"
    r"stated belief runs ahead|practice keeps pace with|beliefs and everyday practice|"
    r"a foundation of belief to build on|practice is an existing strength to build on|"
    r"help belief become more consistent practice|deepen the belief underlying the practice", re.I)
LEGACY_SECTION = re.compile(r"^(Beliefs & Practices|Dimensions?|Dimension-Level View)$", re.I)


def project_report(value, allowed=None):
    if allowed is None:
        allowed = set()
        if isinstance(value, dict):
            for section in value.get("demographics", []):
                allowed.update(safe_counts(
                    {r["group"]: r["n"] for r in section.get("breakdown", [])},
                    value.get("respondentCount", 0), section.get("id") == "raceEthnicity"))
    if isinstance(value, list):
        result = []
        for item in value:
            if isinstance(item, str) and LEGACY.search(item):
                continue
            if isinstance(item, dict):
                if re.match(r"^Demographic|^Engagement$", str(item.get("section", "")), re.I):
                    if item.get("demographicN", 0) < MIN_N or item.get("demographicGroup") not in allowed:
                        continue
                if "group" in item and "n" in item and "pctOfChurch" in item:
                    if item["n"] < MIN_N or not disclosed(item["group"]):
                        continue
                if LEGACY_SECTION.search(str(item.get("section", ""))):
                    continue
                if LEGACY.search(" ".join(str(item.get(k, "")) for k in
                                          ("headline", "detail", "title", "topic", "id"))):
                    continue
            result.append(project_report(item, allowed))
        return result
    if isinstance(value, dict):
        result = {}
        for key, item in value.items():
            if key == "suggestedDebriefQuestions":
                continue
            if key == "pairedPresentation" and item.get("version") != "paired-v3-demographic-privacy":
                continue
            if key == "demographics":
                item = [{**section, "breakdown": [
                    row for row in section.get("breakdown", [])
                    if row["group"] in safe_counts(
                        {r["group"]: r["n"] for r in section.get("breakdown", [])},
                        value.get("respondentCount", 0), section.get("id") == "raceEthnicity")
                ]} for section in item]
            if key == "dimensions":
                continue
            if key == "analysisScope" and isinstance(item, str):
                item = item.replace("pathway, dimension, or bottleneck", "pathway or bottleneck")
            # Old paired models can carry the same findings without provenance.
            if key == "intro" and isinstance(item, str) and LEGACY.search(item):
                continue
            result[key] = project_report(item, allowed)
        return result
    return value
