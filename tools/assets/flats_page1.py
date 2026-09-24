#!/usr/bin/env python3
"""Real image assets for the Flats (page 1) lesson.

Reproduces the app's calibration path for this page (SPEC.md §6.2: dark on, bias inside the
dark, flat variants from Stage B) and writes PNGs for the Figma frames plus the numbers the
page quotes. Everything is derived from frame f03 and the level-50 master flats.

Reading column (full field, binned to the page width):
  flat_full.png            master flat (dark-flat calibrated), linear stretch between percentiles,
                           so the vignetting, the dust donuts and the bottom obstruction show
  frame_before.png         f03 after dark subtraction, one AutoSTF (target bg 0.30)
  frame_after.png          f03 after dark subtraction and division by the flat, same STF

Try it, experiment 1 (light-frame ROI around the left-side dust mote, native pixels):
  roi_raw.png                          (L - D)
  roi_computed_flat-as-shot.png        (L - D) / (flat_50_none / f_v)
  roi_computed_flat-darkflat.png       (L - D) / (flat_50_darkflat / f_v)
  roi_removed_flat-as-shot.png         raw - computed, one linear stretch shared by both variants
  roi_removed_flat-darkflat.png
  roi_removed_none.png                 flat off: nothing removed (uniform neutral grey)
  All light ROIs share one AutoSTF computed on the raw crop, stronger than the default
  (target bg 0.30, shadows clip -1.8 MADN) so the ring reads at tile size.

Try it, experiment 2 (the same ROI of the *flat*, not the light):
  flatroi_raw.png              flat_50_none (flat as shot, no dark flat)
  flatroi_computed.png         flat_50_darkflat (dark flat subtracted), same linear stretch
  flatroi_removed.png          flat_50_none - flat_50_darkflat, i.e. the dark flat's signal
  flatroi_removed_none.png     dark flats off: nothing removed

  stats.json                   per-tile numbers (DN and relative response at the mote core),
                               the whole-field vignetting numbers, and every stretch used

Usage:
  uv run tools/assets/flats_page1.py            # writes assets/flats-1/
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
OUT = REPO / "assets" / "flats-1"

FRAME = "f03"
DN = 65535.0

# Light-frame ROI: 3:2 crop, wide enough to hold the whole double donut with sky around it.
CROP_W, CROP_H = 720, 480
CENTER_SHIFT = (40, 60)  # (dx, dy) from flat_check's darkest dip to the visual centre of the donut pair
CORE_R = 25  # px, same as flat_check.json

FULL_W = 1200  # page column width; the full-field images are binned to this
ROI_STF = dict(target_bg=0.30, shadows_clip=-1.8)
FRAME_STF = dict(target_bg=0.30, shadows_clip=-2.8)


def bin_to_width(img: np.ndarray, width: int) -> np.ndarray:
    """Integer-factor mean binning of a (H,W) image so that W // k is closest to `width`."""
    h, w = img.shape
    k = max(1, round(w / width))
    hh, ww = (h // k) * k, (w // k) * k
    return img[:hh, :ww].reshape(hh // k, k, ww // k, k).mean(axis=(1, 3))


def percentile_stretch(img: np.ndarray, lo_p=0.1, hi_p=99.9, lo=None, hi=None):
    if lo is None:
        lo, hi = np.percentile(img, [lo_p, hi_p])
    return np.clip((img - lo) / max(hi - lo, 1e-12), 0, 1), (float(lo), float(hi))


def save_gray(img: np.ndarray, path: Path) -> None:
    astro.save(np.clip(img, 0, 1)[None].astype(np.float32), path, bits=8)


def core_mean(img: np.ndarray, cx: int, cy: int, r: int) -> float:
    yy, xx = np.ogrid[: img.shape[0], : img.shape[1]]
    return float(img[(xx - cx) ** 2 + (yy - cy) ** 2 <= r * r].mean())


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    frames = {f["id"]: f for f in json.load(open(PRE / "frames.json"))["frames"]}
    masters = json.load(open(PRE / "masters.json"))
    check = json.load(open(PRE / "flat_check.json"))
    mx, my = check["mote_center_px"]["x"], check["mote_center_px"]["y"]

    light, _ = astro.load(REPO / frames[FRAME]["source"])
    dark, _ = astro.load(next(CAL.glob("masterDark*.xisf")))
    L = light[0].astype(np.float64)
    D = dark[0].astype(np.float64)
    raw_full = L - D

    flats = {}
    for vid in ("flat_50_none", "flat_50_darkflat"):
        f, _ = astro.load(PRE / "masters" / f"{vid}.fits")
        flats[vid] = f[0].astype(np.float64) / masters[vid]["scale_f_v"]["unit_0_1"]  # relative response

    stats: dict = {"frame": FRAME, "mote_center_px": check["mote_center_px"]}

    # ---- Reading column: the flat itself, and the whole frame before/after ----
    flat_show, flat_lohi = percentile_stretch(bin_to_width(flats["flat_50_darkflat"], FULL_W))
    save_gray(flat_show, OUT / "flat_full.png")
    stats["flat_full"] = {
        "source": "flat_50_darkflat (relative response, f_v = 1)",
        "stretch": {"linear_lo": flat_lohi[0], "linear_hi": flat_lohi[1]},
        "corner_over_centre": float(check["variants"]["none"]["corner_median"] / check["variants"]["none"]["centre_median"]),
    }

    before = bin_to_width(raw_full, FULL_W)
    after = bin_to_width(raw_full / flats["flat_50_darkflat"], FULL_W)
    stf_frame = astro.auto_stf(before[None].astype(np.float32), **FRAME_STF)
    show_frame = lambda img: astro.apply_stf(np.clip(img, 0, 1)[None].astype(np.float32), stf_frame)[0]
    save_gray(show_frame(before), OUT / "frame_before.png")
    save_gray(show_frame(after), OUT / "frame_after.png")
    stats["frame_before_after"] = {
        "stf": {"c0": stf_frame[0][0], "m": stf_frame[0][1], **FRAME_STF},
        "vignetting_corner_over_centre": {
            "before": check["variants"]["none"]["vignetting_residual"],
            "after": check["variants"]["flat_50_darkflat"]["vignetting_residual"],
        },
    }

    # ---- Try it, experiment 1: light-frame ROI ----
    cx, cy = mx + CENTER_SHIFT[0], my + CENTER_SHIFT[1]
    ys = slice(cy - CROP_H // 2, cy + CROP_H // 2)
    xs = slice(cx - CROP_W // 2, cx + CROP_W // 2)
    raw = raw_full[ys, xs]
    stf_roi = astro.auto_stf(raw[None].astype(np.float32), **ROI_STF)
    show_roi = lambda img: astro.apply_stf(np.clip(img, 0, 1)[None].astype(np.float32), stf_roi)[0]
    save_gray(show_roi(raw), OUT / "roi_raw.png")

    lcx, lcy = mx - xs.start, my - ys.start  # mote core inside the crop
    computed = {vid: raw / flats[vid][ys, xs] for vid in flats}
    removed = {vid: raw - c for vid, c in computed.items()}
    allr = np.concatenate([r.ravel() for r in removed.values()])
    rlo, rhi = np.percentile(allr, [0.5, 99.5])
    raw_core = core_mean(raw, lcx, lcy, CORE_R) * DN
    stats["experiment_1"] = {
        "crop": {"x": xs.start, "y": ys.start, "w": CROP_W, "h": CROP_H},
        "stf": {"c0": stf_roi[0][0], "m": stf_roi[0][1], **ROI_STF},
        "removed_stretch_dn": {"lo": rlo * DN, "hi": rhi * DN},
        "core_radius_px": CORE_R,
        "raw_core_dn": raw_core,
        "variants": {},
    }
    for vid in flats:
        tag = "flat-as-shot" if vid.endswith("none") else "flat-darkflat"
        save_gray(show_roi(computed[vid]), OUT / f"roi_computed_{tag}.png")
        save_gray((removed[vid] - rlo) / (rhi - rlo), OUT / f"roi_removed_{tag}.png")
        resp = core_mean(flats[vid][ys, xs], lcx, lcy, CORE_R)
        comp_core = core_mean(computed[vid], lcx, lcy, CORE_R) * DN
        stats["experiment_1"]["variants"][vid] = {
            "response_at_core": resp,
            "computed_core_dn": comp_core,
            "removed_core_dn": raw_core - comp_core,
            "mote_contrast_after": check["variants"][vid]["mote_contrast"],
        }
    save_gray(np.full_like(raw, 0.5), OUT / "roi_removed_none.png")  # nothing removed: neutral grey

    # ---- Try it, experiment 2: the same ROI of the flat ----
    fn, fd = flats["flat_50_none"][ys, xs], flats["flat_50_darkflat"][ys, xs]
    fshow, flohi = percentile_stretch(np.concatenate([fn, fd]), 0.5, 99.5)
    save_gray(percentile_stretch(fn, lo=flohi[0], hi=flohi[1])[0], OUT / "flatroi_raw.png")
    save_gray(percentile_stretch(fd, lo=flohi[0], hi=flohi[1])[0], OUT / "flatroi_computed.png")
    dflat = fn - fd  # the dark flat's contribution, in relative-response units
    dshow, dlohi = percentile_stretch(dflat, 0.5, 99.5)
    save_gray(dshow, OUT / "flatroi_removed.png")
    save_gray(np.full_like(dflat, 0.5), OUT / "flatroi_removed_none.png")  # nothing removed: neutral grey
    stats["experiment_2"] = {
        "crop": stats["experiment_1"]["crop"],
        "stretch_relative": {"lo": flohi[0], "hi": flohi[1]},
        "removed_stretch_relative": {"lo": dlohi[0], "hi": dlohi[1]},
        "flat_as_shot_core": core_mean(fn, lcx, lcy, CORE_R),
        "flat_darkflat_core": core_mean(fd, lcx, lcy, CORE_R),
        "darkflat_master_median_dn": masters["darkflat_50"]["median_dn"],
        "flat_median_dn": masters["flat_50_none"]["median_dn"],
    }

    json.dump(stats, open(OUT / "stats.json", "w"), indent=1)
    print(json.dumps(stats, indent=1))


if __name__ == "__main__":
    main()
