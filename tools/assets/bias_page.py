#!/usr/bin/env python3
"""Real image assets for the Calibration - Bias lesson.

Reproduces the app's bias-only calibration path (SPEC.md §6.2 with dark off: C = L - MB) on
frame f03 and writes PNGs for the Figma frames plus the numbers the page quotes.

Reading column:
  bias_full.png        the master bias, whole field, subsampled (every 5th pixel, no averaging)
                       so the per-pixel grain survives at page width; linear stretch between the
                       0.1 and 99.9 percentiles, which spans a few pixel-brightness units

Try it (light-frame ROI on the galaxy, native pixels, 3:2):
  roi_raw.png                  L
  roi_computed_bias.png        L - MB. One AutoSTF for both tiles, computed on THIS crop (target bg
                               0.30, clip -1.8 MADN): the raw tile then shows as uniformly brighter,
                               instead of the corrected one clipping to black
  roi_removed_bias.png         computed - raw = -MB, centred on mid grey on its own symmetric
                               stretch (darker = brightness taken away), so the bias pattern shows
  roi_removed_none.png         bias off: nothing removed (uniform neutral grey)

  stats.json                   average pixel brightness in the ROI before and after, the bias
                               average in the same ROI, master-bias statistics and every stretch

Usage:
  uv run tools/assets/bias_page.py            # writes assets/bias/
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
OUT = REPO / "assets" / "bias"

FRAME = "f03"
DN = 65535.0

# Light-frame ROI: 3:2 crop centred on the galaxy so the tile has something to look at while
# the average stays dominated by sky.
CROP_W, CROP_H = 720, 480
CROP_CENTER = (3120, 2096)

FULL_W = 1200
ROI_STF = dict(target_bg=0.30, shadows_clip=-1.8)


def subsample_to_width(img: np.ndarray, width: int) -> np.ndarray:
    """Keep every k-th pixel (no averaging) so noise statistics survive the size reduction."""
    k = max(1, round(img.shape[1] / width))
    return img[::k, ::k]


def percentile_stretch(img: np.ndarray, lo_p=0.1, hi_p=99.9):
    lo, hi = np.percentile(img, [lo_p, hi_p])
    return np.clip((img - lo) / max(hi - lo, 1e-12), 0, 1), (float(lo), float(hi))


def save_gray(img: np.ndarray, path: Path) -> None:
    astro.save(np.clip(img, 0, 1)[None].astype(np.float32), path, bits=8)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    frames = {f["id"]: f for f in json.load(open(PRE / "frames.json"))["frames"]}

    light, _ = astro.load(REPO / frames[FRAME]["source"])
    bias, _ = astro.load(next(CAL.glob("masterBias*.xisf")))
    L = light[0].astype(np.float64)
    B = bias[0].astype(np.float64)

    stats: dict = {"frame": FRAME, "camera_offset_setting": frames[FRAME]["offset"]}

    # ---- Reading column: the master bias, whole field, grain preserved ----
    b_show, b_lohi = percentile_stretch(subsample_to_width(B, FULL_W))
    save_gray(b_show, OUT / "bias_full.png")
    madn = 1.4826 * np.median(np.abs(B - np.median(B)))
    stats["bias_full"] = {
        "source": "masterBias_BIN-1_6224x4168.xisf, every 5th pixel, no averaging",
        "stretch": {"linear_lo_dn": b_lohi[0] * DN, "linear_hi_dn": b_lohi[1] * DN},
        "median_dn": float(np.median(B) * DN),
        "mean_dn": float(B.mean() * DN),
        "madn_dn": float(madn * DN),
        "min_dn": float(B.min() * DN),
        "max_dn": float(B.max() * DN),
    }

    # ---- Try it: light-frame ROI, bias off / on ----
    cx, cy = CROP_CENTER
    ys = slice(cy - CROP_H // 2, cy + CROP_H // 2)
    xs = slice(cx - CROP_W // 2, cx + CROP_W // 2)
    raw = L[ys, xs]
    b_roi = B[ys, xs]
    computed = raw - b_roi
    # The stretch comes from the corrected crop, so removing the pedestal never pushes the sky
    # below the shadows clip; the raw tile simply looks lifted.
    stf_roi = astro.auto_stf(computed[None].astype(np.float32), **ROI_STF)
    show_roi = lambda img: astro.apply_stf(np.clip(img, 0, 1)[None].astype(np.float32), stf_roi)[0]
    save_gray(show_roi(raw), OUT / "roi_raw.png")
    save_gray(show_roi(computed), OUT / "roi_computed_bias.png")

    # "What was removed": computed - raw = -bias, centred on mid grey. Its own symmetric stretch
    # around the bias median, otherwise a 160 DN pedestal on a 0.4 DN grain is a flat dark tile.
    diff = computed - raw
    centre = float(np.median(diff))
    span = float(np.percentile(np.abs(diff - centre), 99.5))
    save_gray(np.clip(0.5 + (diff - centre) / (2 * span), 0, 1), OUT / "roi_removed_bias.png")
    save_gray(np.full_like(raw, 0.5), OUT / "roi_removed_none.png")

    stats["experiment_1"] = {
        "crop": {"x": xs.start, "y": ys.start, "w": CROP_W, "h": CROP_H},
        "stf": {"c0": stf_roi[0][0], "m": stf_roi[0][1], **ROI_STF},
        "removed_stretch_dn": {"grey": centre * DN, "span": span * DN},
        "roi_mean_raw_dn": float(raw.mean() * DN),
        "roi_mean_computed_dn": float(computed.mean() * DN),
        "roi_mean_bias_dn": float(b_roi.mean() * DN),
        "roi_median_raw_dn": float(np.median(raw) * DN),
        "roi_median_computed_dn": float(np.median(computed) * DN),
    }

    json.dump(stats, open(OUT / "stats.json", "w"), indent=1)
    print(json.dumps(stats, indent=1))


if __name__ == "__main__":
    main()
