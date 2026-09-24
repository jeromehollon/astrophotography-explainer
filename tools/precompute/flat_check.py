#!/usr/bin/env python3
"""Numeric check that flat calibration removes the left-side dust mote (SPEC.md P4/P5).

1. Locates the big dust "double donut" precisely from flat_50_darkflat: a
   high-pass (local, sigma=3 minus sigma=60 Gaussian) search over a window
   around the approximate sensor location (x~700, y~2400) finds the darkest
   local dip, which is the mote's centre.
2. On frame f03 (dark-subtracted only, then each of the 9 flat variants),
   computes:
   - mote contrast: mean(core disk) / mean(surrounding annulus) - 1
   - vignetting residual: median(4 corner 300x300 boxes) / median(centre 600x600 box)

Expected (SPEC.md P4/P5, wbpp.md §6.4): the 50% dark-flat-calibrated flat
is the best mote removal, the 85% variants leave the mote visible (it's
still there in that batch's own flats, wbpp.md dataset note), and the
'none'-calibrated flats (no dark-flat/bias subtraction) over-correct
vignetting because the flat's own pedestal is left in.

Usage:
  uv run tools/precompute/flat_check.py
"""
from __future__ import annotations

import json
import sys
import time
from pathlib import Path

import numpy as np
from scipy.ndimage import gaussian_filter

REPO = Path(__file__).resolve().parents[2]
MASTERS_JSON = REPO / "data" / "derived" / "precompute" / "masters.json"
MASTERS_DIR = REPO / "data" / "derived" / "precompute" / "masters"
FRAMES_JSON = REPO / "data" / "derived" / "precompute" / "frames.json"
CAL_DIR = REPO / "source_images" / "calibration"
OUT_JSON = REPO / "data" / "derived" / "precompute" / "flat_check.json"

sys.path.insert(0, str(REPO / "tools"))
import astro  # noqa: E402

APPROX_CENTER = (700, 2400)  # (x, y), AGENTS.md
SEARCH_HALF = 400  # px, search window half-size around the approximate centre
# Radial profiling of flat_50_darkflat (see tools/precompute/README.md) shows the mote is a
# broad, shallow depression (~6.5% at its core) that only flattens out to the background level
# past ~r=140px, i.e. much bigger than a compact dust shadow. CORE_RADIUS sits in the deepest
# part; ANNULUS sits well outside the depression, in the flat background beyond r=140.
CORE_RADIUS = 25    # px, mote core disk
ANNULUS = (150, 220)  # px, surrounding ring used as local background
CORNER_BOX = 300
CENTRE_BOX = 600
FLAT_VARIANTS = ["none"] + [f"flat_{level}_{cal}" for level in (10, 50, 85) for cal in ("darkflat", "bias", "none")]


def locate_mote_center(flat: np.ndarray) -> tuple[int, int]:
    x0, y0 = APPROX_CENTER[0] - SEARCH_HALF, APPROX_CENTER[1] - SEARCH_HALF
    x1, y1 = APPROX_CENTER[0] + SEARCH_HALF, APPROX_CENTER[1] + SEARCH_HALF
    crop = flat[y0:y1, x0:x1].astype(np.float64)
    local = gaussian_filter(crop, 3) - gaussian_filter(crop, 60)  # removes the broad vignetting gradient
    cy, cx = np.unravel_index(np.argmin(local), local.shape)
    return x0 + int(cx), y0 + int(cy)


def _disk_annulus_means(img: np.ndarray, cx: int, cy: int) -> tuple[float, float]:
    h, w = img.shape
    yy, xx = np.mgrid[0:h, 0:w]
    r2 = (xx - cx) ** 2 + (yy - cy) ** 2
    core = img[r2 <= CORE_RADIUS ** 2]
    ring = img[(r2 >= ANNULUS[0] ** 2) & (r2 <= ANNULUS[1] ** 2)]
    return float(core.mean()), float(ring.mean())


def _corner_center_medians(img: np.ndarray) -> tuple[float, float]:
    h, w = img.shape
    c = CORNER_BOX
    corners = [img[0:c, 0:c], img[0:c, w - c:w], img[h - c:h, 0:c], img[h - c:h, w - c:w]]
    corner_med = float(np.median(np.concatenate([b.ravel() for b in corners])))
    ch, cw = CENTRE_BOX, CENTRE_BOX
    cy0, cx0 = h // 2 - ch // 2, w // 2 - cw // 2
    centre_med = float(np.median(img[cy0:cy0 + ch, cx0:cx0 + cw]))
    return corner_med, centre_med


def calibrate(light: np.ndarray, dark: np.ndarray, variant: str, masters_meta: dict) -> np.ndarray:
    c = light - dark
    if variant == "none":
        return c
    mf, _ = astro.load(MASTERS_DIR / f"{variant}.fits")
    mf = mf[0].astype(np.float64)
    f_v = masters_meta[variant]["scale_f_v"]["unit_0_1"]
    return c / (mf / f_v)


def main() -> None:
    t0 = time.monotonic()
    masters_meta = json.loads(MASTERS_JSON.read_text())
    frames = {f["id"]: f for f in json.loads(FRAMES_JSON.read_text())["frames"]}

    flat50, _ = astro.load(MASTERS_DIR / "flat_50_darkflat.fits")
    cx, cy = locate_mote_center(flat50[0].astype(np.float64))
    print(f"mote centre: ({cx}, {cy})", file=sys.stderr)

    f03 = frames["f03"]
    light, _ = astro.load(REPO / f03["source"])
    light = light[0].astype(np.float64)
    dark, _ = astro.load(CAL_DIR / "masterDark_BIN-1_6224x4168_EXPOSURE-300.00s.xisf")
    dark = dark[0].astype(np.float64)

    results = {}
    for variant in FLAT_VARIANTS:
        c = calibrate(light, dark, variant, masters_meta)
        core, ring = _disk_annulus_means(c, cx, cy)
        contrast = core / ring - 1.0 if ring else None
        corner, centre = _corner_center_medians(c)
        vignetting_residual = corner / centre if centre else None
        results[variant] = {
            "mote_contrast": contrast, "core_mean": core, "annulus_mean": ring,
            "vignetting_residual": vignetting_residual, "corner_median": corner, "centre_median": centre,
        }
        print(f"  {variant}: mote_contrast={contrast:.4f} vignetting_residual={vignetting_residual:.4f}",
              file=sys.stderr)

    out = {
        "mote_center_px": {"x": cx, "y": cy},
        "core_radius_px": CORE_RADIUS, "annulus_px": list(ANNULUS),
        "corner_box_px": CORNER_BOX, "centre_box_px": CENTRE_BOX,
        "frame": "f03", "variants": results, "runtime_s": time.monotonic() - t0,
    }
    OUT_JSON.write_text(json.dumps(out, indent=2))
    print(f"wrote {OUT_JSON} in {out['runtime_s']:.1f}s", file=sys.stderr)


if __name__ == "__main__":
    main()
