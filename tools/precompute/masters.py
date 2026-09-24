#!/usr/bin/env python3
"""Build the WBPP-style master dark-flats and master flats (docs/knowledge/wbpp.md §1, §6.4).

Outputs (FITS float32 in [0,1], data/derived/precompute/masters/):
  darkflat_10.fits, darkflat_50.fits, darkflat_85.fits
  flat_{10,50,85}_{darkflat,bias,none}.fits   (9 masters)
plus masters.json with per-master statistics and, for flats, the scale f_v.

Master dark-flats (wbpp.md §1.1): average, no normalization, Winsorized
sigma-clip 4/3 cutoff 5, over the raw flat-wizard darks at each histogram
level.

Master flats (wbpp.md §1.2): each raw flat is calibrated by subtracting the
matching master dark-flat, the master bias, or nothing at all (the 3 `cal`
variants), then the calibrated stack is normalized multiplicatively to a
common median (y_i = x_i * m0/mi, reference = the first frame) and combined
with the same Winsorized clip. WBPP's rejection-normalization ("equalize
fluxes") is the identical multiplicative form, so one normalized stack
serves both the rejection decision and the final combination - we don't
build two separate normalized stacks. Each level's 25 raw flats (and its 25
raw dark-flats) are loaded once and reused across all 3 `cal` variants.

Deviation from wbpp.md: WBPP's auto-rejection rule picks Linear Fit
clipping for 25-frame flat stacks (n > 15). We use Winsorized sigma-clip
4/3/cutoff-5 for every master here (bias/dark rule) instead, because panel
flats have essentially no outliers and implementing Linear Fit clipping
was not worth the time in this pass (see wbpp.md §6.3, which pre-approves
this simplification).

Data-hygiene note: `85% histogram/FLAT/Red` holds 26 files - one frame was
re-shot at 15.00s instead of the wizard's chosen 10.00s exposure (matching
the dark-flat's 10.00s). We drop any raw flat whose EXPTIME doesn't match
the majority exposure for its level/kind before integrating.

Usage:
  uv run tools/precompute/masters.py
"""
from __future__ import annotations

import json
import sys
import time
from collections import Counter
from pathlib import Path

import numpy as np

REPO = Path(__file__).resolve().parents[2]
CAL_DIR = REPO / "source_images" / "calibration"
FLATS_ROOT = CAL_DIR / "raw flats"
OUT_DIR = REPO / "data" / "derived" / "precompute" / "masters"
OUT_JSON = REPO / "data" / "derived" / "precompute" / "masters.json"

LEVELS = (10, 50, 85)
CALS = ("darkflat", "bias", "none")
ADU_MAX = 65535.0

sys.path.insert(0, str(REPO / "tools"))
sys.path.insert(0, str(REPO / "tools" / "precompute"))
import astro  # noqa: E402
import integrate  # noqa: E402


def _kind_dir(level: int, kind: str) -> Path:
    """The raw-flat directory for `kind` ('DARK' or 'FLAT') at `level`.

    10% and 85% nest an extra 'Red' filter directory; 50% does not. The
    filesystem here is case-insensitive (WSL mount of an NTFS volume), so
    'DARK' also matches the 50% level's lowercase 'dark' directory.
    """
    base = FLATS_ROOT / f"{level}% histogram" / kind
    nested = base / "Red"
    return nested if nested.is_dir() else base


def _load_group(level: int, kind: str) -> tuple[list[np.ndarray], list[dict], list[Path]]:
    """Load every raw flat/dark-flat at `level`, dropping files whose exposure
    doesn't match the group's majority exposure (see module docstring)."""
    d = _kind_dir(level, kind)
    paths = sorted(d.glob("*.xisf"))
    if not paths:
        raise SystemExit(f"no raw {kind} frames found under {d}")
    loaded = [astro.load(p) for p in paths]
    exptimes = [round(float(h["EXPTIME"]), 1) for _img, h in loaded]
    mode_exp = Counter(exptimes).most_common(1)[0][0]
    kept_imgs, kept_hdrs, kept_paths = [], [], []
    for (img, hdr), exp, p in zip(loaded, exptimes, paths):
        if exp != mode_exp:
            print(f"  dropping {p.name}: EXPTIME {exp}s != majority {mode_exp}s", file=sys.stderr)
            continue
        kept_imgs.append(img[0])  # mono: drop the channel axis
        kept_hdrs.append(hdr)
        kept_paths.append(p)
    return kept_imgs, kept_hdrs, kept_paths


def _dn_stats(img: np.ndarray) -> dict:
    adu = img.astype(np.float64) * ADU_MAX
    return {"median_dn": float(np.median(adu)), "mean_dn": float(adu.mean()),
            "min_dn": float(adu.min()), "max_dn": float(adu.max())}


def _temp_range(hdrs: list[dict]) -> list[float]:
    temps = [float(h["CCD-TEMP"]) for h in hdrs if "CCD-TEMP" in h]
    return [min(temps), max(temps)] if temps else [None, None]


def build_master_darkflat(level: int) -> tuple[np.ndarray, dict]:
    imgs, hdrs, paths = _load_group(level, "DARK")
    stack = np.stack(imgs).astype(np.float64)
    master = integrate.winsorized_sigma_clip_average(stack)
    info = {
        "id": f"darkflat_{level}", "kind": "darkflat", "level": level,
        "inputs": {"count": len(paths), "exposure_s": round(float(hdrs[0]["EXPTIME"]), 4),
                   "ccd_temp_range": _temp_range(hdrs)},
        **_dn_stats(master),
    }
    return master, info


def build_master_flats(level: int, master_darkflat: np.ndarray, master_bias: np.ndarray) -> dict[str, tuple[np.ndarray, dict]]:
    imgs, hdrs, paths = _load_group(level, "FLAT")
    raw = np.stack(imgs).astype(np.float64)
    results = {}
    for cal in CALS:
        if cal == "darkflat":
            calibrated = raw - master_darkflat[None, :, :]
        elif cal == "bias":
            calibrated = raw - master_bias[None, :, :]
        else:
            calibrated = raw
        medians = np.median(calibrated.reshape(calibrated.shape[0], -1), axis=1)
        m0 = medians[0]  # reference = first frame, wbpp.md §1.2
        normalized = calibrated * (m0 / medians)[:, None, None]
        master = integrate.winsorized_sigma_clip_average(normalized)
        f_v = integrate.trimmed_mean(master, 0.05)
        info = {
            "id": f"flat_{level}_{cal}", "kind": "flat", "level": level, "flat_cal": cal,
            "inputs": {"count": len(paths), "exposure_s": round(float(hdrs[0]["EXPTIME"]), 4),
                       "ccd_temp_range": _temp_range(hdrs)},
            **_dn_stats(master),
            "scale_f_v": {"unit_0_1": f_v, "dn": f_v * ADU_MAX},
        }
        results[cal] = (master.astype(np.float32), info)
    return results


def main() -> None:
    t0 = time.monotonic()
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    master_bias, _hdr = astro.load(CAL_DIR / "masterBias_BIN-1_6224x4168.xisf")
    master_bias = master_bias[0].astype(np.float64)

    masters_json: dict = {}
    for level in LEVELS:
        t1 = time.monotonic()
        print(f"== dark-flat {level}% ==", file=sys.stderr)
        darkflat, df_info = build_master_darkflat(level)
        astro.save(darkflat[None], OUT_DIR / f"darkflat_{level}.fits")
        masters_json[df_info["id"]] = df_info
        print(f"  median={df_info['median_dn']:.2f} DN ({time.monotonic() - t1:.1f}s)", file=sys.stderr)

        print(f"== flats {level}% ==", file=sys.stderr)
        t2 = time.monotonic()
        flats = build_master_flats(level, darkflat.astype(np.float64), master_bias)
        for cal, (master, info) in flats.items():
            astro.save(master[None], OUT_DIR / f"flat_{level}_{cal}.fits")
            masters_json[info["id"]] = info
            print(f"  {info['id']}: median={info['median_dn']:.2f} DN f_v={info['scale_f_v']['dn']:.2f} DN",
                  file=sys.stderr)
        print(f"  flats done in {time.monotonic() - t2:.1f}s", file=sys.stderr)

    OUT_JSON.write_text(json.dumps(masters_json, indent=2))
    print(f"wrote {OUT_JSON} and {len(masters_json)} masters to {OUT_DIR} in {time.monotonic() - t0:.1f}s",
          file=sys.stderr)


if __name__ == "__main__":
    main()
