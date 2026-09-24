#!/usr/bin/env python3
"""Real image assets for the Welcome page.

The page shows the whole journey once, before any lesson: one exposure straight from the
camera, the stack of all twenty exposures, and the finished colour photograph. Welcome is the
one lesson page allowed to show full-field views (design-notes.md §5.1), so nothing here is
cropped to a region.

Outputs (assets/welcome/, all binned or resized to the 1200 px page column, 8-bit PNG):
  sub_full.png       frame f07 (the registration reference), uncalibrated, one AutoSTF
                     (target bg 0.30, shadows clip -1.8 MADN, the Flats-1 stretch)
  master_full.png    the WBPP master light (20 x 300 s, Red filter), its own AutoSTF with the
                     same parameters. The master is calibrated and normalized, so its median
                     differs from the raw sub's and it needs its own stretch (SPEC §4.5 gives
                     every view in one calibration state the same stretch; these two views are
                     in different states).
  colour_full.png    source_images/final/NGC7331.png (the owner's finished colour composite,
                     already stretched), resized with Lanczos, alpha dropped.
  stats.json         the STF used for each image, the median and whole-frame spread (MADN) of
                     the sub and the master in pixel brightness (0..65535), and their ratio.
                     The sub is uncalibrated, so its spread includes vignetting; the ratio is
                     recorded for reference and is not quoted on the page.

Usage:
  uv run tools/assets/welcome_page.py            # writes assets/welcome/
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "tools"))
import astro  # noqa: E402

PRE = REPO / "data" / "derived" / "precompute"
FINAL = REPO / "source_images" / "final"
OUT = REPO / "assets" / "welcome"

FRAME = "f07"
DN = 65535.0
FULL_W = 1200
STF = dict(target_bg=0.30, shadows_clip=-1.8)


def bin_to_width(img: np.ndarray, width: int) -> np.ndarray:
    """Integer-factor mean binning of a (H,W) image so that W // k is closest to `width`."""
    h, w = img.shape
    k = max(1, round(w / width))
    hh, ww = (h // k) * k, (w // k) * k
    return img[:hh, :ww].reshape(hh // k, k, ww // k, k).mean(axis=(1, 3))


def save_gray(img: np.ndarray, path: Path) -> None:
    astro.save(np.clip(img, 0, 1)[None].astype(np.float32), path, bits=8)


def madn(img: np.ndarray) -> float:
    return float(1.4826 * np.median(np.abs(img - np.median(img))))


def stretched(img: np.ndarray, label: str, path: Path) -> dict:
    binned = bin_to_width(img, FULL_W)
    stf = astro.auto_stf(binned[None].astype(np.float32), **STF)
    save_gray(astro.apply_stf(np.clip(binned, 0, 1)[None].astype(np.float32), stf)[0], path)
    return {
        "source": label,
        "size_px": {"w": int(binned.shape[1]), "h": int(binned.shape[0])},
        "bin_factor": int(round(img.shape[1] / binned.shape[1])),
        "stf": {"c0": stf[0][0], "m": stf[0][1], **STF},
        "median_dn": float(np.median(img)) * DN,
        "whole_frame_madn_dn": madn(img) * DN,  # raw sub: includes vignetting, so not a pure noise figure
    }


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    frames = {f["id"]: f for f in json.load(open(PRE / "frames.json"))["frames"]}

    sub, _ = astro.load(REPO / frames[FRAME]["source"])
    master_path = next(FINAL.glob("masterLight_*.xisf"))
    master, _ = astro.load(master_path)

    stats = {
        "frame": FRAME,
        "sub_full": stretched(sub[0].astype(np.float64), frames[FRAME]["source"], OUT / "sub_full.png"),
        "master_full": stretched(master[0].astype(np.float64), master_path.name, OUT / "master_full.png"),
    }
    stats["noise_ratio_sub_over_master"] = (
        stats["sub_full"]["whole_frame_madn_dn"] / stats["master_full"]["whole_frame_madn_dn"]
    )

    colour = Image.open(FINAL / "NGC7331.png").convert("RGB")
    w, h = colour.size
    colour = colour.resize((FULL_W, round(h * FULL_W / w)), Image.LANCZOS)
    colour.save(OUT / "colour_full.png", optimize=True)
    stats["colour_full"] = {
        "source": "source_images/final/NGC7331.png",
        "original_px": {"w": w, "h": h},
        "size_px": {"w": colour.size[0], "h": colour.size[1]},
    }

    json.dump(stats, open(OUT / "stats.json", "w"), indent=1)
    print(json.dumps(stats, indent=1))


if __name__ == "__main__":
    main()
