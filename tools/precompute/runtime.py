#!/usr/bin/env python3
"""Stage C: build the runtime data directory the server streams (SPEC §4.2, docs/contracts.md).

Writes, under data/derived/runtime/:

  manifest.json               one entry per asset (24 lights + 14 masters)
  pixels/<id>.b1.u16          lights: raw u16 DN, little-endian, row-major, no header
  pixels/<id>.b1.f32          masters: float32 DN (ADU), same layout
  pixels/<id>.b{2,4,8}.f32    float32 means of bxb blocks; the trailing partial block is dropped
  frames.json, stars.json, histograms.json, normalization.json, masters.json, flat_check.json
                              copied verbatim from data/derived/precompute/

Lights come from source_images/light/*.xisf (UInt16, stored as-is) and the four
synthetic defect frames from source_images/light_synthetic_disaster/*.fits, which
are flipped with np.flipud so they share the raw orientation (frames.json
`needs_flipud`, verified in geometry_check.json). Masters are the WBPP master
bias/dark (XISF Float32 in [0,1]) and the Stage-B dark flats and flats (FITS
float32 in [0,1]); both are multiplied by 65535 to give DN.

Lights are processed first because the client pipeline needs them before it
needs masters. Every file is written to `<name>.tmp` and renamed into place,
so a file that exists under its final name is always complete.

Usage (from the repo root, ~25 min on /mnt/c):
  uv run tools/precompute/runtime.py [--workers 6] [--only f03,bias]
Set ASTRO_REPO=<path> to read source_images/ and data/ from another checkout.
"""
from __future__ import annotations

import argparse
import csv
import json
import os
import shutil
import sys
import time
from concurrent.futures import ProcessPoolExecutor, as_completed
from pathlib import Path

import numpy as np

REPO = Path(os.environ.get("ASTRO_REPO") or Path(__file__).resolve().parents[2])
PRE = REPO / "data" / "derived" / "precompute"
OUT = REPO / "data" / "derived" / "runtime"
CAL_DIR = REPO / "source_images" / "calibration"

BINS = (2, 4, 8)
ADU_MAX = 65535.0
MASTER_IDS = ["bias", "dark", "darkflat_10", "darkflat_50", "darkflat_85"] + [
    f"flat_{level}_{cal}" for level in (10, 50, 85) for cal in ("darkflat", "bias", "none")
]
COPIED_JSON = ["frames.json", "stars.json", "histograms.json", "normalization.json", "masters.json", "flat_check.json"]


def block_mean(a: np.ndarray, b: int) -> np.ndarray:
    """Mean of each bxb block of a 2-D array as float32; the trailing partial block is dropped.

    Output shape is (H//b, W//b). Sums are taken in float64 so u16 inputs don't lose precision.
    """
    if b == 1:
        return np.asarray(a, dtype=np.float32)
    h, w = a.shape[0] // b, a.shape[1] // b
    blocks = np.asarray(a[: h * b, : w * b], dtype=np.float64).reshape(h, b, w, b)
    return blocks.mean(axis=(1, 3)).astype(np.float32)


def write_atomic(arr: np.ndarray, path: Path) -> None:
    """Write `arr` as raw little-endian bytes to `path` via a .tmp sibling and an atomic rename."""
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(path.name + ".tmp")
    arr = np.ascontiguousarray(arr)
    if arr.dtype.byteorder == ">":
        arr = arr.byteswap().view(arr.dtype.newbyteorder("<"))
    with open(tmp, "wb", buffering=8 << 20) as f:
        f.write(memoryview(arr).cast("B"))
    os.replace(tmp, path)


def write_pyramid(img2d: np.ndarray, asset_id: str, b1_dtype: str) -> dict[str, str]:
    """Write b1 (u16 or f32) plus the b2/b4/b8 f32 pyramid; return the manifest `files` map."""
    files: dict[str, str] = {}
    b1 = OUT / "pixels" / f"{asset_id}.b1.{b1_dtype}"
    if not b1.exists():
        write_atomic(img2d.astype(np.uint16 if b1_dtype == "u16" else np.float32, copy=False), b1)
    files["1"] = f"pixels/{asset_id}.b1.{b1_dtype}"
    prev, prev_b = img2d, 1
    for b in BINS:
        p = OUT / "pixels" / f"{asset_id}.b{b}.f32"
        # bin from the previous level (b/prev_b is 2 each step); identical to a direct bxb mean
        binned = block_mean(prev, b // prev_b)
        if not p.exists():
            write_atomic(binned, p)
        files[str(b)] = f"pixels/{asset_id}.b{b}.f32"
        prev, prev_b = binned, b
    return files


def load_light(frame: dict) -> np.ndarray:
    """Raw u16 sensor-space rows of one light (synthetic FITS flipped to raw orientation)."""
    src = REPO / frame["source"]
    if src.suffix.lower() == ".xisf":
        from xisf import XISF

        data = XISF.read(str(src))  # (H, W, C)
        img = data[..., 0] if data.ndim == 3 else data
    else:
        from astropy.io import fits

        with fits.open(src) as hdul:
            img = next(h for h in hdul if h.data is not None).data
    if img.dtype != np.uint16:
        raise SystemExit(f"{src}: expected uint16 samples, got {img.dtype}")
    if frame["needs_flipud"]:
        img = np.flipud(img)
    return np.ascontiguousarray(img)


def load_master(master_id: str) -> np.ndarray:
    """Float32 DN of one master; source images are [0,1] so they are scaled by 65535."""
    sys.path.insert(0, str(REPO / "tools"))
    import astro

    if master_id == "bias":
        src = CAL_DIR / "masterBias_BIN-1_6224x4168.xisf"
    elif master_id == "dark":
        src = CAL_DIR / "masterDark_BIN-1_6224x4168_EXPOSURE-300.00s.xisf"
    else:
        src = PRE / "masters" / f"{master_id}.fits"
    img, _hdr = astro.load(src)  # (C,H,W) float32 in [0,1]
    return np.ascontiguousarray(img[0] * np.float32(ADU_MAX), dtype=np.float32)


def process_light(frame: dict) -> tuple[str, dict, float]:
    t0 = time.time()
    img = load_light(frame)
    if img.shape != (frame["height"], frame["width"]):
        raise SystemExit(f"{frame['id']}: shape {img.shape} != frames.json {frame['height']}x{frame['width']}")
    files = write_pyramid(img, frame["id"], "u16")
    return frame["id"], files, time.time() - t0


def process_master(master_id: str) -> tuple[str, dict, float, tuple[int, int]]:
    t0 = time.time()
    img = load_master(master_id)
    files = write_pyramid(img, master_id, "f32")
    return master_id, files, time.time() - t0, (int(img.shape[1]), int(img.shape[0]))


def ecc_p90(frame_id: str) -> float | None:
    """90th percentile of star eccentricity from Stage A's stars/<id>.csv (SPEC §5, Stage C)."""
    p = PRE / "stars" / f"{frame_id}.csv"
    if not p.exists():
        return None
    with open(p, newline="") as f:
        rows = list(csv.DictReader(f))
    vals = [float(r["ecc"]) for r in rows if r.get("ecc") not in (None, "") and r.get("ok", "True") in ("True", "1", "true", "")]
    return float(np.percentile(vals, 90)) if vals else None


def light_entry(frame: dict) -> dict:
    fid = frame["id"]
    files = {"1": f"pixels/{fid}.b1.u16", **{str(b): f"pixels/{fid}.b{b}.f32" for b in BINS}}
    return {
        "id": fid,
        "kind": "light",
        "width": frame["width"],
        "height": frame["height"],
        "dtype": "u16",
        "files": files,
        "pier_side": frame["pier_side"],
        "defect": frame["defect"],
        "relative_of": frame["relative_of"],
        "H": frame["alignment"]["matrix_ref_to_frame"],
        "header": {
            "date_obs": frame["date_obs"],
            "exptime": frame["exptime"],
            "ccd_temp": frame["ccd_temp"],
            "gain": frame["gain"],
            "offset": frame["offset"],
        },
        "wbpp_weight": None,  # the registered XISF headers carry no WBPP weight keyword
        "ecc_p90": ecc_p90(fid),
    }


def master_entry(master_id: str, width: int, height: int) -> dict:
    kind = "master" if master_id in ("bias", "dark") else ("darkflat" if master_id.startswith("darkflat") else "flat")
    files = {"1": f"pixels/{master_id}.b1.f32", **{str(b): f"pixels/{master_id}.b{b}.f32" for b in BINS}}
    return {"id": master_id, "kind": kind, "width": width, "height": height, "dtype": "f32", "files": files}


def write_json_atomic(obj: dict, path: Path) -> None:
    tmp = path.with_name(path.name + ".tmp")
    tmp.write_text(json.dumps(obj, indent=1))
    os.replace(tmp, path)


def build_manifest(frames: list[dict], master_dims: dict[str, tuple[int, int]]) -> dict:
    ref = frames[0]["alignment"]["reference"]
    pixel_scale = json.loads((PRE / "stars.json").read_text()).get("pixel_scale_arcsec_per_px", 0.277)
    assets = {f["id"]: light_entry(f) for f in frames}
    for mid in MASTER_IDS:
        w, h = master_dims.get(mid, (frames[0]["width"], frames[0]["height"]))
        assets[mid] = master_entry(mid, w, h)
    return {"reference": ref, "pixel_scale_arcsec": pixel_scale, "assets": assets}


def log(msg: str) -> None:
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", file=sys.stderr, flush=True)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--workers", type=int, default=6)
    ap.add_argument("--only", help="comma-separated asset ids to (re)build; default all")
    args = ap.parse_args()

    frames = json.loads((PRE / "frames.json").read_text())["frames"]
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "pixels").mkdir(exist_ok=True)

    for name in COPIED_JSON:
        shutil.copyfile(PRE / name, OUT / name)
    # A provisional manifest goes first so consumers can start as pixel files appear
    # (a file that exists under its final name is complete). It is rewritten at the end.
    write_json_atomic(build_manifest(frames, {}), OUT / "manifest.json")
    log(f"copied {len(COPIED_JSON)} JSON files and wrote a provisional manifest to {OUT}")

    only = set(args.only.split(",")) if args.only else None
    lights = [f for f in frames if only is None or f["id"] in only]
    masters = [m for m in MASTER_IDS if only is None or m in only]

    t0 = time.time()
    master_dims: dict[str, tuple[int, int]] = {}
    with ProcessPoolExecutor(max_workers=args.workers) as ex:
        light_futs = {ex.submit(process_light, f): f["id"] for f in lights}
        master_futs = {ex.submit(process_master, m): m for m in masters}
        done = 0
        total = len(light_futs) + len(master_futs)
        for fut in as_completed(list(light_futs) + list(master_futs)):
            res = fut.result()
            done += 1
            if fut in master_futs:
                master_dims[res[0]] = res[3]
            log(f"{done}/{total} {res[0]} ({res[2]:.1f}s)")

    write_json_atomic(build_manifest(frames, master_dims), OUT / "manifest.json")
    log(f"wrote {OUT / 'manifest.json'} with {len(frames) + len(MASTER_IDS)} assets in {time.time() - t0:.0f}s")


if __name__ == "__main__":
    main()
