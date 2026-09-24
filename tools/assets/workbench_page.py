#!/usr/bin/env python3
"""Real image assets for the Workbench page that are not already made for Light Frames 2.

The workbench's light-frame block, ROI strip and stacks reuse assets/light-frames-review/
(tools/assets/light_frames_review_page.py). This script adds the calibration tables:

  cal_<id>.png            each master calibration frame, whole field binned 4x (1556x1042).
                          Bias and dark use their own AutoSTF (target background 0.30, shadows
                          clip -2.8 MADN, the astro.py default strength) so the grain shows.
                          The dark flat and the flats use a linear stretch between their own
                          0.1 and 99.9 percentiles (the Flats-1 treatment), so vignetting and
                          dust show at every flat level, including the nearly featureless 85 %
  stats.json              per master: median and spread in pixel brightness (DN), the stretch,
                          and a 64-bin histogram over the master's own 0.1-99.9 percentile
                          range, drawn as vectors in Figma

Masters: masterBias, masterDark (300 s), darkflat_50, flat_10_darkflat, flat_50_darkflat,
flat_85_darkflat (the flats the learner can pick, each calibrated with its dark flats).

Usage:
  uv run tools/assets/workbench_page.py            # writes assets/workbench/
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
OUT = REPO / "assets" / "workbench"
DN = 65535.0
BIN = 4
STF = dict(target_bg=0.30, shadows_clip=-2.8)  # bias and dark only
N_BINS = 64

MASTERS = {
    "bias": ("Bias", lambda: next(CAL.glob("masterBias*.xisf"))),
    "dark": ("Dark", lambda: next(CAL.glob("masterDark*.xisf"))),
    "darkflat": ("Dark flat (50 %)", lambda: PRE / "masters" / "darkflat_50.fits"),
    "flat_10": ("Flat 10 %", lambda: PRE / "masters" / "flat_10_darkflat.fits"),
    "flat_50": ("Flat 50 %", lambda: PRE / "masters" / "flat_50_darkflat.fits"),
    "flat_85": ("Flat 85 %", lambda: PRE / "masters" / "flat_85_darkflat.fits"),
}


def binned(img: np.ndarray, b: int) -> np.ndarray:
    h, w = img.shape
    return img[: h // b * b, : w // b * b].reshape(h // b, b, w // b, b).mean(axis=(1, 3))


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    stats: dict = {"bin": BIN, "histogram_bins": N_BINS, "masters": {}}
    for mid, (title, path_fn) in MASTERS.items():
        img, _ = astro.load(path_fn())
        full = img[0].astype(np.float64)
        small = binned(full, BIN)
        if mid in ("bias", "dark"):
            stf = astro.auto_stf(small[None].astype(np.float32), **STF)
            shown = astro.apply_stf(np.clip(small, 0, 1)[None].astype(np.float32), stf)[0]
            stretch = {"kind": "autostf", "c0": stf[0][0], "m": stf[0][1], **STF}
        else:
            slo, shi = np.percentile(small, [0.1, 99.9])
            shown = np.clip((small - slo) / max(shi - slo, 1e-12), 0, 1)
            stretch = {"kind": "linear", "lo_dn": slo * DN, "hi_dn": shi * DN}
        astro.save(shown[None].astype(np.float32), OUT / f"cal_{mid}.png", bits=8)
        lo, hi = np.percentile(full, [0.1, 99.9])
        counts, edges = np.histogram(full, bins=N_BINS, range=(lo, hi))
        med = float(np.median(full))
        stats["masters"][mid] = {
            "title": title,
            "source": str(path_fn().relative_to(REPO)),
            "median_dn": med * DN,
            "madn_dn": float(1.4826 * np.median(np.abs(full - med)) * DN),
            "min_dn": float(full.min() * DN),
            "max_dn": float(full.max() * DN),
            "stretch": stretch,
            "histogram": {"lo_dn": lo * DN, "hi_dn": hi * DN, "counts": counts.tolist()},
        }
        print(f"{mid}: median {med * DN:.1f} DN", file=sys.stderr)
    json.dump(stats, open(OUT / "stats.json", "w"), indent=1)
    print(json.dumps({k: {kk: vv for kk, vv in v.items() if kk != "histogram"} for k, v in stats["masters"].items()}, indent=1))


if __name__ == "__main__":
    main()
