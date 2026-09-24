#!/usr/bin/env python3
"""Real image assets for the Alignment lesson.

The page shows the first stack of the course: frames f05 and f02 averaged on the galaxy,
first as they came off the camera (naive, pixel for pixel) and then after f02 has been
aligned onto f05. f02 is the West-side exposure farthest from f05 (about 49 px at the
galaxy), so the doubled stars are visible at tile size; East-side frames are rotated
about 180 degrees relative to f05 and their twins land far away, which does not read as
misalignment. Both frames are fully calibrated first (SPEC §6.2: minus the master dark,
divided by the dark-flat-calibrated 50% flat), because alignment comes after calibration.

Frame f05 is the reference frame for this lesson: f02 is warped onto f05's pixel grid with
the precomputed Stage A homographies (f05 <- f07 reference <- f02, SPEC §6.4). The warp uses
scipy's cubic spline on the crop only; the app pipeline will use Lanczos-3, so the aligned
tiles are a design-time approximation (recorded in docs/design-notes.md §5). Before averaging,
f02 is normalized to f05 with the global scale + offset rule (SPEC §6.5) using the
precomputed statistics for the 'dark|flat_50_darkflat' state.

Outputs (assets/alignment/, 8-bit PNG, native pixels, one AutoSTF computed on the f05 crop
with target bg 0.30 and shadows clip -1.8 MADN, shared by every tile):
  frame05.png              f05 crop, calibrated
  frame02.png              f02 crop at the same sensor pixels, calibrated and normalized
  naive_average.png        (frame05 + frame02) / 2, pixel for pixel
  frame02_aligned.png      f02 warped onto f05's grid, calibrated and normalized
  aligned_average.png      (frame05 + frame02_aligned) / 2
  problem_naive.png        the middle 880x660 of naive_average.png (2x the 440x330 'problem' slot)
  stats.json               crop position, STF, the alignment stars (crop coordinates, for the
                           red circles drawn in Figma), the shift between the frames, and the
                           background spread (standard deviation and MADN, in pixel brightness)
                           of each tile in a star-free patch

Usage:
  uv run tools/assets/alignment_page.py            # writes assets/alignment/
"""
from __future__ import annotations

import csv
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
OUT = REPO / "assets" / "alignment"

REF, OTHER = "f05", "f02"
CAL_STATE = "dark|flat_50_darkflat"
FLAT_ID = "flat_50_darkflat"
DN = 65535.0

# Galaxy crop on f05: 3:2, the widest crop that fits the 1200 px page column at native scale.
CROP_W, CROP_H = 1200, 800
STF = dict(target_bg=0.30, shadows_clip=-1.8)
N_ALIGN_STARS = 3
STAR_MIN_SEP = 120  # px: alignment stars keep this far from each other, the galaxy and the edges
BG_PATCH = 160  # px: side of the star-free square used for the background spread


def save_gray(img: np.ndarray, path: Path) -> None:
    astro.save(np.clip(img, 0, 1)[None].astype(np.float32), path, bits=8)


def madn(x: np.ndarray) -> float:
    return float(1.4826 * np.median(np.abs(x - np.median(x))))


def galaxy_centre(img: np.ndarray) -> tuple[int, int]:
    """Peak of the strongly smoothed frame near the centre: the galaxy is the only extended source."""
    k = 8
    h, w = img.shape
    b = img[: h // k * k, : w // k * k].reshape(h // k, k, w // k, k).mean(axis=(1, 3))
    b = ndimage.median_filter(b, 5)  # drop stars
    s = ndimage.gaussian_filter(b, 8)
    hh, ww = s.shape
    win = s[hh // 4 : 3 * hh // 4, ww // 4 : 3 * ww // 4]
    y, x = np.unravel_index(np.argmax(win), win.shape)
    return int((x + ww // 4) * k + k // 2), int((y + hh // 4) * k + k // 2)


def calibrated(frame: dict, dark: np.ndarray, flat_rel: np.ndarray) -> np.ndarray:
    light, _ = astro.load(REPO / frame["source"])
    L = light[0].astype(np.float64)
    if frame["needs_flipud"]:
        L = L[::-1]
    return (L - dark) / flat_rel


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    frames = {f["id"]: f for f in json.load(open(PRE / "frames.json"))["frames"]}
    masters = json.load(open(PRE / "masters.json"))
    norm = json.load(open(PRE / "normalization.json"))["frames"]

    dark, _ = astro.load(next(CAL.glob("masterDark*.xisf")))
    D = dark[0].astype(np.float64)
    flat, _ = astro.load(PRE / "masters" / f"{FLAT_ID}.fits")
    flat_rel = flat[0].astype(np.float64) / masters[FLAT_ID]["scale_f_v"]["unit_0_1"]

    ref = calibrated(frames[REF], D, flat_rel)
    oth = calibrated(frames[OTHER], D, flat_rel)

    # Global normalization of the other frame onto the reference (SPEC §6.5).
    n_ref, n_oth = norm[REF]["states"][CAL_STATE], norm[OTHER]["states"][CAL_STATE]
    m_r, s_r = n_ref["median_dn"] / DN, n_ref["bwmv_dn"] / DN
    m_o, s_o = n_oth["median_dn"] / DN, n_oth["bwmv_dn"] / DN
    oth = (oth - m_o) * (s_r / s_o) + m_r

    gx, gy = galaxy_centre(ref)
    x0, y0 = gx - CROP_W // 2, gy - CROP_H // 2
    ys, xs = slice(y0, y0 + CROP_H), slice(x0, x0 + CROP_W)

    crop_ref = ref[ys, xs]
    crop_oth = oth[ys, xs]

    # Warp the other frame onto f05's grid: p_ref(f07) = H05^-1 p05 ; p_other = H_other p_ref.
    H05 = np.array(frames[REF]["alignment"]["matrix_ref_to_frame"]).reshape(3, 3)
    HO = np.array(frames[OTHER]["alignment"]["matrix_ref_to_frame"]).reshape(3, 3)
    M = HO @ np.linalg.inv(H05)  # f05 pixel -> other-frame pixel (pixel centres on integers, SPEC §6.4)
    yy, xx = np.mgrid[y0 : y0 + CROP_H, x0 : x0 + CROP_W].astype(np.float64)
    hom = np.stack([xx.ravel(), yy.ravel(), np.ones(xx.size)])
    q = M @ hom
    qx, qy = q[0] / q[2], q[1] / q[2]
    crop_oth_aligned = ndimage.map_coordinates(oth, [qy, qx], order=3, mode="reflect").reshape(CROP_H, CROP_W)
    shift = np.hypot(qx - xx.ravel(), qy - yy.ravel())

    naive = 0.5 * (crop_ref + crop_oth)
    aligned = 0.5 * (crop_ref + crop_oth_aligned)

    stf = astro.auto_stf(crop_ref[None].astype(np.float32), **STF)
    show = lambda img: astro.apply_stf(np.clip(img, 0, 1)[None].astype(np.float32), stf)[0]
    tiles = {
        "frame05": crop_ref,
        "frame02": crop_oth,
        "naive_average": naive,
        "frame02_aligned": crop_oth_aligned,
        "aligned_average": aligned,
    }
    for name, img in tiles.items():
        save_gray(show(img), OUT / f"{name}.png")
    pw, ph = 880, 660
    save_gray(show(naive)[(CROP_H - ph) // 2 : (CROP_H + ph) // 2, (CROP_W - pw) // 2 : (CROP_W + pw) // 2], OUT / "problem_naive.png")

    # Alignment stars: bright, unsaturated, well separated, away from the galaxy and the edges.
    with open(PRE / "stars" / f"{REF}.csv") as fh:
        stars = [r for r in csv.DictReader(fh) if r["ok"] == "True"]
    cand = []
    for r in stars:
        x, y = float(r["x"]) - x0, float(r["y"]) - y0
        if not (STAR_MIN_SEP < x < CROP_W - STAR_MIN_SEP and STAR_MIN_SEP < y < CROP_H - STAR_MIN_SEP):
            continue
        if np.hypot(x - CROP_W / 2, y - CROP_H / 2) < 260:  # inside the galaxy
            continue
        if float(r["amp"]) > 0.85:
            continue
        cand.append((float(r["snr"]), x, y, float(r["fwhm"])))
    cand.sort(reverse=True)
    chosen: list[dict] = []
    for snr, x, y, fwhm in cand:
        if all(np.hypot(x - c["x"], y - c["y"]) > STAR_MIN_SEP * 2 for c in chosen):
            chosen.append({"x": round(x, 1), "y": round(y, 1), "fwhm_px": round(fwhm, 2), "snr": round(snr, 1)})
        if len(chosen) == N_ALIGN_STARS:
            break

    # Background spread in a star-free patch: the darkest-in-smoothed-maximum square in the crop.
    smooth_max = ndimage.maximum_filter(crop_ref, size=BG_PATCH)
    cy, cx = np.unravel_index(np.argmin(smooth_max), smooth_max.shape)
    bx, by = int(np.clip(cx - BG_PATCH // 2, 0, CROP_W - BG_PATCH)), int(np.clip(cy - BG_PATCH // 2, 0, CROP_H - BG_PATCH))
    patch = lambda img: img[by : by + BG_PATCH, bx : bx + BG_PATCH]
    background = {
        name: {"std_dn": float(np.std(patch(img)) * DN), "madn_dn": madn(patch(img)) * DN, "median_dn": float(np.median(patch(img)) * DN)}
        for name, img in tiles.items()
    }

    stats = {
        "reference_frame": REF,
        "other_frame": OTHER,
        "calibration": CAL_STATE,
        "crop": {"x": x0, "y": y0, "w": CROP_W, "h": CROP_H, "galaxy_centre_px": [gx, gy]},
        "problem_crop": {"x": x0 + (CROP_W - 880) // 2, "y": y0 + (CROP_H - 660) // 2, "w": 880, "h": 660},
        "stf": {"c0": stf[0][0], "m": stf[0][1], **STF},
        "normalization_of_other_onto_reference": {"median_dn": [n_oth["median_dn"], n_ref["median_dn"]], "scale": s_r / s_o},
        "warp": {"method": "scipy map_coordinates cubic (design-time stand-in for Lanczos-3)", "f05_to_other_matrix": M.ravel().tolist()},
        "pixel_shift_between_frames_px": {"min": float(shift.min()), "median": float(np.median(shift)), "max": float(shift.max())},
        "alignment_stars_crop_px": chosen,
        "background_patch_crop_px": {"x": bx, "y": by, "size": BG_PATCH},
        "background": background,
        "expected_noise_ratio_two_frames": float(1 / np.sqrt(2)),
        "measured_noise_ratio": {
            "naive_average_over_frame05": background["naive_average"]["std_dn"] / background["frame05"]["std_dn"],
            "aligned_average_over_frame05": background["aligned_average"]["std_dn"] / background["frame05"]["std_dn"],
        },
    }
    json.dump(stats, open(OUT / "stats.json", "w"), indent=1)
    print(json.dumps(stats, indent=1))


if __name__ == "__main__":
    main()
