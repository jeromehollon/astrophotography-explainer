"""Robust stacking primitives shared by the Stage-B precompute scripts.

Implements the estimators PixInsight's ImageIntegration uses (see
docs/knowledge/wbpp.md §4.2, §4.6): the biweight midvariance scale, a
two-sided trimmed mean, and Winsorized sigma-clipping average.

Deviation from wbpp.md: the Winsorized-clip initial sigma should be the
Rousseeuw-Croux Sn estimator (O(n^2) per pixel, too slow to vectorize over a
full frame). We use 1.4826*MAD instead, which is the same robust scale WBPP
itself uses for the AutoSTF and BWMV estimators elsewhere in the pipeline.
For the small, mostly-Gaussian stacks here (bias/dark/flat calibration
frames), Sn and MAD agree closely, so the resulting clip is not materially
different.
"""
from __future__ import annotations

import numpy as np


def bwmv_scale(x: np.ndarray) -> float:
    """sqrt(biweight midvariance) around the median. wbpp.md §4.2, c=9, MAD raw (unscaled)."""
    x = np.asarray(x, dtype=np.float64).ravel()
    n = x.size
    if n == 0:
        return 0.0
    m = np.median(x)
    mad = np.median(np.abs(x - m))
    if mad == 0:
        return 0.0
    y = (x - m) / (9.0 * mad)
    a = np.abs(y) < 1.0
    if not np.any(a):
        return 0.0
    num = n * np.sum(a * (x - m) ** 2 * (1.0 - y ** 2) ** 4)
    den = np.sum(a * (1.0 - y ** 2) * (1.0 - 5.0 * y ** 2)) ** 2
    if den == 0:
        return 0.0
    return float(np.sqrt(num / den))


def trimmed_mean(x: np.ndarray, frac: float = 0.05) -> float:
    """Two-sided trimmed mean: drop `frac` of the sorted sample from each end."""
    x = np.sort(np.asarray(x, dtype=np.float64).ravel())
    n = x.size
    k = int(np.floor(n * frac))
    if 2 * k >= n:
        k = 0
    return float(np.mean(x[k: n - k]))


def _winsorize_chunk(v: np.ndarray, cutoff: float, max_iter: int = 30, tol: float = 5e-4) -> tuple[np.ndarray, np.ndarray]:
    """Robust per-pixel (m, sigma) via the Huber/Winsorization loop, wbpp.md §4.6 step 1.

    v: (n, ...) float64 stack for one chunk. Returns (m, sigma) with the pixel axes of v[0].
    Initial sigma uses 1.4826*MAD in place of 1.1926*Sn (see module docstring).
    """
    m = np.median(v, axis=0)
    sigma = 1.4826 * np.median(np.abs(v - m), axis=0)
    sigma = np.where(sigma > 0, sigma, 1e-12)  # avoid div-by-zero on perfectly flat pixels
    w = v.copy()
    for it in range(max_iter):
        t0 = m - 1.5 * sigma
        t1 = m + 1.5 * sigma
        if it == 0:
            cut_lo = m - cutoff * sigma
            cut_hi = m + cutoff * sigma
            w = np.where(w < cut_lo, m, w)
            w = np.where(w > cut_hi, m, w)
            w = np.clip(w, t0, t1)
        else:
            w = np.clip(v, t0, t1)
        new_sigma = 1.134 * np.std(w, axis=0)
        new_sigma = np.where(new_sigma > 0, new_sigma, 1e-12)
        m = np.mean(w, axis=0)
        delta = np.abs(new_sigma - sigma) / sigma
        sigma = new_sigma
        if it >= 1 and np.max(delta) < tol:
            break
    return m, sigma


def winsorized_sigma_clip_average(stack: np.ndarray, sigma_low: float = 4.0, sigma_high: float = 3.0,
                                   cutoff: float = 5.0, chunk_rows: int = 256) -> np.ndarray:
    """Winsorized sigma-clipped average over axis 0, per wbpp.md §4.6 / §1.1.

    stack: (n, H, W) array (any input dtype; computed in float64, returned float32).
    Processes `chunk_rows` rows of the (H, W) plane at a time to bound memory, and is
    fully vectorized across pixels within each chunk. All frames get equal weight
    (WBPP's DontCare weight mode for bias/dark/flat integration).
    """
    n, h, w = stack.shape
    out = np.empty((h, w), dtype=np.float32)
    for r0 in range(0, h, chunk_rows):
        r1 = min(r0 + chunk_rows, h)
        v = stack[:, r0:r1, :].astype(np.float64)
        m, sigma = _winsorize_chunk(v, cutoff)
        # Final rejection uses the robust (m, sigma) against the ORIGINAL (unclamped) values.
        low = v < (m - sigma_low * sigma)
        high = v > (m + sigma_high * sigma)
        rejected = low | high
        # Safety: never reject down to fewer than 3 survivors for a pixel (wbpp.md §4.6).
        survivors = n - rejected.sum(axis=0)
        too_few = survivors < 3
        if np.any(too_few):
            rejected = rejected & ~too_few[None, :, :]
        keep = np.where(rejected, np.nan, v)
        out[r0:r1, :] = np.nanmean(keep, axis=0).astype(np.float32)
    return out
