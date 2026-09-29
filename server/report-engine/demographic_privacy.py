"""Demographic policy shared by full-report aggregation and PDF rendering.

Ethnicity arrives normalized from the TS boundary. Legacy labels are accepted
for standalone historical fixtures; no historical response rows are rewritten.
"""
import json

MIN_N = 10
NOTE = "Demographic categories below 10 respondents are withheld. Additional results may be withheld for confidentiality; missing does not mean zero."
PDF_POLICY = "jj-demographics-n10-v1"


def disclosed(value):
    return isinstance(value, str) and bool(value.strip()) and value.strip().lower() not in (
        "prefer not to say", "not answered", "not_disclosed")


def parse_multi(raw):
    if raw is None:
        return []
    if isinstance(raw, str):
        try:
            raw = json.loads(raw)
        except (ValueError, TypeError):
            raw = raw.split("|") if "|" in raw else [raw]
    if isinstance(raw, str):
        raw = [raw]
    if not isinstance(raw, list) or any(isinstance(v, str) and not disclosed(v) for v in raw):
        return []
    return list(dict.fromkeys(v for v in raw if disclosed(v)))


def safe_counts(counts, population, multi=False):
    entries = {k: n for k, n in counts.items() if disclosed(k) and n > 0}
    small = lambda n: 0 < n < MIN_N
    if population < MIN_N:
        return {}
    if not multi and (any(small(n) for n in entries.values()) or small(population - sum(entries.values()))):
        return {}
    return {k: n for k, n in entries.items() if n >= MIN_N and not small(population - n)}


def safe_breakdown(profile, population, multi=False):
    safe = safe_counts({k: v["n"] for k, v in profile["breakdown"].items()}, population, multi)
    return {**profile, "breakdown": {k: v for k, v in profile["breakdown"].items() if k in safe}}


def safe_outcome_groups(groups, population):
    safe = safe_counts({k: v["n"] for k, v in groups.items()}, population)
    return {k: v for k, v in groups.items() if k in safe}


def visible_rows(rows):
    """Remove suppressed rows AND section headings with no visible rows."""
    out, pending = [], None
    for label, values in rows:
        if values is None:
            pending = (label, values)
        elif values and all(v is not None for v in values):
            if pending:
                out.append(pending)
                pending = None
            out.append((label, values))
    return out
