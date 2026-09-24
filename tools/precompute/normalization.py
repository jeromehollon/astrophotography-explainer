#!/usr/bin/env python3
"""Per-frame x per-calibration-state normalization stats (docs/knowledge/wbpp.md §6.1, §6.4.3).

For each of the 24 frames and each of the 30 calibration states
(light_dark in {none, bias, dark} x flat in {none, 9 flat masters}),
calibrates the frame in sensor space and records the median, BWMV scale
and MADN of the result (DN units), over the sensor area minus a 64 px
border. These are the reference-relative location/scale pairs the client
pipeline's normalization step and AutoSTF need (§4.4, §4.5 of SPEC.md).

Calibration formula (wbpp.md §6.1), float32, no truncation, no pedestal:
  D = master dark   if light_dark == "dark"
      master bias   if light_dark == "bias"
      0             otherwise
  C = (L - D) / (MF_v / f_v)   if a flat is selected (MF_v = chosen master
                                 flat, f_v = its 5%-trimmed-mean scale)
      (L - D)                  otherwise
"bias + dark" is not a state: wbpp.md's calibration-matcher rules make it
identical to "dark" (the bias drops out whenever a dark is present), so we
don't compute a redundant 4th light_dark value.

Parallelized per frame (<=10 workers); each worker loads its own frame plus
all 11 masters (bias, dark, 9 flats) once and reuses them across the 30
states for that frame.

Usage:
  uv run tools/precompute/normalization.py
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
MASTERS_JSON = REPO / "data" / "derived" / "precompute" / "masters.json"
MASTERS_DIR = REPO / "data" / "derived" / "precompute" / "masters"
CAL_DIR = REPO / "source_images" / "calibration"
OUT_JSON = REPO / "data" / "derived" / "precompute" / "normalization.json"

MAX_WORKERS = 10
BORDER_PX = 64
ADU_MAX = 65535.0
LIGHT_DARK_STATES = ("none", "bias", "dark")
FLAT_IDS = [f"flat_{level}_{cal}" for level in (10, 50, 85) for cal in ("darkflat", "bias", "none")]


def _load_masters():
    """Runs once per worker process: bias, dark and the 9 flat masters + their f_v scales."""
    sys.path.insert(0, str(REPO / "tools"))
    import astro

    masters_meta = json.loads(MASTERS_JSON.read_text())
    bias, _ = astro.load(CAL_DIR / "masterBias_BIN-1_6224x4168.xisf")
    dark, _ = astro.load(CAL_DIR / "masterDark_BIN-1_6224x4168_EXPOSURE-300.00s.xisf")
    flats, f_v = {}, {}
    for fid in FLAT_IDS:
        img, _ = astro.load(MASTERS_DIR / f"{fid}.fits")
        flats[fid] = img[0].astype(np.float64)
        f_v[fid] = masters_meta[fid]["scale_f_v"]["unit_0_1"]
    return astro, bias[0].astype(np.float64), dark[0].astype(np.float64), flats, f_v


def _stats_dn(crop: np.ndarray) -> dict:
    sys.path.insert(0, str(REPO / "tools" / "precompute"))
    import integrate

    m = float(np.median(crop))
    mad = float(np.median(np.abs(crop - m)))
    s = integrate.bwmv_scale(crop)  # recomputes its own median/MAD internally; cheap relative to I/O
    return {"median_dn": m * ADU_MAX, "bwmv_dn": s * ADU_MAX, "madn_dn": 1.4826 * mad * ADU_MAX}


def _process_frame(frame: dict) -> dict:
    t0 = time.monotonic()
    astro, bias, dark, flats, f_v = _load_masters()
    img, _hdr = astro.load(REPO / frame["source"])
    if frame["needs_flipud"]:
        img = np.flip(img, axis=1)
    light = img[0].astype(np.float64)
    h, w = light.shape

    states = {}
    for light_dark in LIGHT_DARK_STATES:
        d = dark if light_dark == "dark" else bias if light_dark == "bias" else 0.0
        c_base = light - d
        for flat_id in [None] + FLAT_IDS:
            if flat_id is None:
                c = c_base
            else:
                c = c_base / (flats[flat_id] / f_v[flat_id])
            crop = c[BORDER_PX: h - BORDER_PX, BORDER_PX: w - BORDER_PX].astype(np.float32)
            key = f"{light_dark}|{flat_id or 'none'}"
            states[key] = _stats_dn(crop)

    return {"id": frame["id"], "states": states, "runtime_s": time.monotonic() - t0}


def main() -> None:
    t0 = time.monotonic()
    frames = json.loads(FRAMES_JSON.read_text())["frames"]

    results = {}
    with ProcessPoolExecutor(max_workers=MAX_WORKERS) as ex:
        futures = {ex.submit(_process_frame, f): f["id"] for f in frames}
        for fut in as_completed(futures):
            fid = futures[fut]
            try:
                res = fut.result()
            except Exception as e:  # noqa: BLE001
                res = {"id": fid, "error": str(e)}
            results[fid] = res
            if "error" in res:
                print(f"  {fid}: ERROR {res['error']}", file=sys.stderr)
            else:
                sample = res["states"]["dark|flat_50_darkflat"]
                print(f"  {fid}: dark|flat_50_darkflat m={sample['median_dn']:.1f} s={sample['bwmv_dn']:.2f} "
                      f"({res['runtime_s']:.1f}s)", file=sys.stderr)

    order = [f["id"] for f in frames]
    ordered = {fid: results[fid] for fid in order}
    out = {"border_px": BORDER_PX, "light_dark_states": list(LIGHT_DARK_STATES), "flat_ids": FLAT_IDS,
           "frames": ordered, "runtime_s": time.monotonic() - t0}
    OUT_JSON.write_text(json.dumps(out, indent=2))
    print(f"wrote {OUT_JSON} in {out['runtime_s']:.1f}s", file=sys.stderr)


if __name__ == "__main__":
    main()
