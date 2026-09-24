#!/usr/bin/env python3
"""Run astro.measure_stars (Moffat) on the linear raw data of all 24 frames.

Writes one CSV per frame (data/derived/precompute/stars/<id>.csv) and a summary
JSON (data/derived/precompute/stars.json) with n_stars, median FWHM (px and
arcsec), median eccentricity, background, noise and per-frame runtime.

Runs frames in parallel with a ProcessPoolExecutor (<=6 workers): each
measure_stars call is CPU-bound (star fitting) and single-frame runtime is
dominated by that, not by I/O, so this is a straightforward frame-per-worker
fan-out.

Usage:
  uv run tools/precompute/star_metrics.py
"""
from __future__ import annotations

import csv
import json
import sys
import time
from concurrent.futures import ProcessPoolExecutor, as_completed
from pathlib import Path

import numpy as np

REPO = Path(__file__).resolve().parents[2]
FRAMES_JSON = REPO / "data" / "derived" / "precompute" / "frames.json"
OUT_JSON = REPO / "data" / "derived" / "precompute" / "stars.json"
OUT_DIR = REPO / "data" / "derived" / "precompute" / "stars"

PIXSCALE = 0.277  # arcsec/px
MAX_WORKERS = 6


def _measure_one(frame: dict) -> dict:
    """Runs in a worker process: load, (flip), measure_stars, write CSV, return summary."""
    sys.path.insert(0, str(REPO / "tools"))
    import astro

    t0 = time.monotonic()
    img, _hdr = astro.load(REPO / frame["source"])
    if frame["needs_flipud"]:
        img = np.flip(img, axis=1)  # flipud on the (C,H,W) array's H axis

    stars, bk = astro.measure_stars(img, model="moffat")
    runtime_s = time.monotonic() - t0

    fw = np.array([s["fwhm"] for s in stars]) if stars else np.array([np.nan])
    ecc = np.array([s["ecc"] for s in stars]) if stars else np.array([np.nan])
    fwhm_px_median = float(np.median(fw)) if stars else None
    summary = {
        "id": frame["id"],
        "n_stars": len(stars),
        "fwhm_px_median": fwhm_px_median,
        "fwhm_arcsec_median": (fwhm_px_median * PIXSCALE) if fwhm_px_median is not None else None,
        "ecc_median": float(np.median(ecc)) if stars else None,
        "background": bk.get("background"),
        "noise": bk.get("noise"),
        "fwhm_guess_used_px": bk.get("fwhm_guess_used"),
        "runtime_s": runtime_s,
    }

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    csv_path = OUT_DIR / f"{frame['id']}.csv"
    fieldnames = list(stars[0].keys()) if stars else ["x", "y", "flux", "fwhm", "ecc"]
    with open(csv_path, "w", newline="") as f:
        wr = csv.DictWriter(f, fieldnames=fieldnames)
        wr.writeheader()
        wr.writerows(stars)

    return summary


def main() -> None:
    t0 = time.monotonic()
    frames = json.loads(FRAMES_JSON.read_text())["frames"]

    results = {}
    with ProcessPoolExecutor(max_workers=MAX_WORKERS) as ex:
        futures = {ex.submit(_measure_one, f): f["id"] for f in frames}
        for fut in as_completed(futures):
            fid = futures[fut]
            try:
                summary = fut.result()
            except Exception as e:  # noqa: BLE001
                summary = {"id": fid, "error": str(e)}
            results[fid] = summary
            print(f"  {fid}: {json.dumps(summary)}", file=sys.stderr)

    order = [f["id"] for f in frames]
    ordered = {fid: results[fid] for fid in order}
    out = {"pixel_scale_arcsec_per_px": PIXSCALE, "frames": ordered, "runtime_s": time.monotonic() - t0}
    OUT_JSON.write_text(json.dumps(out, indent=2))
    print(f"wrote {OUT_JSON} in {out['runtime_s']:.1f}s", file=sys.stderr)


if __name__ == "__main__":
    main()
