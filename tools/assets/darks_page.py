#!/usr/bin/env python3
"""Real image assets for the Darks lesson (P3).

Reproduces the app's calibration path for this page (SPEC.md §6.1–6.2) and writes PNGs for the
Figma frames plus the numbers the page quotes. The page shows a 64×64 native-pixel region of one
light frame, enlarged so single pixels are visible (nearest-neighbour, no binning), and the same
region of the master dark. The bias is applied to every light-frame image on this page because the
Bias lesson already covered it; the Darks page never mentions it.

Region choice: the master dark is used exactly as supplied (owner decision 2026-09-24: "trust the
master dark"). It cancels most hot pixels only partly (it carries about 37% of their excess in the
lights), so the window is centred on the brightest "well removed" hot pixel in the frame: bright in the
light (> 15 MADN above the background) and within 2 MADN of the background after subtraction. In f13
that is the pixel at (114, 895). (The frame's saturated hot pixels cancel too, but overshoot by about
3 MADN and print as dark holes, so they are excluded by the ±2 MADN rule.) The window must hold no
stars and no pixel that is hotter in the dark than in the light. The ROI stretch is stronger than
Flats-1's (target background 0.40, shadows clip −4 MADN) so the grain reads evenly and a dimmed hot
pixel still shows as dimmed. The circled pixel's position and values are in stats.json.

Reading column:
  grain_light.png     (L − B) on the region, one AutoSTF (target bg 0.30, clip −1.8 MADN), enlarged ×5
  dark_piece.png      a 376×252 native-pixel piece of the master dark around the region, stretched hard
                      (its own AutoSTF) so its grain and hot pixels show
  ampglow_full.png    the old-camera dark (ASI294MM Pro, 600 s), binned 2×2, AutoSTF (target bg 0.30,
                      clip −2.8 MADN). Display only: it shows amplifier glow; it is never applied.

Try it (same region, same enlargement, one STF shared by raw and computed):
  roi_raw.png                 L − B
  roi_computed_dark-off.png   identical to raw (nothing else happens with the dark off)
  roi_computed_dark-on.png    L − D   (the dark carries the bias, so B is not subtracted again)

  stats.json                  region position, hot-pixel counts and values, medians, every stretch used

Usage:
  uv run tools/assets/darks_page.py            # writes assets/darks/
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "tools"))
import astro  # noqa: E402

PRE = REPO / "data" / "derived" / "precompute"
CAL = REPO / "source_images" / "calibration"
OUT = REPO / "assets" / "darks"

FRAME = "f13"
DN = 65535.0
ROI = 64          # native pixels, square
ZOOM = 5          # nearest-neighbour enlargement for the page (64 × 5 = 320 px)
BORDER = 64       # keep the window away from the frame edge
ROI_STF = dict(target_bg=0.40, shadows_clip=-4.0)
FRAME_STF = dict(target_bg=0.30, shadows_clip=-2.8)
HOT_DN = 200.0    # a hot pixel: dark − bias above this many pixel-brightness units (65535 = full scale)


def enlarge(img: np.ndarray, k: int) -> np.ndarray:
    return np.repeat(np.repeat(img, k, axis=0), k, axis=1)


def bin2(img: np.ndarray) -> np.ndarray:
    h, w = (img.shape[0] // 2) * 2, (img.shape[1] // 2) * 2
    return img[:h, :w].reshape(h // 2, 2, w // 2, 2).mean(axis=(1, 3))


def save_gray(img: np.ndarray, path: Path, **kw) -> None:
    astro.save(np.clip(img, 0, 1)[None].astype(np.float32), path, bits=8, **kw)


def madn(x: np.ndarray) -> float:
    return float(1.4826 * np.median(np.abs(x - np.median(x))))


def box_sum(mask: np.ndarray, k: int) -> np.ndarray:
    """Sum of `mask` over every k×k window (top-left indexed), via a 2-D cumulative sum."""
    c = np.pad(mask.astype(np.int64), ((1, 0), (1, 0))).cumsum(0).cumsum(1)
    return c[k:, k:] - c[:-k, k:] - c[k:, :-k] + c[:-k, :-k]


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    frames = {f["id"]: f for f in json.load(open(PRE / "frames.json"))["frames"]}

    light, _ = astro.load(REPO / frames[FRAME]["source"])
    bias, _ = astro.load(next(CAL.glob("masterBias*.xisf")))
    dark, _ = astro.load(next(CAL.glob("masterDark*.xisf")))
    L, B, D = (a[0].astype(np.float64) for a in (light, bias, dark))
    H, W = L.shape

    # ---- pick the region: most hot pixels shared by light and dark, only sky, no dark-only pixels ----
    dark_excess = D - B
    hot = dark_excess > HOT_DN / DN
    lb = L - B
    sky_med, sky_madn = float(np.median(lb)), madn(lb)
    bright = lb > sky_med + 10 * sky_madn
    # stars are extended: a bright pixel with at least 4 bright neighbours in its 3×3 block
    nb = sum(np.roll(np.roll(bright, dy, 0), dx, 1) for dy in (-1, 0, 1) for dx in (-1, 0, 1)) - bright
    star = bright & (nb >= 4)
    dark_only = hot & ((lb - sky_med) < 0.5 * dark_excess)
    shared = hot & bright & ~star
    good = shared & (lb - sky_med > 15 * sky_madn) & (np.abs((L - D) - sky_med) < 2 * sky_madn)
    ok = (box_sum(star, ROI) == 0) & (box_sum(dark_only, ROI) == 0)
    best = None
    for gy, gx in np.argwhere(good):
        wy = int(np.clip(gy - ROI // 2, BORDER, H - BORDER - ROI))
        wx = int(np.clip(gx - ROI // 2, BORDER, W - BORDER - ROI))
        if not ok[wy, wx]:
            continue
        key = (float(lb[gy, gx] - sky_med), int(box_sum(shared, ROI)[wy, wx]))
        if best is None or key > best[0]:
            best = (key, wy, wx)
    if best is None:
        raise SystemExit("no well-removed hot pixel in a clean window")
    _, y0, x0 = best
    ys, xs = slice(y0, y0 + ROI), slice(x0, x0 + ROI)

    raw = lb[ys, xs]                     # L − B
    computed_on = (L - D)[ys, xs]        # L − D
    stf = astro.auto_stf(raw[None].astype(np.float32), **ROI_STF)
    show = lambda img: enlarge(astro.apply_stf(np.clip(img, 0, 1)[None].astype(np.float32), stf)[0], ZOOM)

    save_gray(show(raw), OUT / "roi_raw.png")
    save_gray(show(raw), OUT / "roi_computed_dark-off.png")
    save_gray(show(computed_on), OUT / "roi_computed_dark-on.png")
    save_gray(show(raw), OUT / "grain_light.png")

    # a native-resolution piece of the master dark around the region, stretched on its own statistics
    PW, PH = 376, 252
    py0 = int(np.clip(y0 + ROI // 2 - PH // 2, 0, H - PH))
    px0 = int(np.clip(x0 + ROI // 2 - PW // 2, 0, W - PW))
    dark_piece = D[py0:py0 + PH, px0:px0 + PW]
    stf_dark = astro.auto_stf(dark_piece[None].astype(np.float32), **ROI_STF)
    save_gray(astro.apply_stf(np.clip(dark_piece, 0, 1)[None].astype(np.float32), stf_dark)[0], OUT / "dark_piece.png")

    # ---- the old-camera dark: amplifier glow, display only ----
    old, old_hdr = astro.load(CAL / "darkFromOlderCamera.fits")
    old2 = bin2(old[0].astype(np.float64))
    stf_old = astro.auto_stf(old2[None].astype(np.float32), **FRAME_STF)
    save_gray(astro.apply_stf(old2[None].astype(np.float32), stf_old)[0], OUT / "ampglow_full.png")
    oh, ow = old2.shape
    centre = old2[oh // 2 - oh // 8: oh // 2 + oh // 8, ow // 2 - ow // 8: ow // 2 + ow // 8]
    edge_w = ow // 8
    edges = {
        "left": old2[:, :edge_w], "right": old2[:, -edge_w:],
        "top": old2[: oh // 8, :], "bottom": old2[-(oh // 8):, :],
    }

    hot_roi = hot[ys, xs]
    shared_roi = shared[ys, xs]
    good_roi = good[ys, xs]
    brightest = np.unravel_index(int(np.argmax(np.where(good_roi, raw, -1))), (ROI, ROI))
    ratio = dark_excess[shared] / (lb[shared] - sky_med)
    stats = {
        "frame": FRAME,
        "bias_applied_to_every_light_image": True,
        "region": {"x": int(x0), "y": int(y0), "w": ROI, "h": ROI, "zoom": ZOOM,
                   "chosen_by": "centred on the brightest well-removed hot pixel whose 64×64 window holds no stars and no dark-only pixels"},
        "hot_pixel_definition": {"dark_minus_bias_above_dn": HOT_DN,
                                 "light_minus_bias_above_background_madn": 10},
        "hot_pixels_in_region": {"in_dark": int(hot_roi.sum()), "shared_with_light": int(shared_roi.sum()),
                                 "well_removed": int(good_roi.sum())},
        "well_removed_definition": "light − bias above background by > 15 MADN, and light − dark within ±2 MADN of it",
        "hot_pixels_in_frame": {"in_dark": int(hot.sum()), "shared_with_light": int(shared.sum())},
        "dark_over_light_excess_ratio_percentiles": {
            "p10": float(np.percentile(ratio, 10)), "p50": float(np.percentile(ratio, 50)),
            "p90": float(np.percentile(ratio, 90))},
        "residual_after_dark_madn_median": float(np.median(((L - D)[shared] - sky_med)) / sky_madn),
        "circled_hot_pixel": {
            "x_in_region": int(brightest[1]), "y_in_region": int(brightest[0]),
            "raw_dn": float(raw[brightest] * DN),
            "computed_dark_on_dn": float(computed_on[brightest] * DN),
            "dark_minus_bias_dn": float(dark_excess[ys, xs][brightest] * DN),
            "background_median_dn": float(np.median(raw) * DN),
        },
        "region_background": {
            "raw_median_dn": float(np.median(raw) * DN), "raw_madn_dn": madn(raw) * DN,
            "computed_dark_on_median_dn": float(np.median(computed_on) * DN),
            "computed_dark_on_madn_dn": madn(computed_on) * DN,
        },
        "masters": {
            "bias_median_dn": float(np.median(B) * DN),
            "dark_median_dn": float(np.median(D) * DN),
            "dark_minus_bias_median_dn": float(np.median(dark_excess) * DN),
        },
        "stretches": {
            "roi": {"c0": stf[0][0], "m": stf[0][1], **ROI_STF},
            "dark_piece": {"c0": stf_dark[0][0], "m": stf_dark[0][1], **ROI_STF,
                           "crop": {"x": int(px0), "y": int(py0), "w": PW, "h": PH}},
            "ampglow": {"c0": stf_old[0][0], "m": stf_old[0][1], **FRAME_STF, "binning": 2},
        },
        "old_camera_dark": {
            "camera": old_hdr.get("INSTRUME"), "exposure_s": old_hdr.get("EXPTIME"),
            "ccd_temp_c": old_hdr.get("CCD-TEMP"), "size_px": [int(old.shape[2]), int(old.shape[1])],
            "median_dn": float(np.median(old2) * DN),
            "centre_median_dn": float(np.median(centre) * DN),
            "edge_median_dn": {k: float(np.median(v) * DN) for k, v in edges.items()},
        },
    }
    json.dump(stats, open(OUT / "stats.json", "w"), indent=1)
    print(json.dumps(stats, indent=1))


if __name__ == "__main__":
    main()
