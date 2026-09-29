"""Read-only compatibility projection for old debriefing JSON."""
import re

LEGACY = re.compile(
    r"\bdimensions?\b|relationships\s*(?:&|and)\s*growth|"
    r"stated belief runs ahead|practice keeps pace with|beliefs and everyday practice|"
    r"a foundation of belief to build on|practice is an existing strength to build on|"
    r"help belief become more consistent practice|deepen the belief underlying the practice", re.I)
LEGACY_SECTION = re.compile(r"^(Beliefs & Practices|Dimensions?|Dimension-Level View)$", re.I)


def project_report(value):
    if isinstance(value, list):
        result = []
        for item in value:
            if isinstance(item, str) and LEGACY.search(item):
                continue
            if isinstance(item, dict):
                if LEGACY_SECTION.search(str(item.get("section", ""))):
                    continue
                if LEGACY.search(" ".join(str(item.get(k, "")) for k in
                                          ("headline", "detail", "title", "topic", "id"))):
                    continue
            result.append(project_report(item))
        return result
    if isinstance(value, dict):
        result = {}
        for key, item in value.items():
            if key == "dimensions":
                continue
            if key == "analysisScope" and isinstance(item, str):
                item = item.replace("pathway, dimension, or bottleneck", "pathway or bottleneck")
            # Old paired models can carry the same findings without provenance.
            if key == "intro" and isinstance(item, str) and LEGACY.search(item):
                continue
            result[key] = project_report(item)
        return result
    return value
