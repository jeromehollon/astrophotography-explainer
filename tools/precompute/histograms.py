#!/usr/bin/env python3
"""Per-frame ADU statistics and histograms for the 24 lights plus calibration/final frames.

Everything is reported in 16-bit ADU (0-65535), matching the sensor's native
range: astro.load() normalizes every input to float32 [0,1] by its dtype (or
keeps already-float calibration/master frames as-is), so we multiply by 65535
to get back to ADU-like units for comparison across raw lights, master bias/
dark (Float32 in [0,1]) and the autocropped master light.

Two histograms per frame:
  "full": 512 bins over [0, 65536)
  "zoom": 256 bins over [max(0, median - 10*madn), median + 30*madn]

Usage:
  uv run tools/precompute/histograms.py
"""
from __future__ import annotations

import json
import sys
import time
from concurrent.futures import ProcessPoolExecutor, as_completed
from pathlib import Path

import numpy as np

REPO = Path(__file__).resolve().parents[2]
FRAMES_JSON = REPO / "data" / "derived" / "precompute" / "frames.json"
OUT_JSON = REPO / "data" / "derived" / "precompute" / "histograms.json"

MAX_WORKERS = 8
ADU_MAX = 65535.0
SATURATION_ADU = 65000.0

CALIBRATION_ITEMS = [
    {"id": "masterBias", "source": "source_images/calibration/masterBias_BIN-1_6224x4168.xisf"},
    {"id": "masterDark_300s", "source": "source_images/calibration/masterDark_BIN-1_6224x4168_EXPOSURE-300.00s.xisf"},
    {"id": "darkFromOlderCamera", "source": "source_images/calibration/darkFromOlderCamera.fits"},
    {"id": "masterLight_final", "source": "source_images/final/masterLight_BIN-1_6224x4168_EXPOSURE-300.00s_FILTER-Red_mono_TARGET-NGC 7331_(1)_autocrop.xisf"},
]


def _hist(adu: np.ndarray, lo: float, hi: float, n: int) -> dict:
    counts, edges = np.histogram(adu, bins=n, range=(lo, hi))
    return {"lo": float(edges[0]), "hi": float(edges[-1]), "n": n, "counts": counts.astype(int).tolist()}


def _stats_one(item_id: str, source: str) -> dict:
    sys.path.insert(0, str(REPO / "tools"))
    import astro

    t0 = time.monotonic()
    img, _hdr = astro.load(REPO / source)
    adu = (img[0].astype(np.float64)) * ADU_MAX

    med = float(np.median(adu))
    madn = float(1.4826 * np.median(np.abs(adu - med)))
    p0_1, p99_9 = np.percentile(adu, [0.1, 99.9])

    zoom_lo = max(0.0, med - 10 * madn)
    zoom_hi = med + 30 * madn

    result = {
        "id": item_id,
        "source": source,
        "min": float(adu.min()),
        "max": float(adu.max()),
        "mean": float(adu.mean()),
        "median": med,
        "madn": madn,
        "p0_1": float(p0_1),
        "p99_9": float(p99_9),
        "saturated_fraction": float(np.mean(adu >= SATURATION_ADU)),
        "histogram_full": _hist(adu, 0.0, 65536.0, 512),
        "histogram_zoom": _hist(adu, zoom_lo, zoom_hi, 256),
        "runtime_s": time.monotonic() - t0,
    }
    return result


def main() -> None:
    t0 = time.monotonic()
    frames = json.loads(FRAMES_JSON.read_text())["frames"]
    items = [{"id": f["id"], "source": f["source"]} for f in frames] + CALIBRATION_ITEMS

    results = {}
    with ProcessPoolExecutor(max_workers=MAX_WORKERS) as ex:
        futures = {ex.submit(_stats_one, it["id"], it["source"]): it["id"] for it in items}
        for fut in as_completed(futures):
            iid = futures[fut]
            try:
                res = fut.result()
            except Exception as e:  # noqa: BLE001
                res = {"id": iid, "error": str(e)}
            results[iid] = res
            if "error" in res:
                print(f"  {iid}: ERROR {res['error']}", file=sys.stderr)
            else:
                print(f"  {iid}: median={res['median']:.1f} madn={res['madn']:.2f} "
                      f"sat_frac={res['saturated_fraction']:.5f}", file=sys.stderr)

    order = [it["id"] for it in items]
    ordered = {iid: results[iid] for iid in order}
    out = {"adu_max": ADU_MAX, "saturation_threshold_adu": SATURATION_ADU, "items": ordered,
           "runtime_s": time.monotonic() - t0}
    OUT_JSON.write_text(json.dumps(out, indent=2))
    print(f"wrote {OUT_JSON} in {out['runtime_s']:.1f}s", file=sys.stderr)


if __name__ == "__main__":
    main()
