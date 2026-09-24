#!/usr/bin/env python3
"""Real image assets for the Algorithms lesson.

The page teaches how a stack combines the values one pixel has across many frames, and how
each combination method treats an unusual value. The example is the real satellite trail in
frame f03. Every frame is fully calibrated first (SPEC §6.2: minus the master dark, divided by
the dark-flat-calibrated 50 % flat), registered onto f03 with the Stage A homographies
(SPEC §6.4; scipy cubic spline stands in for Lanczos-3 at design time), and normalized onto
f03 with the global scale + offset rule (SPEC §6.5). f03 is the reference frame, so its own
trail pixels are never resampled.

Try it (two 576x576 tiles on the trail: a 2304 px crop at bin 4. The trail is about 30 DN over a
42 DN noise per native pixel, so at bin 1 or 2 f03 is not reliably the brightest of four values
and the median only halves the trail. At bin 4 the noise is 12 DN and the median removes it.
The crop centre is the spot the Noise & Defects page used):
  roi_f03.png ... roi_f05.png     the four input frames (f03 with the trail, plus f02, f04, f05)
  stack4_average.png              the four frames averaged: the trail survives at a quarter strength
  stack4_median.png               the median of the four: the trail is gone

One pixel (the numbers in the "What happens to one pixel" box):
  stats.json  ->  "one_pixel"     the four brightnesses of one trail pixel, their average and median

Closing comparison (the same crop, all 20 raw frames, one tile per method):
  stack20_average.png, stack20_median.png, stack20_kappa_sigma.png,
  stack20_winsorized.png, stack20_rcr.png
  The rejection methods follow docs/knowledge/wbpp.md §4.6 with WBPP's constants: kappa-sigma
  4 / 3, winsorized 4 / 3 with cutoff 5, Robust Chauvenet with limit 0.1. The winsorized loop
  starts from 1.4826·MAD rather than Rousseeuw-Croux Sn (same stand-in as tools/precompute).

Every tile shares one AutoSTF computed on the f03 crop (target bg 0.30, shadows clip -1.8 MADN),
the Flats-1 lesson stretch. stats.json records the crop, the STF, the trail brightness above the
background and the noise in every tile, and the share of trail pixels where a method rejected f03.

Usage:
  uv run tools/assets/algorithms_page.py            # writes assets/algorithms/
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
from scipy import ndimage
from scipy.special import erfc, erfinv

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "tools"))
import astro  # noqa: E402

PRE = REPO / "data" / "derived" / "precompute"
CAL = REPO / "source_images" / "calibration"
OUT = REPO / "assets" / "algorithms"

REF = "f03"
FOUR = ["f03", "f02", "f04", "f05"]  # SPEC's Satellite Trail Challenge minus f07 (owner: 4 frames)
TWENTY = [f"f{i:02d}" for i in range(20)]  # the raw frames; synthetic variants excluded
CAL_STATE = "dark|flat_50_darkflat"
FLAT_ID = "flat_50_darkflat"
DN = 65535.0

BIN = 4  # the trail is about 30 DN over a 42 DN native noise; at bin 4 the median separates it (see stats)
TILE = 576  # px, the tile as shown
CROP = TILE * BIN  # native pixels covered by the tile
CENTRE = (4760, 2850)  # on the f03 trail, same spot as assets/noise/tour_satellite.png
STF = dict(target_bg=0.30, shadows_clip=-1.8)

KAPPA = dict(sigma_low=4.0, sigma_high=3.0)
WINSOR = dict(sigma_low=4.0, sigma_high=3.0, cutoff=5.0)
RCR_LIMIT = 0.1


# ----------------------------------------------------------------------------- data
def save_gray(img: np.ndarray, path: Path) -> None:
    astro.save(np.clip(img, 0, 1)[None].astype(np.float32), path, bits=8)


def load_calibrated(frame: dict, dark: np.ndarray, flat_rel: np.ndarray) -> np.ndarray:
    light, _ = astro.load(REPO / frame["source"])
    L = light[0].astype(np.float64)
    if frame["needs_flipud"]:
        L = L[::-1]
    return (L - dark) / flat_rel


def binned(img: np.ndarray, b: int = BIN) -> np.ndarray:
    h, w = img.shape
    return img[: h // b * b, : w // b * b].reshape(h // b, b, w // b, b).mean(axis=(1, 3))


def crop_on_reference(img: np.ndarray, H_ref: np.ndarray, H_frame: np.ndarray, x0: int, y0: int) -> np.ndarray:
    """Resample `img` onto the reference crop [y0:y0+CROP, x0:x0+CROP] (reference pixel -> frame pixel)."""
    M = H_frame @ np.linalg.inv(H_ref)
    yy, xx = np.mgrid[y0 : y0 + CROP, x0 : x0 + CROP].astype(np.float64)
    q = M @ np.stack([xx.ravel(), yy.ravel(), np.ones(xx.size)])
    qx, qy = q[0] / q[2], q[1] / q[2]
    return ndimage.map_coordinates(img, [qy, qx], order=3, mode="reflect").reshape(CROP, CROP)


# ----------------------------------------------------------------------------- stacking
def _too_few(rej: np.ndarray, n: int) -> np.ndarray:
    """Undo rejections on pixels that would drop below 3 survivors (wbpp.md §4.6)."""
    return rej & ~((n - rej.sum(axis=0)) < 3)[None]


def kappa_sigma(stack: np.ndarray, sigma_low: float, sigma_high: float, max_iter: int = 30):
    v = stack.astype(np.float64)
    keep = np.ones(v.shape, bool)
    for _ in range(max_iter):
        w = np.where(keep, v, np.nan)
        m = np.nanmedian(w, axis=0)
        s = np.nanstd(w, axis=0)
        s = np.where(s > 0, s, 1e-12)
        new = keep & (((m - v) / s > sigma_low) | ((v - m) / s > sigma_high))
        new = _too_few(new, keep.sum(axis=0))
        if not new.any():
            break
        keep &= ~new
    return np.nanmean(np.where(keep, v, np.nan), axis=0), ~keep


def winsorized(stack: np.ndarray, sigma_low: float, sigma_high: float, cutoff: float, max_iter: int = 30):
    v = stack.astype(np.float64)
    keep = np.ones(v.shape, bool)
    for _ in range(max_iter):
        w0 = np.where(keep, v, np.nan)
        m = np.nanmedian(w0, axis=0)
        s = 1.4826 * np.nanmedian(np.abs(w0 - m), axis=0)
        s = np.where(s > 0, s, 1e-12)
        w = w0.copy()
        for it in range(30):  # Huber loop
            t0, t1 = m - 1.5 * s, m + 1.5 * s
            if it == 0:
                w = np.where((w < m - cutoff * s) | (w > m + cutoff * s), m, w)
                w = np.clip(w, t0, t1)
            else:
                w = np.clip(w0, t0, t1)
            ns = 1.134 * np.nanstd(w, axis=0)
            ns = np.where(ns > 0, ns, 1e-12)
            m = np.nanmean(w, axis=0)
            delta = np.abs(ns - s) / s
            s = ns
            if it >= 1 and np.nanmax(delta) < 5e-4:
                break
        new = keep & (((m - v) / s > sigma_low) | ((v - m) / s > sigma_high))
        new = _too_few(new, keep.sum(axis=0))
        if not new.any():
            break
        keep &= ~new
    return np.nanmean(np.where(keep, v, np.nan), axis=0), ~keep


def _fn(n: np.ndarray) -> np.ndarray:
    return 1.0 / (1.0 - 2.9442 * np.power(n.astype(np.float64), -1.073))


def _sample_deviation(dev_sorted: np.ndarray, n: np.ndarray) -> np.ndarray:
    """FN(N) · the floor(0.683 N)-th smallest |x − mean| (1-based), per pixel."""
    k = np.maximum(np.floor(0.683 * n).astype(int) - 1, 0)
    return _fn(n) * np.take_along_axis(dev_sorted, k[None], axis=0)[0]


def _linefit_deviation(dev_sorted: np.ndarray, n: np.ndarray) -> np.ndarray:
    out = _sample_deviation(dev_sorted, n)
    for N in np.unique(n):
        npr = int(0.683 * N + 0.317)
        if npr < 8:
            continue
        sel = n == N
        y = dev_sorted[:npr][:, sel]  # (npr, P)
        x = np.sqrt(2.0) * erfinv((np.arange(npr) + 1 - 0.317) / N)
        xm, ym = x.mean(), y.mean(axis=0)
        b = ((x - xm)[:, None] * (y - ym)).sum(axis=0) / ((x - xm) ** 2).sum()
        a = ym - b * xm
        out[sel] = _fn(np.array(N)) * (a + b)
    return out


def rcr(stack: np.ndarray, limit: float):
    """Robust Chauvenet rejection, wbpp.md §4.6, vectorised over pixels (i, j window per pixel)."""
    n_all, h, w = stack.shape
    P = h * w
    data = np.sort(stack.reshape(n_all, P).astype(np.float64), axis=0)
    i = np.zeros(P, int)
    j = np.full(P, n_all)
    idx = np.arange(n_all)[:, None]
    for phase in range(3):
        active = np.ones(P, bool)
        while active.any():
            win = (idx >= i[None]) & (idx < j[None])
            n = j - i
            wv = np.where(win, data, np.nan)
            if phase < 2:
                mean = np.nanmedian(wv, axis=0)
            else:
                mean = np.nanmean(wv, axis=0)
            dev = np.where(win, np.abs(data - mean), np.inf)
            dev_sorted = np.sort(dev, axis=0)
            if phase == 0:
                sigma = _linefit_deviation(dev_sorted, n)
            elif phase == 1:
                sigma = _sample_deviation(dev_sorted, n)
            else:
                sigma = np.nanstd(wv, axis=0)
            stop = (1 + sigma == 1) | (n < 3)
            sigma = np.where(sigma > 0, sigma, 1e-12)
            lo = np.take_along_axis(data, i[None], axis=0)[0]
            hi = np.take_along_axis(data, (j - 1)[None], axis=0)[0]
            q = lambda z: 0.5 * erfc(z / np.sqrt(2.0))
            d0 = n * q((mean - lo) / sigma)
            d1 = n * q((hi - mean) / sigma)
            done = stop | ((d0 >= limit) & (d1 >= limit))
            rej = active & ~done
            j = np.where(rej & (d1 < d0), j - 1, j)
            i = np.where(rej & ~(d1 < d0), i + 1, i)
            active = rej
    win = (idx >= i[None]) & (idx < j[None])
    out = np.nanmean(np.where(win, data, np.nan), axis=0).reshape(h, w)
    # which ORIGINAL frames were rejected: a frame is out when its rank in the sorted stack falls outside [i, j)
    rank = np.argsort(np.argsort(stack.reshape(n_all, P), axis=0), axis=0)
    rejected = ((rank < i[None]) | (rank >= j[None])).reshape(n_all, h, w)
    return out, rejected


# ----------------------------------------------------------------------------- main
def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    frames = {f["id"]: f for f in json.load(open(PRE / "frames.json"))["frames"]}
    masters = json.load(open(PRE / "masters.json"))
    norm = json.load(open(PRE / "normalization.json"))["frames"]

    dark, _ = astro.load(next(CAL.glob("masterDark*.xisf")))
    D = dark[0].astype(np.float64)
    flat, _ = astro.load(PRE / "masters" / f"{FLAT_ID}.fits")
    flat_rel = flat[0].astype(np.float64) / masters[FLAT_ID]["scale_f_v"]["unit_0_1"]

    x0, y0 = CENTRE[0] - CROP // 2, CENTRE[1] - CROP // 2
    H = {fid: np.array(frames[fid]["alignment"]["matrix_ref_to_frame"]).reshape(3, 3) for fid in TWENTY}
    n_ref = norm[REF]["states"][CAL_STATE]
    m_r, s_r = n_ref["median_dn"] / DN, n_ref["bwmv_dn"] / DN

    crops: dict[str, np.ndarray] = {}
    for fid in TWENTY:
        img = load_calibrated(frames[fid], D, flat_rel)
        c = img[y0 : y0 + CROP, x0 : x0 + CROP] if fid == REF else crop_on_reference(img, H[REF], H[fid], x0, y0)
        n_f = norm[fid]["states"][CAL_STATE]
        crops[fid] = binned((c - n_f["median_dn"] / DN) * (s_r / (n_f["bwmv_dn"] / DN)) + m_r)
        print(f"loaded {fid}", file=sys.stderr)

    stf = astro.auto_stf(crops[REF][None].astype(np.float32), **STF)
    show = lambda img: astro.apply_stf(np.clip(img, 0, 1)[None].astype(np.float32), stf)[0]
    for fid in FOUR:
        save_gray(show(crops[fid]), OUT / f"roi_{fid}.png")

    # --- the trail as a straight line, fitted on f03 minus the median of the other frames, so the
    # on-trail / off-trail measurements are not biased by picking noisy pixels
    others = np.median(np.stack([crops[f] for f in TWENTY if f != REF]), axis=0)
    diff = crops[REF] - others
    c = TILE // 2
    yy, xx = np.mgrid[:TILE, :TILE].astype(np.float64)
    best = None
    for ang in np.linspace(-0.5, 0.5, 41):  # radians around the diagonal the trail follows in this crop
        v = np.array([np.cos(np.pi / 4 + ang), -np.sin(np.pi / 4 + ang)])
        dist = (xx - c) * (-v[1]) + (yy - c) * v[0]
        for off in range(-60, 61):
            val = diff[np.abs(dist - off) < 1.5].mean()
            if best is None or val > best[0]:
                best = (val, ang, off, v)
    _, ang, off, v = best
    dist = (xx - c) * (-v[1]) + (yy - c) * v[0] - off
    madn = lambda x: 1.4826 * np.median(np.abs(x - np.median(x)))
    starfree = np.abs(others - np.median(others)) < 3 * madn(others)
    on_trail = (np.abs(dist) < 1.5) & starfree
    off_trail = (np.abs(dist) > 4) & (np.abs(dist) < 20) & starfree
    trail = on_trail
    background = off_trail
    bg_level = float(np.median(crops[REF][off_trail]))

    def trail_excess_dn(img: np.ndarray) -> float:
        return float((img[on_trail].mean() - img[off_trail].mean()) * DN)

    def noise_dn(img: np.ndarray) -> float:
        return float(madn(img[off_trail]) * DN)

    # --- four-frame stack
    s4 = np.stack([crops[f] for f in FOUR])
    avg4, med4 = s4.mean(axis=0), np.median(s4, axis=0)
    save_gray(show(avg4), OUT / "stack4_average.png")
    save_gray(show(med4), OUT / "stack4_median.png")

    # --- one pixel: on the trail line within 96 px of the crop centre, the pixel where frame 3 stands
    # out most clearly from the other three, with those three within 2 noise widths of the background
    # (so the example shows the trail, not a stray hot or cold pixel)
    bg_noise = noise_dn(crops[REF]) / DN
    others4 = np.stack([crops[f] for f in FOUR[1:]])
    quiet = (np.abs(others4 - bg_level) < 2 * bg_noise).all(axis=0)
    near = (xx - c) ** 2 + (yy - c) ** 2 < 96 ** 2
    score = np.where(on_trail & quiet & near, crops[REF] - others4.max(axis=0), -np.inf)
    py, px = np.unravel_index(np.argmax(score), score.shape)
    vals = [float(round(crops[f][py, px] * DN)) for f in FOUR]
    one_pixel = {
        "crop_xy": [int(px), int(py)],
        "frames": FOUR,
        "brightness_dn": vals,
        "average_dn": float(np.mean(vals)),
        "median_dn": float(np.median(vals)),
        "background_median_dn": bg_level * DN,
        "how_chosen": "on the fitted trail line within 96 px of the crop centre, the pixel where frame 3 exceeds the other three by the most, those three within 2 noise widths of the background",
    }

    # --- twenty-frame stacks, one per method
    s20 = np.stack([crops[f] for f in TWENTY])
    results = {"average": (s20.mean(axis=0), np.zeros(s20.shape, bool)), "median": (np.median(s20, axis=0), np.zeros(s20.shape, bool))}
    ks, ks_rej = kappa_sigma(s20, **KAPPA)
    ws, ws_rej = winsorized(s20, **WINSOR)
    rc, rc_rej = rcr(s20, RCR_LIMIT)
    results["kappa_sigma"] = (ks, ks_rej)
    results["winsorized"] = (ws, ws_rej)
    results["rcr"] = (rc, rc_rej)
    stack20 = {}
    for name, (img, rej) in results.items():
        save_gray(show(img), OUT / f"stack20_{name}.png")
        f03_rejected_on_trail = float(rej[TWENTY.index(REF)][trail].mean())
        stack20[name] = {
            "trail_excess_dn": trail_excess_dn(img),
            "noise_madn_dn": noise_dn(img),
            "share_of_trail_pixels_where_f03_was_rejected": f03_rejected_on_trail,
        }
    # four-frame versions of the rejection methods, for the prose claim that kappa-sigma cannot reject
    ks4, ks4_rej = kappa_sigma(s4, **KAPPA)
    ws4, ws4_rej = winsorized(s4, **WINSOR)
    rc4, rc4_rej = rcr(s4, RCR_LIMIT)

    stats = {
        "reference_frame": REF,
        "calibration": CAL_STATE,
        "crop": {"x": x0, "y": y0, "size_native": CROP, "bin": BIN, "tile": TILE, "centre": list(CENTRE)},
        "stf": {"c0": stf[0][0], "m": stf[0][1], **STF},
        "warp": "scipy map_coordinates cubic (design-time stand-in for Lanczos-3)",
        "trail_line": {"direction_xy": v.tolist(), "offset_px": int(off), "on_trail_pixels": int(on_trail.sum()), "measure": "mean within 1.5 px of the line minus mean 4-20 px away, star-free pixels only; noise is MADN off the trail"},
        "four_frames": {
            "frames": FOUR,
            "trail_excess_dn": {"f03": trail_excess_dn(crops[REF]), "average": trail_excess_dn(avg4), "median": trail_excess_dn(med4),
                                 "kappa_sigma": trail_excess_dn(ks4), "winsorized": trail_excess_dn(ws4), "rcr": trail_excess_dn(rc4)},
            "share_of_trail_pixels_where_f03_was_rejected": {
                "kappa_sigma": float(ks4_rej[0][trail].mean()), "winsorized": float(ws4_rej[0][trail].mean()), "rcr": float(rc4_rej[0][trail].mean())},
            "noise_madn_dn": {"f03": noise_dn(crops[REF]), "average": noise_dn(avg4), "median": noise_dn(med4)},
        },
        "one_pixel": one_pixel,
        "twenty_frames": {"frames": TWENTY, "parameters": {"kappa_sigma": KAPPA, "winsorized": WINSOR, "rcr_limit": RCR_LIMIT}, "methods": stack20},
    }
    json.dump(stats, open(OUT / "stats.json", "w"), indent=1)
    print(json.dumps(stats, indent=1))


if __name__ == "__main__":
    main()
