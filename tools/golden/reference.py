"""Numpy reference implementations of the browser pipeline (SPEC §6, wbpp.md §3.2, §4.6).

These are the numeric oracle for src/shared/pipeline. They are deliberately
written per pixel / per tap (no clever vectorisation of the rejection loops)
so that they read like the PCL listings in docs/knowledge/wbpp.md and can be
compared line by line with the TypeScript.

Coordinates: pixel centres on integers (SPEC §4.1). `warp_lanczos3` samples
`src` at continuous positions given by a 3x3 homography applied to output
pixel coordinates, with Lanczos-3 (6x6 taps), clamping 0.3, mirrored borders
and NaN for source positions outside [0,W-1]x[0,H-1].
"""
from __future__ import annotations

import math

import numpy as np
from scipy.special import erf, erfinv

# ---------------------------------------------------------------- geometry


def s_b(b: int) -> np.ndarray:
    """Bin-b index -> native (bin-1) coordinates, SPEC §6.4."""
    o = (b - 1) / 2
    return np.array([[b, 0, o], [0, b, o], [0, 0, 1.0]])


def f_rot(w: int, h: int, east: bool) -> np.ndarray:
    """180° display rotation for East-side references: x -> W-1-x, y -> H-1-y."""
    if not east:
        return np.eye(3)
    return np.array([[-1, 0, w - 1], [0, -1, h - 1], [0, 0, 1.0]])


def output_to_frame(H_i: np.ndarray, H_r: np.ndarray, F_r: np.ndarray, b: int) -> np.ndarray:
    """M = S_b^-1 · H_i · H_r^-1 · F_r · S_b (SPEC §6.4)."""
    S = s_b(b)
    return np.linalg.inv(S) @ H_i @ np.linalg.inv(H_r) @ F_r @ S


def apply_h(M: np.ndarray, x: np.ndarray, y: np.ndarray):
    X = M[0, 0] * x + M[0, 1] * y + M[0, 2]
    Y = M[1, 0] * x + M[1, 1] * y + M[1, 2]
    Wd = M[2, 0] * x + M[2, 1] * y + M[2, 2]
    return X / Wd, Y / Wd


# ---------------------------------------------------------------- Lanczos-3


def lanczos3(t: np.ndarray) -> np.ndarray:
    t = np.asarray(t, dtype=np.float64)
    out = np.zeros_like(t)
    m = np.abs(t) < 3
    out[m] = np.sinc(t[m]) * np.sinc(t[m] / 3)
    return out


def _mirror(i: np.ndarray, n: int) -> np.ndarray:
    i = np.where(i < 0, -i, i)
    i = np.where(i >= n, 2 * n - 2 - i, i)
    return np.clip(i, 0, n - 1)


def warp_lanczos3(src: np.ndarray, xs: np.ndarray, ys: np.ndarray, clamp: float = 0.3) -> np.ndarray:
    """Sample `src` (H,W) at continuous positions (xs, ys) per wbpp.md §3.2."""
    H, W = src.shape
    src = src.astype(np.float64)
    x0 = np.floor(xs)
    y0 = np.floor(ys)
    dx = xs - x0
    dy = ys - y0
    x0 = x0.astype(np.int64)
    y0 = y0.astype(np.int64)
    sp = np.zeros_like(xs, dtype=np.float64)
    sn = np.zeros_like(sp)
    wp = np.zeros_like(sp)
    wn = np.zeros_like(sp)
    for i in range(-2, 4):
        wy = lanczos3(i - dy)
        yy = _mirror(y0 + i, H)
        for j in range(-2, 4):
            wx = lanczos3(j - dx)
            xx = _mirror(x0 + j, W)
            w = wx * wy
            s = w * src[yy, xx]
            neg = s < 0
            sp += np.where(neg, 0, s)
            wp += np.where(neg, 0, w)
            sn += np.where(neg, -s, 0)
            wn += np.where(neg, -w, 0)
    with np.errstate(divide="ignore", invalid="ignore"):
        r = np.where(sp > 0, sn / sp, 0.0)
        c = np.where(r > clamp, 1.0 - ((r - clamp) / (1.0 - clamp)) ** 2, 1.0)
        c = np.where(r >= 1, 0.0, c)  # r >= 1: return sp/wp, i.e. drop the negative lobe entirely
        out = (sp - c * sn) / (wp - c * wn)
    outside = (xs < 0) | (xs > W - 1) | (ys < 0) | (ys > H - 1)
    out[outside] = np.nan
    return out


# ---------------------------------------------------------------- STF (mirrors tools/astro.py)


def mtf(m: float, x):
    x = np.asarray(x, dtype=np.float64)
    if m <= 0:
        return np.where(x > 0, 1.0, 0.0)
    if m >= 1:
        return np.where(x < 1, 0.0, 1.0)
    return ((m - 1) * x) / ((2 * m - 1) * x - m)


# ---------------------------------------------------------------- statistics


def median(x: np.ndarray) -> float:
    return float(np.median(x))


def bwmv_scale(x: np.ndarray) -> float:
    from importlib import import_module
    import sys
    from pathlib import Path
    sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "precompute"))
    return import_module("integrate").bwmv_scale(x)


def sn_estimator(x: np.ndarray) -> float:
    """Rousseeuw–Croux Sn = lomed_i himed_j |x_i − x_j| (no constant, no small-sample factor)."""
    x = np.asarray(x, dtype=np.float64)
    n = x.size
    hi_idx = n // 2  # 0-based index of the (floor(n/2)+1)-th smallest
    lo_idx = (n + 1) // 2 - 1  # 0-based index of the floor((n+1)/2)-th smallest
    inner = np.empty(n)
    for i in range(n):
        d = np.sort(np.abs(x[i] - x))
        inner[i] = d[hi_idx]
    return float(np.sort(inner)[lo_idx])


def sample_std(x: np.ndarray) -> float:
    x = np.asarray(x, dtype=np.float64)
    return float(np.std(x, ddof=1)) if x.size > 1 else 0.0


# ---------------------------------------------------------------- rejection (1-D, sorted stacks)


def kappa_sigma(x: np.ndarray, sigma_low: float = 4.0, sigma_high: float = 3.0) -> float:
    x = np.sort(np.asarray(x, dtype=np.float64))
    i, j = 0, x.size
    while j - i >= 3:
        v = x[i:j]
        m = median(v)
        s = sample_std(v)
        if 1 + s == 1:
            break
        i0, j0 = i, j
        while i < j and (m - x[i]) / s > sigma_low:
            i += 1
        while j > i and (x[j - 1] - m) / s > sigma_high:
            j -= 1
        if i == i0 and j == j0:
            break
    return float(np.mean(x[i:j])) if j > i else float("nan")


def winsorize(v: np.ndarray, cutoff: float = 5.0, use_sn: bool = True):
    """Huber/Winsorization loop (wbpp.md §4.6 step 1). Returns (m, sigma)."""
    v = np.array(v, dtype=np.float64)
    m = median(v)
    if use_sn:
        s = 1.1926 * sn_estimator(v)
    else:
        s = 1.4826 * float(np.median(np.abs(v - m)))
    if 1 + s == 1:
        return m, s
    it = 0
    while True:
        t0, t1 = m - 1.5 * s, m + 1.5 * s
        if it == 0 and cutoff > 0:
            c0, c1 = m - cutoff * s, m + cutoff * s
            v = np.where((v < c0) | (v > c1), m, v)
        v = np.clip(v, t0, t1)
        s_new = 1.134 * sample_std(v)
        m = float(np.mean(v))
        it += 1
        done = it > 1 and abs(s_new - s) / s < 0.0005
        s = s_new
        if done or 1 + s == 1 or it >= 50:
            break
    return m, s


def winsorized_sigma_clip(x: np.ndarray, sigma_low: float = 4.0, sigma_high: float = 3.0,
                          cutoff: float = 5.0, use_sn: bool = True) -> float:
    x = np.sort(np.asarray(x, dtype=np.float64))
    i, j = 0, x.size
    while j - i >= 3:
        m, s = winsorize(x[i:j], cutoff, use_sn)
        if 1 + s == 1:
            break
        i0, j0 = i, j
        while i < j and (m - x[i]) / s > sigma_low:
            i += 1
        while j > i and (x[j - 1] - m) / s > sigma_high:
            j -= 1
        if i == i0 and j == j0:
            break
    return float(np.mean(x[i:j])) if j > i else float("nan")


def _fn(n: int) -> float:
    return 1.0 / (1.0 - 2.9442 * n ** (-1.073))


def _sample_deviation(x: np.ndarray, mean: float) -> float:
    n = x.size
    d = np.sort(np.abs(x - mean))
    k = int(math.floor(0.683 * n))
    k = min(max(k, 0), n - 1)
    return _fn(n) * float(d[k])


def _line_fit_deviation(x: np.ndarray, mean: float) -> float:
    n = x.size
    n1 = int(0.683 * n + 0.317)
    if n1 < 8:
        return _sample_deviation(x, mean)
    y = np.sort(np.abs(x - mean))[:n1]
    k = np.arange(n1)
    xx = math.sqrt(2) * erfinv((k + 1 - 0.317) / n)
    b, a = np.polyfit(xx, y, 1)
    return _fn(n) * (a + b * 1.0)


def _q(z: float) -> float:
    return 0.5 * (1.0 - float(erf(z / math.sqrt(2))))


def rcr(x: np.ndarray, limit: float = 0.1) -> float:
    x = np.sort(np.asarray(x, dtype=np.float64))
    i, j = 0, x.size
    for phase in range(3):
        while True:
            v = x[i:j]
            n = j - i
            if n < 3:
                return float(np.mean(v)) if n > 0 else float("nan")
            if phase == 0:
                mean = median(v)
                sigma = _line_fit_deviation(v, mean)
            elif phase == 1:
                mean = median(v)
                sigma = _sample_deviation(v, mean)
            else:
                mean = float(np.mean(v))
                sigma = sample_std(v)
            if 1 + sigma == 1:
                return float(np.mean(v))
            d0 = n * _q((mean - x[i]) / sigma)
            d1 = n * _q((x[j - 1] - mean) / sigma)
            if d0 >= limit and d1 >= limit:
                break
            if d1 < d0:
                j -= 1
            else:
                i += 1
    return float(np.mean(x[i:j]))


def integrate_1d(x: np.ndarray, method: str, params: dict | None = None) -> float:
    p = params or {}
    x = np.asarray(x, dtype=np.float64)
    x = x[np.isfinite(x)]
    if x.size == 0:
        return float("nan")
    if method == "average":
        return float(np.mean(x))
    if method == "median":
        return float(np.median(x))
    if method == "kappaSigma":
        return kappa_sigma(x, p.get("sigmaLow", 4.0), p.get("sigmaHigh", 3.0))
    if method == "winsorized":
        return winsorized_sigma_clip(x, p.get("sigmaLow", 4.0), p.get("sigmaHigh", 3.0), p.get("cutoff", 5.0),
                                     use_sn=p.get("useSn", True))
    if method == "rcr":
        return rcr(x, p.get("limit", 0.1))
    raise ValueError(method)
