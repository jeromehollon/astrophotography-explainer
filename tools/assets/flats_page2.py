#!/usr/bin/env python3
"""Real image assets for the Flats, continued (page 2) lesson: how bright should a flat be?

Same calibration path as Flats-1 (SPEC.md §6.2: dark on, bias inside the dark, dark-flat
calibrated master flats from Stage B) applied to frame f03 with the 10 %, 50 % and 85 % flats.

Illustration slot (drawn in Figma from the numbers written here):
  histograms.json          one raw flat per level (frame 0000, as shot, pedestal included),
                           256 bins over 0..65535, counts normalised so each peak is 1.0.
                           Teaching choice (owner, 2026-09-24): equal-height peaks on one linear
                           brightness axis; the true counts are kept alongside.

Reading column:
  flat_full_10.png / _50 / _85   dark-flat-calibrated master flats, full field binned x5, ONE linear
                           stretch shared by all three (taken from the 50 % flat's relative response)
                           so the 85 % flat is seen to be featureless
  roi_problem_85.png       4:3 crop of the mote ROI corrected with the 85 % flat (the mote stays)

Try it (light-frame ROI around the left-side dust mote, native pixels, Flats-1 crop):
  roi_raw.png                  (L - D)
  roi_computed_<10|50|85>.png  (L - D) / (flat_<lvl>_darkflat / f_v)
  roi_removed_<10|50|85>.png   computed - raw centred on mid grey, one symmetric stretch for all three
  The light ROIs share one AutoSTF computed on the raw crop (target bg 0.30, clip -1.8 MADN), as on Flats-1.

  stats.json               per-level exposure, level, mote contrast and vignetting, plus every stretch

Usage:
  uv run tools/assets/flats_page2.py            # writes assets/flats-2/
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
RAW_FLATS = CAL / "raw flats"
OUT = REPO / "assets" / "flats-2"

FRAME = "f03"
DN = 65535.0
LEVELS = (10, 50, 85)
EXPOSURE_S = {10: 0.11, 50: 2.24, 85: 10.0}  # the wizard's chosen exposure per level

# Same crop as Flats-1 experiment 1 (tools/assets/flats_page1.py)
CROP_W, CROP_H = 720, 480
CENTER_SHIFT = (40, 60)
CORE_R = 25
PROBLEM_W, PROBLEM_H = 640, 480  # 4:3 for the 440x330 slot

FULL_W = 1200
ROI_STF = dict(target_bg=0.30, shadows_clip=-1.8)
HIST_BINS = 256


def bin_to_width(img: np.ndarray, width: int) -> np.ndarray:
    h, w = img.shape
    k = max(1, round(w / width))
    hh, ww = (h // k) * k, (w // k) * k
    return img[:hh, :ww].reshape(hh // k, k, ww // k, k).mean(axis=(1, 3))


def save_gray(img: np.ndarray, path: Path) -> None:
    astro.save(np.clip(img, 0, 1)[None].astype(np.float32), path, bits=8)


def core_mean(img: np.ndarray, cx: int, cy: int, r: int) -> float:
    yy, xx = np.ogrid[: img.shape[0], : img.shape[1]]
    return float(img[(xx - cx) ** 2 + (yy - cy) ** 2 <= r * r].mean())


def raw_flat_path(level: int) -> Path:
    folder = RAW_FLATS / f"{level}% histogram"
    exp = f"{EXPOSURE_S[level]:.2f}s"
    def is_flat(p: Path) -> bool:  # the flats sit under FLAT/, the dark flats under DARK/ or dark/
        return "dark" not in p.relative_to(folder).as_posix().lower()

    cands = sorted(p for p in folder.rglob("*FRAME_0000*.xisf") if p.name.endswith(f"_{exp}.xisf") and is_flat(p))
    if not cands:
        raise FileNotFoundError(f"no raw flat for {level}% at {exp} under {folder}")
    return cands[0]


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    frames = {f["id"]: f for f in json.load(open(PRE / "frames.json"))["frames"]}
    masters = json.load(open(PRE / "masters.json"))
    check = json.load(open(PRE / "flat_check.json"))
    mx, my = check["mote_center_px"]["x"], check["mote_center_px"]["y"]
    sat_dn = json.load(open(PRE / "histograms.json"))["saturation_threshold_adu"]

    stats: dict = {"frame": FRAME, "mote_center_px": check["mote_center_px"], "levels": {}}

    # ---- Histograms: one raw flat per level, as shot ----
    hist = {"lo": 0.0, "hi": DN, "n": HIST_BINS, "levels": {}}
    edges = np.linspace(0, DN, HIST_BINS + 1)
    for lvl in LEVELS:
        p = raw_flat_path(lvl)
        img, _ = astro.load(p)
        dn = img[0].astype(np.float64) * DN
        counts, _ = np.histogram(dn, bins=edges)
        peak = int(counts.argmax())
        hist["levels"][lvl] = {
            "source": str(p.relative_to(REPO)),
            "exposure_s": EXPOSURE_S[lvl],
            "median_dn": float(np.median(dn)),
            "p99_9_dn": float(np.percentile(dn, 99.9)),
            "max_dn": float(dn.max()),
            "saturated_fraction": float((dn >= sat_dn).mean()),
            "peak_bin_centre_dn": float((edges[peak] + edges[peak + 1]) / 2),
            "counts": counts.tolist(),
            "normalised": (counts / counts.max()).tolist(),
        }
        del img, dn
    json.dump(hist, open(OUT / "histograms.json", "w"))

    # ---- Load light, dark, and the three dark-flat-calibrated master flats (relative response) ----
    light, _ = astro.load(REPO / frames[FRAME]["source"])
    dark, _ = astro.load(next(CAL.glob("masterDark*.xisf")))
    raw_full = light[0].astype(np.float64) - dark[0].astype(np.float64)
    del light, dark

    flats = {}
    for lvl in LEVELS:
        vid = f"flat_{lvl}_darkflat"
        f, _ = astro.load(PRE / "masters" / f"{vid}.fits")
        flats[lvl] = f[0].astype(np.float64) / masters[vid]["scale_f_v"]["unit_0_1"]
        stats["levels"][lvl] = {
            "master": vid,
            "exposure_s": EXPOSURE_S[lvl],
            "master_median_dn": masters[vid]["median_dn"],
            "master_max_dn": masters[vid]["max_dn"],
            "raw_flat_median_dn": hist["levels"][lvl]["median_dn"],
            "raw_flat_saturated_fraction": hist["levels"][lvl]["saturated_fraction"],
            "mote_contrast_after": check["variants"][vid]["mote_contrast"],
            "vignetting_residual_after": check["variants"][vid]["vignetting_residual"],
        }

    # ---- Reading column: three full-field flats on ONE linear stretch (from the 50 % flat) ----
    binned = {lvl: bin_to_width(flats[lvl], FULL_W) for lvl in LEVELS}
    lo, hi = np.percentile(binned[50], [0.1, 99.9])
    for lvl in LEVELS:
        save_gray((binned[lvl] - lo) / (hi - lo), OUT / f"flat_full_{lvl}.png")
        b = binned[lvl]
        h, w = b.shape
        cb, bb = 300 // 5, 600 // 5  # corner / centre boxes as in flat_check, in binned px
        corners = [b[:cb, :cb], b[:cb, -cb:], b[-cb:, :cb], b[-cb:, -cb:]]
        centre = b[h // 2 - bb // 2 : h // 2 + bb // 2, w // 2 - bb // 2 : w // 2 + bb // 2]
        stats["levels"][lvl]["flat_corner_over_centre"] = float(np.median(np.concatenate([c.ravel() for c in corners])) / np.median(centre))
    stats["flat_full"] = {"source": "flat_<lvl>_darkflat relative response (f_v = 1), binned x5",
                          "stretch": {"linear_lo": float(lo), "linear_hi": float(hi), "taken_from": "flat_50_darkflat 0.1-99.9 percentiles"}}

    # ---- Try it: light-frame ROI ----
    cx, cy = mx + CENTER_SHIFT[0], my + CENTER_SHIFT[1]
    ys = slice(cy - CROP_H // 2, cy + CROP_H // 2)
    xs = slice(cx - CROP_W // 2, cx + CROP_W // 2)
    raw = raw_full[ys, xs]
    stf_roi = astro.auto_stf(raw[None].astype(np.float32), **ROI_STF)
    show_roi = lambda img: astro.apply_stf(np.clip(img, 0, 1)[None].astype(np.float32), stf_roi)[0]
    save_gray(show_roi(raw), OUT / "roi_raw.png")
    lcx, lcy = mx - xs.start, my - ys.start
    computed = {lvl: raw / flats[lvl][ys, xs] for lvl in LEVELS}
    diffs = {lvl: c - raw for lvl, c in computed.items()}
    span = float(np.percentile(np.abs(np.concatenate([d.ravel() for d in diffs.values()])), 99.5))
    diff_show = lambda d: np.clip(0.5 + d / (2 * span), 0, 1)
    raw_core = core_mean(raw, lcx, lcy, CORE_R) * DN
    stats["try_it"] = {
        "crop": {"x": xs.start, "y": ys.start, "w": CROP_W, "h": CROP_H},
        "stf": {"c0": stf_roi[0][0], "m": stf_roi[0][1], **ROI_STF},
        "removed_stretch_dn": {"grey": 0.0, "span": span * DN},
        "core_radius_px": CORE_R,
        "raw_core_dn": raw_core,
        "raw_mote_contrast": check["variants"]["none"]["mote_contrast"],
        "levels": {},
    }
    for lvl in LEVELS:
        save_gray(show_roi(computed[lvl]), OUT / f"roi_computed_{lvl}.png")
        save_gray(diff_show(diffs[lvl]), OUT / f"roi_removed_{lvl}.png")
        comp_core = core_mean(computed[lvl], lcx, lcy, CORE_R) * DN
        stats["try_it"]["levels"][lvl] = {
            "response_at_core": core_mean(flats[lvl][ys, xs], lcx, lcy, CORE_R),
            "computed_core_dn": comp_core,
            "added_core_dn": comp_core - raw_core,
            "mote_contrast_after": check["variants"][f"flat_{lvl}_darkflat"]["mote_contrast"],
        }

    # ---- "The problem you can see": 4:3 crop of the 85 % result, same STF ----
    pys = slice(cy - PROBLEM_H // 2, cy + PROBLEM_H // 2)
    pxs = slice(cx - PROBLEM_W // 2, cx + PROBLEM_W // 2)
    save_gray(show_roi(raw_full[pys, pxs] / flats[85][pys, pxs]), OUT / "roi_problem_85.png")
    stats["roi_problem_85"] = {"crop": {"x": pxs.start, "y": pys.start, "w": PROBLEM_W, "h": PROBLEM_H}, "stf": "try_it.stf"}

    json.dump(stats, open(OUT / "stats.json", "w"), indent=1)
    print(json.dumps(stats, indent=1))


if __name__ == "__main__":
    main()
