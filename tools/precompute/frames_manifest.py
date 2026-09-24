#!/usr/bin/env python3
"""Build frames.json: one entry per light frame (20 raw + 4 synthetic defect frames).

Reads only header/metadata (XISF header XML, XDRZ alignment XML, FITS headers) -
no pixel data is loaded, so this runs in well under a second.

Usage:
  uv run tools/precompute/frames_manifest.py
"""
from __future__ import annotations

import json
import re
import struct
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
LIGHT_DIR = REPO / "source_images" / "light"
REG_DIR = REPO / "source_images" / "light_registered"
SYNTH_DIR = REPO / "source_images" / "light_synthetic_disaster"
OUT = REPO / "data" / "derived" / "precompute" / "frames.json"

FITS_KW_RE = re.compile(r'<FITSKeyword\s+name="([^"]+)"\s+value="([^"]*)"')
IMAGE_GEOM_RE = re.compile(r'<Image\s+geometry="(\d+):(\d+):(\d+)"')


def _unquote(v: str) -> str:
    v = v.strip()
    if len(v) >= 2 and v[0] == "'" and v[-1] == "'":
        v = v[1:-1]
    return v


def read_xisf_header(path: Path) -> tuple[dict, tuple[int, int]]:
    """Return (FITSKeyword dict, (width, height)) from an XISF header, without reading pixels."""
    with open(path, "rb") as f:
        sig = f.read(8)
        if sig != b"XISF0100":
            raise ValueError(f"not an XISF file: {path}")
        hlen = struct.unpack("<I", f.read(4))[0]
        f.read(4)  # reserved
        xml = f.read(hlen).decode("utf-8")
    kw = {name: _unquote(val) for name, val in FITS_KW_RE.findall(xml)}
    m = IMAGE_GEOM_RE.search(xml)
    width, height = (int(m.group(1)), int(m.group(2))) if m else (None, None)
    return kw, (width, height)


def read_xdrz(path: Path) -> dict:
    xml = path.read_text(encoding="utf-8")
    mat = re.search(r"<AlignmentMatrix>([^<]+)</AlignmentMatrix>", xml).group(1)
    matrix = [float(x) for x in mat.split(",")]
    origin = re.search(r'<AlignmentOrigin\s+x="([^"]+)"\s+y="([^"]+)"', xml)
    return {"matrix_ref_to_frame": matrix, "origin": [float(origin.group(1)), float(origin.group(2))]}


def read_fits_header(path: Path) -> tuple[dict, tuple[int, int]]:
    from astropy.io import fits

    h = fits.getheader(path)
    kw = {k: h[k] for k in h if k and k not in ("COMMENT", "HISTORY")}
    width, height = int(h["NAXIS1"]), int(h["NAXIS2"])
    return kw, (width, height)


def rel(path: Path) -> str:
    return str(path.relative_to(REPO))


def build_raw_entry(idx: int) -> dict:
    fid = f"f{idx:02d}"
    pattern = f"*FRAME_{idx:04d}_*.xisf"
    matches = sorted(p for p in LIGHT_DIR.glob(pattern) if "_TRAIL_" not in p.name and "_PATCHY_CLOUD" not in p.name)
    if len(matches) != 1:
        raise SystemExit(f"expected exactly one raw light for frame {idx}, found {matches}")
    src = matches[0]
    kw, (w, h) = read_xisf_header(src)

    reg_matches = sorted(REG_DIR.glob(f"*FRAME_{idx:04d}_*_r.xdrz"))
    if len(reg_matches) != 1:
        raise SystemExit(f"expected exactly one xdrz for frame {idx}, found {reg_matches}")
    align = read_xdrz(reg_matches[0])

    defect = "satellite" if idx == 3 else "none"
    return {
        "id": fid,
        "frame_index": idx,
        "kind": "raw",
        "source": rel(src),
        "needs_flipud": False,
        "defect": defect,
        "relative_of": None,
        "pier_side": kw.get("PIERSIDE"),
        "date_obs": kw.get("DATE-OBS"),
        "exptime": float(kw["EXPTIME"]) if "EXPTIME" in kw else None,
        "ccd_temp": float(kw["CCD-TEMP"]) if "CCD-TEMP" in kw else None,
        "gain": int(float(kw["GAIN"])) if "GAIN" in kw else None,
        "offset": int(float(kw["OFFSET"])) if "OFFSET" in kw else None,
        "width": w,
        "height": h,
        "alignment": {
            "reference": "f07",
            "matrix_ref_to_frame": align["matrix_ref_to_frame"],
            "origin": align["origin"],
        },
    }


SYNTH_SPECS = [
    # (id, frame_index, glob suffix, defect)
    ("f11_tracking", 11, "*FRAME_0011_*_TRAIL_*.fits", "tracking"),
    ("f14_cloud", 14, "*FRAME_0014_*_PATCHY_CLOUD*.fits", "cloud"),
    ("f15_cloud", 15, "*FRAME_0015_*_PATCHY_CLOUD*.fits", "cloud"),
    ("f16_cloud", 16, "*FRAME_0016_*_PATCHY_CLOUD*.fits", "cloud"),
]


def build_synthetic_entry(sid: str, idx: int, glob_pat: str, defect: str, raw_by_index: dict[int, dict]) -> dict:
    matches = sorted(SYNTH_DIR.glob(glob_pat))
    if len(matches) != 1:
        raise SystemExit(f"expected exactly one synthetic file for {sid}, found {matches}")
    src = matches[0]
    kw, (w, h) = read_fits_header(src)
    raw = raw_by_index[idx]
    return {
        "id": sid,
        "frame_index": idx,
        "kind": "synthetic",
        "source": rel(src),
        "needs_flipud": True,
        "defect": defect,
        "relative_of": raw["id"],
        "pier_side": kw.get("PIERSIDE"),
        "date_obs": kw.get("DATE-OBS"),
        "exptime": float(kw["EXPTIME"]) if "EXPTIME" in kw else None,
        "ccd_temp": float(kw["CCD-TEMP"]) if "CCD-TEMP" in kw else None,
        "gain": int(float(kw["GAIN"])) if "GAIN" in kw else None,
        "offset": int(float(kw["OFFSET"])) if "OFFSET" in kw else None,
        "width": w,
        "height": h,
        # the synthetic FITS shares the raw relative's registration geometry
        "alignment": raw["alignment"],
    }


def main() -> None:
    raw_entries = [build_raw_entry(i) for i in range(20)]
    raw_by_index = {e["frame_index"]: e for e in raw_entries}
    synth_entries = [build_synthetic_entry(*spec, raw_by_index) for spec in SYNTH_SPECS]

    frames = raw_entries + synth_entries
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({"frames": frames}, indent=2))
    print(f"wrote {OUT} ({len(frames)} frames)", file=sys.stderr)


if __name__ == "__main__":
    main()
