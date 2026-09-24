#!/usr/bin/env python3
"""Real image assets for the Light Frames lesson (choosing the photographs worth combining).

The page is reading-only. It shows two kinds of exposure a learner should leave out of a
stack, on the real NGC 7331 data plus the deliberately altered copies in
source_images/light_synthetic_disaster/:

  Clouds     the three synthetic patchy-cloud copies of frames 0014-0016, whole field, so the
             broad patches show. Static reading-column images (the ROIs-only rule's exception).
  Tracking   frame 0011 next to its synthetic tracking-error copy, one galaxy crop at native
             pixels, so the star shapes can be compared.
  FWHM       a brightness profile through one real star in both frames, for the drawn
             "Full width at half maximum" illustration (the curve is drawn in Figma from the
             numbers in stats.json, so the picture is reproducible).

Every frame is calibrated the way the app does it by default (SPEC §6.2: minus the master
dark, divided by the dark-flat-calibrated 50 % flat). Synthetic FITS frames are flipped
vertically once at load time (SPEC §3). No alignment is needed: each altered copy sits on the
same pixel grid as its original.

Outputs (assets/light-frames/, 8-bit PNG):
  cloud_f14.png, cloud_f15.png, cloud_f16.png   whole field binned 8x, one shared AutoSTF
                                                computed on the cloud copy of frame 0014 (a
                                                stretch from the clean frame clips the clouds
                                                to white)
  tracking_f11.png, tracking_f11_tracking.png   galaxy crop, native pixels, one shared AutoSTF
                                                computed on the unaltered frame 0011
  star_f11.png, star_f11_tracking.png           the profile star, 48x48 native pixels enlarged
                                                8x without smoothing (design reference only)
  stats.json                                    crop positions, stretches, the star catalogue
                                                numbers the prose quotes (median FWHM and star
                                                count per frame), the profile star, its
                                                brightness profile in both frames, and a direct
                                                Moffat fit of that star in both frames (the
                                                catalogue run does not detect it in the copy)

Usage:
  uv run tools/assets/light_frames_page.py            # writes assets/light-frames/
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
OUT = REPO / "assets" / "light-frames"

FLAT_ID = "flat_50_darkflat"
DN = 65535.0
STF = dict(target_bg=0.30, shadows_clip=-1.8)

CLOUD_FRAMES = ["f14_cloud", "f15_cloud", "f16_cloud"]
CLOUD_BIN = 8
TRACK_REF, TRACK_VAR = "f11", "f11_tracking"
CROP_W, CROP_H = 1128, 752  # 3:2 galaxy crop, shown at 564x376 (2 px per screen px)
STAR_BOX = 48  # native pixels around the profile star
STAR_ZOOM = 8


def save_gray(img: np.ndarray, path: Path) -> None:
    astro.save(np.clip(img, 0, 1)[None].astype(np.float32), path, bits=8)


def bin_mean(img: np.ndarray, k: int) -> np.ndarray:
    h, w = img.shape
    hh, ww = (h // k) * k, (w // k) * k
    return img[:hh, :ww].reshape(hh // k, k, ww // k, k).mean(axis=(1, 3))


def galaxy_centre(img: np.ndarray) -> tuple[int, int]:
    """Peak of the strongly smoothed frame near the centre: the galaxy is the only extended source."""
    k = 8
    b = bin_mean(img, k)
    b = ndimage.median_filter(b, 5)
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


def stf_for(img: np.ndarray):
    return astro.auto_stf(img[None].astype(np.float32), **STF)


def show(img: np.ndarray, stf) -> np.ndarray:
    return astro.apply_stf(np.clip(img, 0, 1)[None].astype(np.float32), stf)[0]


def catalogue(fid: str) -> list[dict]:
    with open(PRE / "stars" / f"{fid}.csv") as fh:
        return [r for r in csv.DictReader(fh) if r["ok"] == "True"]


def profile(img: np.ndarray, x: float, y: float, half: int = 16) -> tuple[list[float], float]:
    """Brightness along the image row through the star's peak, minus the local sky, in pixel brightness."""
    cx, cy = int(round(x)), int(round(y))
    box = img[cy - half : cy + half + 1, cx - half : cx + half + 1]
    py, px = np.unravel_index(np.argmax(ndimage.gaussian_filter(box, 1)), box.shape)
    cy, cx = cy - half + py, cx - half + px
    ring = img[cy - 2 * half : cy + 2 * half + 1, cx - 2 * half : cx + 2 * half + 1]
    sky = float(np.median(ring))
    row = img[cy, cx - half : cx + half + 1] - sky
    return [float(v * DN) for v in row], sky * DN


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    frames = {f["id"]: f for f in json.load(open(PRE / "frames.json"))["frames"]}
    masters = json.load(open(PRE / "masters.json"))
    stars = json.load(open(PRE / "stars.json"))["frames"]

    dark, _ = astro.load(next(CAL.glob("masterDark*.xisf")))
    D = dark[0].astype(np.float64)
    flat, _ = astro.load(PRE / "masters" / f"{FLAT_ID}.fits")
    flat_rel = flat[0].astype(np.float64) / masters[FLAT_ID]["scale_f_v"]["unit_0_1"]

    stats: dict = {"calibration": f"dark|{FLAT_ID}", "stf": STF, "pixel_scale_arcsec_per_px": 0.277}

    # ---- Clouds: whole field, three altered copies, one stretch from the unaltered frame 0014 ----
    ref14 = bin_mean(calibrated(frames["f14"], D, flat_rel), CLOUD_BIN)
    clouds = {fid: bin_mean(calibrated(frames[fid], D, flat_rel), CLOUD_BIN) for fid in CLOUD_FRAMES}
    stf_cloud = stf_for(clouds["f14_cloud"])
    stats["clouds"] = {"bin": CLOUD_BIN, "stf_frame": "f14_cloud", "stf": {"c0": stf_cloud[0][0], "m": stf_cloud[0][1]}, "frames": {}}
    for fid in CLOUD_FRAMES:
        img = clouds[fid]
        save_gray(show(img, stf_cloud), OUT / f"cloud_{fid.split('_')[0]}.png")
        orig = fid.split("_")[0]
        stats["clouds"]["frames"][fid] = {
            "original": orig,
            "size_px": [img.shape[1], img.shape[0]],
            "n_stars": [stars[orig]["n_stars"], stars[fid]["n_stars"]],
            "fwhm_px_median": [stars[orig]["fwhm_px_median"], stars[fid]["fwhm_px_median"]],
            "background_madn_dn_binned": [float(1.4826 * np.median(np.abs(ref14 - np.median(ref14))) * DN),
                                          float(1.4826 * np.median(np.abs(img - np.median(img))) * DN)],
        }

    # ---- Tracking: frame 0011 and its altered copy on the same galaxy crop ----
    ref = calibrated(frames[TRACK_REF], D, flat_rel)
    var = calibrated(frames[TRACK_VAR], D, flat_rel)
    gx, gy = galaxy_centre(ref)
    x0, y0 = gx - CROP_W // 2, gy - CROP_H // 2
    ys, xs = slice(y0, y0 + CROP_H), slice(x0, x0 + CROP_W)
    stf_track = stf_for(ref[ys, xs])
    save_gray(show(ref[ys, xs], stf_track), OUT / f"tracking_{TRACK_REF}.png")
    save_gray(show(var[ys, xs], stf_track), OUT / f"tracking_{TRACK_VAR}.png")
    stats["tracking"] = {
        "crop": {"x": x0, "y": y0, "w": CROP_W, "h": CROP_H, "galaxy_centre_px": [gx, gy]},
        "stf": {"c0": stf_track[0][0], "m": stf_track[0][1]},
        "frames": {fid: {"n_stars": stars[fid]["n_stars"], "fwhm_px_median": stars[fid]["fwhm_px_median"],
                         "fwhm_arcsec_median": stars[fid]["fwhm_arcsec_median"], "ecc_median": stars[fid]["ecc_median"]}
                   for fid in (TRACK_REF, TRACK_VAR)},
    }

    # ---- FWHM: one bright, unsaturated, isolated star inside the crop, measured in both catalogues ----
    cat_ref = catalogue(TRACK_REF)
    cat_var = {(round(float(r["x"]) / 20), round(float(r["y"]) / 20)): r for r in catalogue(TRACK_VAR)}
    cands = []
    for r in cat_ref:
        x, y = float(r["x"]), float(r["y"])
        if not (x0 + 80 < x < x0 + CROP_W - 80 and y0 + 80 < y < y0 + CROP_H - 80):
            continue
        if float(r["amp"]) > 0.6:
            continue
        cx, cy = int(round(x)), int(round(y))
        altered = float(np.abs(ref[cy - 16 : cy + 17, cx - 16 : cx + 17] - var[cy - 16 : cy + 17, cx - 16 : cx + 17]).max() * DN)
        if altered < 20:  # the synthetic copy only trails some of the stars; the profile must be one of them
            continue
        cands.append((float(r["snr"]), r))
    cands.sort(key=lambda t: -t[0])
    chosen = cands[0][1]
    sx, sy = float(chosen["x"]), float(chosen["y"])
    match = next((v for (kx, ky), v in cat_var.items() if abs(kx - round(sx / 20)) <= 1 and abs(ky - round(sy / 20)) <= 1), None)
    prof_ref, sky_ref = profile(ref, sx, sy)
    prof_var, sky_var = profile(var, sx, sy)
    for fid, img in ((TRACK_REF, ref), (TRACK_VAR, var)):
        cx, cy = int(round(sx)), int(round(sy))
        box = img[cy - STAR_BOX // 2 : cy + STAR_BOX // 2, cx - STAR_BOX // 2 : cx + STAR_BOX // 2]
        save_gray(np.kron(show(box, stf_track), np.ones((STAR_ZOOM, STAR_ZOOM))), OUT / f"star_{fid}.png")
    # Direct fit of the same star in both frames (the star finder drops it in the tracking copy,
    # so the catalogue has no number there): Moffat, as the catalogue uses, on a sky-subtracted cutout.
    fits = {}
    for fid, img in ((TRACK_REF, ref), (TRACK_VAR, var)):
        cx, cy = int(round(sx)), int(round(sy))
        cut = img[cy - STAR_BOX // 2 : cy + STAR_BOX // 2, cx - STAR_BOX // 2 : cx + STAR_BOX // 2]
        cut = cut - np.median(cut)
        f = astro._fit_star(cut, "moffat")
        fits[fid] = {k: (float(v) if isinstance(v, (float, np.floating)) else v) for k, v in f.items() if k in ("fwhm", "fwhm_major", "fwhm_minor", "ecc", "amp", "ok")}
        fits[fid]["amp_dn"] = fits[fid].pop("amp") * DN
    stats["fwhm_star"] = {
        "direct_fit": {"model": "moffat, 48 px cutout, sky = cutout median", **fits},
        "sensor_px": [sx, sy],
        "crop_px": [sx - x0, sy - y0],
        "profile_axis": "image row through the peak, 33 pixels, sky subtracted, pixel brightness (0-65535)",
        TRACK_REF: {"fwhm_px": float(chosen["fwhm"]), "fwhm_major_px": float(chosen["fwhm_major"]), "fwhm_minor_px": float(chosen["fwhm_minor"]),
                    "peak_amp_0_1": float(chosen["amp"]), "sky_dn": sky_ref, "profile_dn": prof_ref},
        TRACK_VAR: {"fwhm_px": float(match["fwhm"]) if match else None, "fwhm_major_px": float(match["fwhm_major"]) if match else None,
                    "fwhm_minor_px": float(match["fwhm_minor"]) if match else None, "detected": match is not None,
                    "sky_dn": sky_var, "profile_dn": prof_var},
    }

    # ---- The catalogue numbers every frame card would show ----
    stats["catalogue"] = {fid: {"n_stars": v["n_stars"], "fwhm_px_median": v["fwhm_px_median"], "fwhm_arcsec_median": v["fwhm_arcsec_median"]}
                          for fid, v in stars.items()}

    json.dump(stats, open(OUT / "stats.json", "w"), indent=1)
    print(json.dumps({k: v for k, v in stats.items() if k != "catalogue"}, indent=1)[:3000])


if __name__ == "__main__":
    main()
