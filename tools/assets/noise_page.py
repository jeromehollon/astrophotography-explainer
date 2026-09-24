#!/usr/bin/env python3
"""Real image assets for the Noise & Defects lesson (the introduction page).

The page is reading-only: an overview of what a single light frame contains, why we stack,
and where each error comes from. Every crop below is a native-pixel region (720x480, 3:2)
of real data, except where a defect is only visible at a larger scale; those are binned and
say so. Light-frame crops share the Flats-1 stretch (AutoSTF target background 0.30,
shadows clip -1.8 MADN), each computed on its own crop.

Outputs (assets/noise/):
  problem_galaxy.png       f03 raw, 2200x1650 around NGC 7331 binned x5 to 440x330, so the outer halo fits
  problem_master.png       the same region of the WBPP master light (source_images/final), rotated 180 degrees
                           because the master is registered to an East-side reference, same binning and STF settings
  tour_noise.png           f03 raw background patch: random variation
  tour_bias.png            master bias, same patch: the readout offset and its noise
  tour_dark.png            master dark, 360x240 patch chosen for hot-pixel density (shown 1:1): hot pixels
  tour_flat.png            master flat (50%, dark-flat calibrated), whole field binned x8: uneven response
  tour_misaligned.png      f02 + f05 averaged without alignment (about 47 px apart): doubled stars
  tour_satellite.png       f03 raw, the real satellite trail (lower right)
  tour_cloud.png           f14_cloud, a quarter of the field binned x4: patchy cloud
  tour_tracking.png        f11_tracking, trailed stars
  stats.json               the numbers the captions may quote, and every stretch used

Usage:
  uv run tools/assets/noise_page.py            # writes assets/noise/
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
OUT = REPO / "assets" / "noise"
DN = 65535.0
W, H = 720, 480
STF = dict(target_bg=0.30, shadows_clip=-1.8)

# Crop centres in native pixels (x, y) of the raw frame.
GALAXY = (3248, 2100)      # galaxy core in f03 (centroid)
GALAXY_MASTER = (3164, 2052)  # galaxy core in the master after a 180-degree rotation (template match, refined below)
PROBLEM_W, PROBLEM_H, PROBLEM_BIN = 2200, 1650, 5  # native region and binning for the 440x330 problem slot
BACKGROUND = (2400, 3200)  # plain sky, away from the galaxy and the dust mote at (720, 2337)
HOT_PIXELS = (1216, 960)   # densest 128 px block of the master dark (count > 500 DN)
STARS = (3060, 3780)       # bright double star, so the doubling reads at tile size
SATELLITE = (4760, 2850)   # on the f03 trail
TRACKING = (3420, 780)     # bright stars whose trailing is clear at tile size


def load_frame(frames: dict, fid: str) -> np.ndarray:
    img, _ = astro.load(REPO / frames[fid]["source"])
    a = img[0].astype(np.float64)
    return a[::-1] if frames[fid]["needs_flipud"] else a


def crop(a: np.ndarray, cx: int, cy: int, w: int = W, h: int = H) -> np.ndarray:
    return a[cy - h // 2 : cy + h // 2, cx - w // 2 : cx + w // 2]


def binned(a: np.ndarray, k: int) -> np.ndarray:
    h, w = a.shape
    return a[: h // k * k, : w // k * k].reshape(h // k, k, w // k, k).mean(axis=(1, 3))


def save_stf(img: np.ndarray, path: Path, **kw) -> dict:
    x = np.clip(img, 0, 1)[None].astype(np.float32)
    p = astro.auto_stf(x, **kw)
    astro.save(astro.apply_stf(x, p), path, bits=8)
    return {"c0": p[0][0], "m": p[0][1], **kw}


def save_linear(img: np.ndarray, path: Path, lo_p: float, hi_p: float) -> dict:
    lo, hi = np.percentile(img, [lo_p, hi_p])
    astro.save(np.clip((img - lo) / max(hi - lo, 1e-12), 0, 1)[None].astype(np.float32), path, bits=8)
    return {"linear_lo_dn": float(lo * DN), "linear_hi_dn": float(hi * DN)}


def med_madn(a: np.ndarray) -> dict:
    m = float(np.median(a))
    return {"median_dn": m * DN, "madn_dn": float(1.4826 * np.median(np.abs(a - m))) * DN}


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    frames = {f["id"]: f for f in json.load(open(PRE / "frames.json"))["frames"]}
    check = json.load(open(PRE / "flat_check.json"))
    stats: dict = {"crop_size": [W, H], "light_stf": STF}

    f03 = load_frame(frames, "f03")
    stats["f03_whole_frame"] = med_madn(f03)

    # The problem you can see: the galaxy in a single raw frame, and the same region of the finished master.
    def refine_core(a, cx, cy, r=40):
        w = np.clip(a[cy - r : cy + r, cx - r : cx + r] - np.median(a), 0, None)
        yy, xx = np.mgrid[0 : 2 * r, 0 : 2 * r]
        return int(round(cx - r + (w * xx).sum() / w.sum())), int(round(cy - r + (w * yy).sum() / w.sum()))
    gc = refine_core(f03, *GALAXY)
    g = binned(crop(f03, *gc, PROBLEM_W, PROBLEM_H), PROBLEM_BIN)
    stats["problem_galaxy"] = {"frame": "f03", "centre": gc, "size": [PROBLEM_W, PROBLEM_H], "bin": PROBLEM_BIN, "stf": save_stf(g, OUT / "problem_galaxy.png", **STF)}
    master, _ = astro.load(next((REPO / "source_images" / "final").glob("masterLight_*.xisf")))
    Mr = master[0].astype(np.float64)[::-1, ::-1]  # rotate 180 degrees to match the West-side sub
    mc = refine_core(Mr, *GALAXY_MASTER)
    gm = binned(crop(Mr, *mc, PROBLEM_W, PROBLEM_H), PROBLEM_BIN)
    stats["problem_master"] = {"source": "final/masterLight_*_autocrop.xisf rotated 180 degrees", "centre_in_rotated_master": mc, "size": [PROBLEM_W, PROBLEM_H], "bin": PROBLEM_BIN, "stf": save_stf(gm, OUT / "problem_master.png", **STF)}

    # Random variation: a plain background patch of the same frame.
    bg = crop(f03, *BACKGROUND)
    stats["tour_noise"] = {"frame": "f03", "centre": BACKGROUND, **med_madn(bg), "stf": save_stf(bg, OUT / "tour_noise.png", **STF)}

    # Bias: the master bias on the same patch, linear between percentiles so its noise shows.
    bias, _ = astro.load(next(CAL.glob("masterBias*.xisf")))
    B = bias[0].astype(np.float64)
    bb = crop(B, *BACKGROUND)
    stats["tour_bias"] = {"centre": BACKGROUND, **med_madn(B), "stretch": save_linear(bb, OUT / "tour_bias.png", 0.5, 99.5)}

    # Dark: hot pixels on the master dark. Linear stretch from the pedestal up, so hot pixels read as dots.
    dark, _ = astro.load(next(CAL.glob("masterDark*.xisf")))
    D = dark[0].astype(np.float64)
    dd = crop(D, *HOT_PIXELS, 360, 240)  # half-size crop so single hot pixels stay visible at tile size
    stats["tour_dark"] = {
        "centre": HOT_PIXELS,
        "size": [360, 240],
        **med_madn(D),
        "hot_pixels_over_500dn_whole_frame": int((D * DN > 500).sum()),
        "hot_pixels_over_500dn_in_crop": int((dd * DN > 500).sum()),
        "stretch": save_linear(dd, OUT / "tour_dark.png", 0.5, 99.8),
    }

    # Flat: the whole field, binned, so vignetting and dust show together.
    flat, _ = astro.load(PRE / "masters" / "flat_50_darkflat.fits")
    F = flat[0].astype(np.float64)
    fb = binned(F, 8)
    stats["tour_flat"] = {
        "source": "flat_50_darkflat, binned x8 (whole field)",
        "corner_over_centre": float(check["variants"]["none"]["corner_median"] / check["variants"]["none"]["centre_median"]),
        "mote_contrast": check["variants"]["none"]["mote_contrast"],
        "stretch": save_linear(fb, OUT / "tour_flat.png", 0.1, 99.9),
    }

    # Misalignment: two frames from the same night averaged without alignment.
    f02, f05 = load_frame(frames, "f02"), load_frame(frames, "f05")
    m2, m5 = frames["f02"]["alignment"]["matrix_ref_to_frame"], frames["f05"]["alignment"]["matrix_ref_to_frame"]
    offset = (m5[2] - m2[2], m5[5] - m2[5])
    naive = (crop(f02, *STARS) + crop(f05, *STARS)) / 2
    stats["tour_misaligned"] = {"frames": ["f02", "f05"], "centre": STARS, "offset_px": offset, "offset_len_px": float(np.hypot(*offset)), "stf": save_stf(naive, OUT / "tour_misaligned.png", **STF)}

    # Satellite: the real trail in f03.
    sat = crop(f03, *SATELLITE)
    stats["tour_satellite"] = {"frame": "f03", "centre": SATELLITE, "stf": save_stf(sat, OUT / "tour_satellite.png", **STF)}

    # Cloud: a quarter of the field binned x4 (the patches are hundreds of pixels wide).
    c14 = load_frame(frames, "f14_cloud")
    cb = binned(c14[600:600 + H * 4, 400:400 + W * 4], 4)
    stats["tour_cloud"] = {"frame": "f14_cloud", "region": {"x": 400, "y": 600, "w": W * 4, "h": H * 4, "bin": 4}, "stf": save_stf(cb, OUT / "tour_cloud.png", **STF)}

    # Tracking error: trailed stars.
    t11 = load_frame(frames, "f11_tracking")
    tr = crop(t11, *TRACKING)
    stats["tour_tracking"] = {"frame": "f11_tracking", "centre": TRACKING, "stf": save_stf(tr, OUT / "tour_tracking.png", **STF)}

    json.dump(stats, open(OUT / "stats.json", "w"), indent=1)
    print(json.dumps(stats, indent=1))


if __name__ == "__main__":
    main()
