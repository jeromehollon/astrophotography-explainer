#!/usr/bin/env python3
"""Real image assets for the Light Frames 2 lesson (Review the exposures) and the Workbench.

Both pages show the same things: every one of the 24 light-frame entries (the 20 raw
exposures plus the 4 synthetic defect copies), the four regions of interest (ROIs) the
workbench tracks, and the stack the learner has selected. This script produces all of them
from the real NGC 7331 data so every image and number on the pages is reproducible.

Processing follows the app's default path (SPEC §6):
  calibrate   minus the master dark (which carries the bias), divided by the dark-flat-
              calibrated 50 % master flat (§6.2)
  register    onto the reference frame f03 with the Stage A homographies; scipy cubic
              spline stands in for Lanczos-3 at design time (§6.4)
  normalize   global scale + zero offset onto f03 (§6.5)
  combine     average or median of the finite samples (§6.6)
The display stretch is one AutoSTF (target background 0.30, shadows clip -1.8 MADN, the
Flats-1 lesson stretch) computed on the reference frame's galaxy ROI and applied to every
light image, so frames can be compared with each other.

Outputs (assets/light-frames-review/, 8-bit PNG):
  frames/<id>_full.png        the whole frame binned 4x (1556x1042), calibrated and normalized
                              but not registered. Every image on these pages is shown the way
                              the final master is oriented (an East-side reference, SPEC §6.4's
                              display rotation): West-side frames, and every ROI and stack
                              (registered onto the West-side frame f03), are rotated 180
                              degrees. Synthetic FITS copies are flipped once at load (§3).
  frames/<id>_thumb.png       the same, binned 8x (778x521), for the FrameCard thumbnail
  frames/<id>_roi_<roi>.png   the four ROIs of that frame, registered onto f03, binned 2x
                              (720x480 from a 1440x960 native region)
  stack_wide_<method>.png     the learner's stack on the large galaxy view: a 2400x1800 native
                              region binned 2x to 1200x900 (the Noise & Defects problem region,
                              a little wider); Default scenario (20 raw frames), average and median
  stack_<roi>_<method>.png    the same stack on the four ROIs (720x480)
  stats.json                  frame metrics (FWHM, background level and spread, defect notes),
                              ROI definitions, the stretch, and the stack definition

Usage:
  uv run tools/assets/light_frames_review_page.py            # writes assets/light-frames-review/
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
from scipy import ndimage

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "tools"))
import astro  # noqa: E402

PRE = REPO / "data" / "derived" / "precompute"
CAL = REPO / "source_images" / "calibration"
OUT = REPO / "assets" / "light-frames-review"

REF = "f03"
CAL_STATE = "dark|flat_50_darkflat"
FLAT_ID = "flat_50_darkflat"
DN = 65535.0
STF = dict(target_bg=0.30, shadows_clip=-1.8)

RAW = [f"f{i:02d}" for i in range(20)]  # the Default scenario: every raw frame, none of the copies
ALL = RAW + ["f11_tracking", "f14_cloud", "f15_cloud", "f16_cloud"]

# ROIs in reference (f03) sensor coordinates: centre, native size, bin. SPEC §7 P9 names them.
ROIS = {
    "trail": dict(title="Satellite trail", centre=(4760, 2850), size=(1440, 960), bin=2),
    "galaxy": dict(title="Central galaxy", centre=(3246, 2100), size=(1440, 960), bin=2),
    "group": dict(title="Galaxy group", centre=(3480, 2860), size=(1440, 960), bin=2),
    "mote": dict(title="Dust mote", centre=(760, 2397), size=(1440, 960), bin=2),
}
BIG = dict(title="Galaxy and its surroundings", centre=(3246, 2100), size=(2400, 1800), bin=2)
FULL_BIN, THUMB_BIN = 4, 8


def save_gray(img: np.ndarray, path: Path, rotate: bool = False) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if rotate:
        img = img[::-1, ::-1]
    astro.save(np.clip(img, 0, 1)[None].astype(np.float32), path, bits=8)


def binned(img: np.ndarray, b: int) -> np.ndarray:
    h, w = img.shape
    return img[: h // b * b, : w // b * b].reshape(h // b, b, w // b, b).mean(axis=(1, 3))


def region(spec: dict) -> tuple[slice, slice]:
    (cx, cy), (w, h) = spec["centre"], spec["size"]
    return slice(cy - h // 2, cy + h // 2), slice(cx - w // 2, cx + w // 2)


def load_calibrated(frame: dict, dark: np.ndarray, flat_rel: np.ndarray) -> np.ndarray:
    light, _ = astro.load(REPO / frame["source"])
    L = light[0].astype(np.float64)
    if frame["needs_flipud"]:
        L = L[::-1]
    return (L - dark) / flat_rel


def warp_region(filtered: np.ndarray, M: np.ndarray, ys: slice, xs: slice) -> np.ndarray:
    """Resample a spline-prefiltered frame onto the reference region (reference px -> frame px)."""
    yy, xx = np.mgrid[ys, xs].astype(np.float64)
    q = M @ np.stack([xx.ravel(), yy.ravel(), np.ones(xx.size)])
    out = ndimage.map_coordinates(filtered, [q[1] / q[2], q[0] / q[2]], order=3, prefilter=False, mode="reflect")
    return out.reshape(yy.shape)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    frames = {f["id"]: f for f in json.load(open(PRE / "frames.json"))["frames"]}
    masters = json.load(open(PRE / "masters.json"))
    norm = json.load(open(PRE / "normalization.json"))["frames"]
    stars = json.load(open(PRE / "stars.json"))["frames"]
    hists = json.load(open(PRE / "histograms.json"))["items"]

    dark, _ = astro.load(next(CAL.glob("masterDark*.xisf")))
    D = dark[0].astype(np.float64)
    flat, _ = astro.load(PRE / "masters" / f"{FLAT_ID}.fits")
    flat_rel = flat[0].astype(np.float64) / masters[FLAT_ID]["scale_f_v"]["unit_0_1"]

    H = {fid: np.array(frames[fid]["alignment"]["matrix_ref_to_frame"]).reshape(3, 3) for fid in ALL}
    H_ref_inv = np.linalg.inv(H[REF])
    n_ref = norm[REF]["states"][CAL_STATE]
    m_r, s_r = n_ref["median_dn"] / DN, n_ref["bwmv_dn"] / DN

    regions = {k: region(v) for k, v in ROIS.items()}
    regions["big"] = region(BIG)

    crops: dict[str, dict[str, np.ndarray]] = {k: {} for k in regions}
    fulls: dict[str, np.ndarray] = {}
    for fid in ALL:
        img = load_calibrated(frames[fid], D, flat_rel)
        n_f = norm[fid]["states"][CAL_STATE]
        normalize = lambda x: (x - n_f["median_dn"] / DN) * (s_r / (n_f["bwmv_dn"] / DN)) + m_r
        shown = normalize(img)
        if frames[fid]["pier_side"] == "West":
            shown = shown[::-1, ::-1]  # show every frame the way the master is oriented
        fulls[fid] = binned(shown, FULL_BIN)
        if fid == REF:
            for k, (ys, xs) in regions.items():
                crops[k][fid] = normalize(binned(img[ys, xs], 2))
        else:
            filtered = ndimage.spline_filter(img, order=3)
            M = H[fid] @ H_ref_inv
            for k, (ys, xs) in regions.items():
                crops[k][fid] = normalize(binned(warp_region(filtered, M, ys, xs), 2))
            del filtered
        del img
        print(f"loaded {fid}", file=sys.stderr)

    stf = astro.auto_stf(crops["big"][REF][None].astype(np.float32), **STF)
    show = lambda img: astro.apply_stf(np.clip(img, 0, 1)[None].astype(np.float32), stf)[0]

    stats: dict = {
        "reference_frame": REF,
        "calibration": CAL_STATE,
        "stf": {"c0": stf[0][0], "m": stf[0][1], **STF, "computed_on": "reference frame, large galaxy ROI, bin 2"},
        "warp": "scipy map_coordinates cubic (design-time stand-in for Lanczos-3)",
        "orientation": "as the final master (East-side reference): West-side whole frames, and every ROI crop and stack, are rotated 180 degrees",
        "full_frame": {"bin": FULL_BIN, "thumb_bin": THUMB_BIN, "west_side_rotated_180": True, "registered": False},
        "rois": {k: {**v, "bin2_size": [v["size"][0] // 2, v["size"][1] // 2]} for k, v in ROIS.items()},
        "big_roi": {**BIG, "bin2_size": [BIG["size"][0] // 2, BIG["size"][1] // 2]},
        "stack": {"scenario": "Default", "frames": RAW, "methods": ["average", "median"]},
        "frames": {},
    }

    for fid in ALL:
        f = frames[fid]
        save_gray(show(fulls[fid]), OUT / "frames" / f"{fid}_full.png")
        save_gray(show(binned(fulls[fid], THUMB_BIN // FULL_BIN)), OUT / "frames" / f"{fid}_thumb.png")
        for k in ROIS:
            save_gray(show(crops[k][fid]), OUT / "frames" / f"{fid}_roi_{k}.png", rotate=True)
        st, hs = stars[fid], hists[fid]
        stats["frames"][fid] = {
            "frame_index": f["frame_index"],
            "label": f"{f['frame_index']:04d}" + ("" if f["kind"] == "raw" else f" ({f['defect']} copy)"),
            "kind": f["kind"],
            "variant_of": f["relative_of"],
            "defect": f["defect"],
            "pier_side": f["pier_side"],
            "fwhm_px": st["fwhm_px_median"],
            "fwhm_arcsec": st["fwhm_arcsec_median"],
            "n_stars": st["n_stars"],
            "background_median_dn": hs["median"],
            "background_spread_madn_dn": hs["madn"],
            "in_default_stack": fid in RAW,
        }

    for k in list(ROIS) + ["big"]:
        cube = np.stack([crops[k][fid] for fid in RAW])
        name = "wide" if k == "big" else k
        prefix = f"stack_{name}"
        for method, fn in (("average", np.mean), ("median", np.median)):
            result = fn(cube, axis=0)
            save_gray(show(result), OUT / f"{prefix}_{method}.png", rotate=True)
        madn = lambda x: float(1.4826 * np.median(np.abs(x - np.median(x))) * DN)
        stats.setdefault("stack_noise_madn_dn", {})[name] = {
            "single_frame_f03": madn(crops[k][REF]),
            "average": madn(np.mean(cube, axis=0)),
            "median": madn(np.median(cube, axis=0)),
        }

    json.dump(stats, open(OUT / "stats.json", "w"), indent=1)
    print(json.dumps({k: v for k, v in stats.items() if k != "frames"}, indent=1))


if __name__ == "__main__":
    main()
