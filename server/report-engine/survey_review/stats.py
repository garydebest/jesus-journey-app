"""Small statistics helpers for the Survey Review engine (standard library only)."""
import math
from statistics import NormalDist


def mean(x):
    return sum(x) / len(x) if x else float("nan")


def var(x):
    m = mean(x)
    return sum((v - m) ** 2 for v in x) / (len(x) - 1) if len(x) > 1 else 0.0


def _betacf(a, b, x):
    qab, qap, qam = a + b, a + 1, a - 1
    c, d = 1.0, 1 - qab * x / qap
    d = 1 / (d if abs(d) > 1e-300 else 1e-300)
    h = d
    for m in range(1, 300):
        m2 = 2 * m
        aa = m * (b - m) * x / ((qam + m2) * (a + m2))
        d = 1 + aa * d; d = 1 / (d if abs(d) > 1e-300 else 1e-300)
        c = 1 + aa / c if abs(c) > 1e-300 else 1e300
        h *= d * c
        aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2))
        d = 1 + aa * d; d = 1 / (d if abs(d) > 1e-300 else 1e-300)
        c = 1 + aa / c if abs(c) > 1e-300 else 1e300
        de = d * c; h *= de
        if abs(de - 1) < 1e-12:
            break
    return h


def _betainc(a, b, x):
    if x <= 0: return 0.0
    if x >= 1: return 1.0
    lb = math.lgamma(a + b) - math.lgamma(a) - math.lgamma(b) + a * math.log(x) + b * math.log(1 - x)
    if x < (a + 1) / (a + b + 2):
        return math.exp(lb) * _betacf(a, b, x) / a
    return 1 - math.exp(lb) * _betacf(b, a, 1 - x) / b


def t_cdf(t, df):
    x = df / (df + t * t)
    tail = 0.5 * _betainc(df / 2, 0.5, x)
    return 1 - tail if t > 0 else tail


def t_ppf(p, df):
    """Quantile of Student's t (p > 0.5), by bisection on the exact CDF."""
    if df > 1e6:
        return NormalDist().inv_cdf(p)
    lo, hi = 0.0, 1000.0
    for _ in range(200):
        mid = (lo + hi) / 2
        if t_cdf(mid, df) < p: lo = mid
        else: hi = mid
    return (lo + hi) / 2


def zc(conf):
    return NormalDist().inv_cdf(1 - (1 - conf) / 2)


NOT_CLEAR = dict(diff=0.0, lo=-99.0, hi=99.0)  # too few people to say anything; never significant


def mean_diff(a, b, conf=0.95):
    """Welch difference a-b with t-based interval."""
    if len(a) < 2 or len(b) < 2:
        return dict(NOT_CLEAR)
    d = mean(a) - mean(b)
    va, vb = var(a) / len(a), var(b) / len(b)
    se = math.sqrt(va + vb) or 1e-9
    df = (va + vb) ** 2 / ((va ** 2 / (len(a) - 1) if len(a) > 1 else 0) + (vb ** 2 / (len(b) - 1) if len(b) > 1 else 0) or 1e-9)
    t = t_ppf(1 - (1 - conf) / 2, max(df, 1))
    return dict(diff=d, lo=d - t * se, hi=d + t * se)


def paired(x, conf=0.95):
    if len(x) < 2:
        return dict(NOT_CLEAR)
    m = mean(x); se = math.sqrt(var(x) / len(x)) or 1e-9
    t = t_ppf(1 - (1 - conf) / 2, max(len(x) - 1, 1))
    return dict(diff=m, lo=m - t * se, hi=m + t * se)


def wilson(k, n, conf):
    z = zc(conf); p = k / n; den = 1 + z * z / n
    c = (p + z * z / (2 * n)) / den; h = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / den
    return c - h, c + h


def prop_diff(k1, n1, k2, n2, conf=0.95):
    """Newcombe hybrid score interval, in percentage points."""
    p1, p2 = k1 / n1, k2 / n2
    l1, u1 = wilson(k1, n1, conf); l2, u2 = wilson(k2, n2, conf)
    d = p1 - p2
    return dict(diff=100 * d, lo=100 * (d - math.sqrt((p1 - l1) ** 2 + (u2 - p2) ** 2)),
                hi=100 * (d + math.sqrt((u1 - p1) ** 2 + (p2 - l2) ** 2)))
