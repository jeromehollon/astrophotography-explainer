#!/usr/bin/env python3
"""Verify the registration-matrix convention and the synthetic-frame flip.

(a) For each raw frame, centroid ~10 bright, unsaturated, isolated stars in its
    registered (_r.xisf) image, map them through the frame's AlignmentMatrix
    (reference -> raw), and compare against an independent centroid of the same
    star in the raw frame. Tests two pixel-origin conventions:
      - "direct":     (x, y)       -> M (x, y, 1)
      - "half_pixel": (x+0.5,y+0.5) -> M (.,.,1), then result - 0.5
(b) For each synthetic defect frame, confirm that flipping it vertically
    (np.flipud) makes its bright stars line up with its raw relative in the
    same (untransformed) pixel frame, and that the un-flipped version does not.

Usage:
  uv run tools/precompute/verify_geometry.py
"""
from __future__ import annotations

import json
import sys
import time
from pathlib import Path

import numpy as np

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "tools"))
import astro  # noqa: E402

FRAMES_JSON = REPO / "data" / "derived" / "precompute" / "frames.json"
OUT = REPO / "data" / "derived" / "precompute" / "geometry_check.json"

N_STARS = 10
BORDER_MARGIN = 250       # px kept clear of any image edge, pre- and post-transform
CENTROID_HALF = 10        # half-width of the centroiding box, px
SATURATION_MAX = 0.9      # normalized [0,1]; stars brighter than this are excluded
MIN_SEPARATION_PX = 60    # candidates closer than this to an already-picked star are skipped


def find_bright_star_candidates(lum: np.ndarray, n: int, margin: int) -> list[tuple[float, float, float]]:
    """Return up to n bright, unsaturated, isolated (x, y, flux) candidates, brightest first."""
    from astropy.stats import sigma_clipped_stats
    from photutils.detection import DAOStarFinder

    sub = lum[::4, ::4]
    mean, med, std = sigma_clipped_stats(sub, sigma=3.0, maxiters=5)
    finder = DAOStarFinder(threshold=15 * std, fwhm=10.0, peak_max=SATURATION_MAX - med,
                           exclude_border=True, min_separation=40)
    table = finder(lum - med)
    if table is None or len(table) == 0:
        return []
    table.sort("flux")
    table.reverse()
    h, w = lum.shape
    picked: list[tuple[float, float, float]] = []
    for row in table:
        x, y, flux = float(row["x_centroid"]), float(row["y_centroid"]), float(row["flux"])
        if not (margin <= x <= w - margin and margin <= y <= h - margin):
            continue
        if any((x - px) ** 2 + (y - py) ** 2 < MIN_SEPARATION_PX ** 2 for px, py, _ in picked):
            continue
        picked.append((x, y, flux))
        if len(picked) >= n:
            break
    return picked


def centroid_refine(lum: np.ndarray, x0: float, y0: float, half: int = CENTROID_HALF, iters: int = 4):
    """Iteratively re-centered intensity-weighted centroid. Returns (x, y, peak) or None if out of bounds/empty."""
    h, w = lum.shape
    x, y = x0, y0
    peak = None
    for _ in range(iters):
        xi, yi = int(round(x)), int(round(y))
        x0b, x1b, y0b, y1b = xi - half, xi + half + 1, yi - half, yi + half + 1
        if x0b < 0 or y0b < 0 or x1b > w or y1b > h:
            return None
        cut = lum[y0b:y1b, x0b:x1b].astype(np.float64)
        local_bg = float(np.median(cut))
        wgt = np.clip(cut - local_bg, 0.0, None)
        total = wgt.sum()
        if total <= 0:
            return None
        yy, xx = np.mgrid[0:cut.shape[0], 0:cut.shape[1]]
        cx = float((xx * wgt).sum() / total) + x0b
        cy = float((yy * wgt).sum() / total) + y0b
        peak = float(cut.max())
        x, y = cx, cy
    return x, y, peak


def apply_matrix(matrix: list[float], x: float, y: float, half_pixel: bool) -> tuple[float, float]:
    m = matrix
    if half_pixel:
        x, y = x + 0.5, y + 0.5
    xp = m[0] * x + m[1] * y + m[2]
    yp = m[3] * x + m[4] * y + m[5]
    w = m[6] * x + m[7] * y + m[8]
    xp, yp = xp / w, yp / w
    if half_pixel:
        xp, yp = xp - 0.5, yp - 0.5
    return xp, yp


def load_lum(path: Path, flipud: bool = False) -> np.ndarray:
    img, _ = astro.load(path)
    lum = img[0].astype(np.float64)
    return np.flipud(lum) if flipud else lum


def check_matrix_direction(frames: list[dict]) -> dict:
    raw_frames = [f for f in frames if f["kind"] == "raw"]
    per_frame = {}
    for f in raw_frames:
        idx = f["frame_index"]
        raw_path = REPO / f["source"]
        reg_matches = sorted((REPO / "source_images" / "light_registered").glob(f"*FRAME_{idx:04d}_*_r.xisf"))
        if len(reg_matches) != 1:
            per_frame[f["id"]] = {"error": f"expected one registered file, found {len(reg_matches)}"}
            continue
        reg_path = reg_matches[0]
        matrix = f["alignment"]["matrix_ref_to_frame"]

        reg_lum = load_lum(reg_path)
        raw_lum = load_lum(raw_path)
        candidates = find_bright_star_candidates(reg_lum, N_STARS, BORDER_MARGIN)

        residuals = {"direct": [], "half_pixel": []}
        for rx0, ry0, _flux in candidates:
            ref = centroid_refine(reg_lum, rx0, ry0)
            if ref is None:
                continue
            rx, ry, rpeak = ref
            if rpeak > SATURATION_MAX:
                continue
            for convention in ("direct", "half_pixel"):
                px, py = apply_matrix(matrix, rx, ry, half_pixel=(convention == "half_pixel"))
                h, w = raw_lum.shape
                if not (BORDER_MARGIN <= px <= w - BORDER_MARGIN and BORDER_MARGIN <= py <= h - BORDER_MARGIN):
                    continue
                found = centroid_refine(raw_lum, px, py)
                if found is None:
                    continue
                fx, fy, fpeak = found
                if fpeak > SATURATION_MAX:
                    continue
                residuals[convention].append(float(np.hypot(fx - px, fy - py)))

        per_frame[f["id"]] = {
            "n_candidates": len(candidates),
            "n_used": {c: len(residuals[c]) for c in residuals},
            "median_residual_px": {c: (float(np.median(residuals[c])) if residuals[c] else None) for c in residuals},
        }
        print(f"  geometry {f['id']}: n_cand={len(candidates)} "
              f"direct={per_frame[f['id']]['median_residual_px']['direct']} "
              f"half_pixel={per_frame[f['id']]['median_residual_px']['half_pixel']}", file=sys.stderr)

    all_direct = [pf["median_residual_px"]["direct"] for pf in per_frame.values() if pf.get("median_residual_px", {}).get("direct") is not None]
    all_half = [pf["median_residual_px"]["half_pixel"] for pf in per_frame.values() if pf.get("median_residual_px", {}).get("half_pixel") is not None]
    overall_direct = float(np.median(all_direct)) if all_direct else None
    overall_half = float(np.median(all_half)) if all_half else None
    winner = None
    if overall_direct is not None and overall_half is not None:
        winner = "direct" if overall_direct <= overall_half else "half_pixel"
    return {
        "per_frame": per_frame,
        "overall_median_residual_px": {"direct": overall_direct, "half_pixel": overall_half},
        "winner": winner,
    }


def check_synthetic_flip(frames: list[dict]) -> dict:
    by_id = {f["id"]: f for f in frames}
    synth_frames = [f for f in frames if f["kind"] == "synthetic"]
    out = {}
    for f in synth_frames:
        raw = by_id[f["relative_of"]]
        raw_lum = load_lum(REPO / raw["source"])
        synth_unflipped = load_lum(REPO / f["source"], flipud=False)
        synth_flipped = load_lum(REPO / f["source"], flipud=True)

        candidates = find_bright_star_candidates(raw_lum, N_STARS, BORDER_MARGIN)
        flipped_res, unflipped_res = [], []
        for rx0, ry0, _flux in candidates:
            ref = centroid_refine(raw_lum, rx0, ry0)
            if ref is None:
                continue
            rx, ry, rpeak = ref
            if rpeak > SATURATION_MAX:
                continue
            found_f = centroid_refine(synth_flipped, rx, ry)
            if found_f is not None:
                fx, fy, _ = found_f
                flipped_res.append(float(np.hypot(fx - rx, fy - ry)))
            found_u = centroid_refine(synth_unflipped, rx, ry)
            if found_u is not None:
                ux, uy, _ = found_u
                unflipped_res.append(float(np.hypot(ux - rx, uy - ry)))

        out[f["id"]] = {
            "n_candidates": len(candidates),
            "n_used_flipped": len(flipped_res),
            "n_used_unflipped": len(unflipped_res),
            "median_residual_px_flipped": float(np.median(flipped_res)) if flipped_res else None,
            "median_residual_px_unflipped": float(np.median(unflipped_res)) if unflipped_res else None,
        }
        print(f"  flip {f['id']}: flipped={out[f['id']]['median_residual_px_flipped']} "
              f"unflipped={out[f['id']]['median_residual_px_unflipped']}", file=sys.stderr)
    return out


def main() -> None:
    t0 = time.monotonic()
    frames = json.loads(FRAMES_JSON.read_text())["frames"]

    print("checking matrix direction / pixel-origin convention...", file=sys.stderr)
    matrix_result = check_matrix_direction(frames)

    print("checking synthetic-frame vertical flip...", file=sys.stderr)
    flip_result = check_synthetic_flip(frames)

    result = {
        "matrix_convention": matrix_result,
        "synthetic_flip": flip_result,
        "runtime_s": time.monotonic() - t0,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(result, indent=2))
    print(f"wrote {OUT} in {result['runtime_s']:.1f}s", file=sys.stderr)


if __name__ == "__main__":
    main()
