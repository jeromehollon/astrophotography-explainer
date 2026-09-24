#!/usr/bin/env python3
"""Write the golden fixtures that src/shared/pipeline/*.test.ts compare against.

Fixtures come from real data (source_images/, data/derived/precompute/) but are
kept tiny (< 2 MB in total) so that `npm test` runs without a server. The
formulas are the ones in tools/astro.py (STF) and tools/golden/reference.py
(calibration, Lanczos warp, normalization, rejection), which in turn follow
docs/knowledge/wbpp.md.

  (a) stf.json        AutoSTF params and MTF samples from tools/astro.py
  (b) calibrate.json  64x64 crop of f03 with masters, calibrated for 3 calStates
  (c) warp.json       f03 raw crop warped to canonical space vs PixInsight _r.xisf
  (d) integrate.json  12-sample synthetic stacks per rejection algorithm
  (e) stack.json      8-frame 32x32 stack (ref f03, bin 1) through the numpy reference
  (f) hotpixels.json  20-frame 56x56 stack at bin 2 (ref f03, dark|flat_50_darkflat) of a
                      star-poor patch near the galaxy, from the runtime bin-2 pixel files,
                      with the master dark's hot-pixel positions and their residuals in the
                      reference frame, the average and the median

Usage (from the checkout that holds source_images/ and data/):
  uv run tools/golden/make_fixtures.py [--repo PATH] [--out PATH] [--only hotpixels]
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE.parents[0]))  # tools/ -> astro
import reference as ref  # noqa: E402

ADU = 65535.0
CAL = "source_images/calibration"


def rnd(a, nd=4):
    a = np.asarray(a, dtype=np.float64)
    out = np.where(np.isfinite(a), np.round(a, nd), None).tolist()
    return out


def load_frame(repo: Path, frame: dict, astro):
    img, _ = astro.load(repo / frame["source"])
    if frame["needs_flipud"]:
        img = np.flip(img, axis=1)
    return img[0].astype(np.float64) * ADU  # DN


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--repo", default=str(HERE.parents[1]))
    ap.add_argument("--out", default=str(HERE.parents[1] / "src" / "shared" / "pipeline" / "__fixtures__"))
    ap.add_argument("--only", choices=["hotpixels"], help="regenerate one fixture (hotpixels needs only data/derived/runtime)")
    args = ap.parse_args()
    repo = Path(args.repo)
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    if args.only == "hotpixels":
        make_hotpixels(repo, out)
        return
    import astro

    pre = repo / "data" / "derived" / "precompute"
    frames = {f["id"]: f for f in json.loads((pre / "frames.json").read_text())["frames"]}
    masters_meta = json.loads((pre / "masters.json").read_text())
    norm = json.loads((pre / "normalization.json").read_text())

    t0 = time.monotonic()
    f03 = frames["f03"]
    W, Hh = f03["width"], f03["height"]
    light03 = load_frame(repo, f03, astro)
    bias, _ = astro.load(repo / CAL / "masterBias_BIN-1_6224x4168.xisf")
    dark, _ = astro.load(repo / CAL / "masterDark_BIN-1_6224x4168_EXPOSURE-300.00s.xisf")
    bias = bias[0].astype(np.float64) * ADU
    dark = dark[0].astype(np.float64) * ADU
    flats = {}
    for fid in ("flat_50_darkflat", "flat_10_bias"):
        img, _ = astro.load(pre / "masters" / f"{fid}.fits")
        flats[fid] = img[0].astype(np.float64) * ADU
    f_v = {fid: masters_meta[fid]["scale_f_v"]["dn"] for fid in flats}
    print(f"loaded f03 + masters in {time.monotonic() - t0:.1f}s", file=sys.stderr)

    # ---------------------------------------------------------------- (a) STF
    cases = []
    crops = {
        "f03_raw": light03[1800:2312, 2800:3312] / ADU,
        "f03_dark_flat50": ((light03 - dark) / (flats["flat_50_darkflat"] / f_v["flat_50_darkflat"]))[1800:2312, 2800:3312] / ADU,
        "master_dark": dark[1000:1512, 1000:1512] / ADU,
        "master_bias": bias[1000:1512, 1000:1512] / ADU,
    }
    for name, crop in crops.items():
        for (tb, clip) in ((0.25, -2.8), (0.30, -1.8)):
            (c0, m, c1), = astro.auto_stf(crop[None].astype(np.float32), target_bg=tb, shadows_clip=clip)
            med = float(np.median(crop))
            madn = 1.4826 * float(np.median(np.abs(crop - med)))
            xs = [c0, med, med + 3 * madn, med + 20 * madn, 0.5, 0.9, 1.0, 0.0]
            ys = astro.apply_stf(np.array(xs, dtype=np.float32)[None, :, None], [(c0, m, c1)])[0, :, 0]
            cases.append({"name": name, "targetBg": tb, "clip": clip, "median_dn": med * ADU, "madn_dn": madn * ADU,
                          "c0_dn": c0 * ADU, "m": m, "samples_dn": [x * ADU for x in xs],
                          "expected": [float(v) for v in ys]})
    (out / "stf.json").write_text(json.dumps({"cases": cases}))

    # ---------------------------------------------------------------- (b) calibrate
    y0, x0, n = 2000, 3000, 64
    sl = (slice(y0, y0 + n), slice(x0, x0 + n))
    L = light03[sl]
    calib = {
        "rect": {"x": x0, "y": y0, "w": n, "h": n},
        "light": rnd(L, 0), "bias": rnd(bias[sl]), "dark": rnd(dark[sl]),
        "flat_50_darkflat": rnd(flats["flat_50_darkflat"][sl]), "flat_10_bias": rnd(flats["flat_10_bias"][sl]),
        "f_v": f_v,
        "expected": {
            "dark|flat_50_darkflat": rnd((L - dark[sl]) / (flats["flat_50_darkflat"][sl] / f_v["flat_50_darkflat"])),
            "bias|flat_10_bias": rnd((L - bias[sl]) / (flats["flat_10_bias"][sl] / f_v["flat_10_bias"])),
            "none|none": rnd(L),
            "dark|none": rnd(L - dark[sl]),
        },
    }
    (out / "calibrate.json").write_text(json.dumps(calib))

    # ---------------------------------------------------------------- (c) warp vs PixInsight
    H03 = np.array(f03["alignment"]["matrix_ref_to_frame"]).reshape(3, 3)
    reg_path = repo / f03["source"].replace("light/", "light_registered/").replace(".xisf", "_r.xisf")
    reg, _ = astro.load(reg_path)
    reg = reg[0].astype(np.float64) * ADU
    print(f"registered f03 {reg.shape}", file=sys.stderr)
    cx, cy, cw, ch = 2000, 1500, 96, 96  # canonical rect (f07 space)
    u, v = np.meshgrid(np.arange(cx, cx + cw, dtype=np.float64), np.arange(cy, cy + ch, dtype=np.float64))
    xs, ys = ref.apply_h(H03, u, v)
    pad = 8
    rx0, ry0 = int(np.floor(xs.min())) - pad, int(np.floor(ys.min())) - pad
    rx1, ry1 = int(np.ceil(xs.max())) + pad + 1, int(np.ceil(ys.max())) + pad + 1
    crop = light03[ry0:ry1, rx0:rx1]
    numpy_warp = ref.warp_lanczos3(light03, xs, ys)
    pi_warp = reg[cy:cy + ch, cx:cx + cw]
    d = numpy_warp - pi_warp
    print(f"numpy vs PixInsight warp: median|d|={np.median(np.abs(d)):.3f} p99={np.percentile(np.abs(d), 99):.2f} "
          f"max={np.abs(d).max():.1f} DN", file=sys.stderr)
    warp = {
        "H": H03.ravel().tolist(), "imageWidth": W, "imageHeight": Hh,
        "outRect": {"x": cx, "y": cy, "w": cw, "h": ch},
        "srcRect": {"x": rx0, "y": ry0, "w": rx1 - rx0, "h": ry1 - ry0},
        "src": rnd(crop, 0),
        "expectedPixInsight": rnd(pi_warp, 2),
        "expectedNumpy": rnd(numpy_warp, 3),
        "numpyVsPixInsight": {"medianAbs": float(np.median(np.abs(d))), "p99Abs": float(np.percentile(np.abs(d), 99)),
                              "maxAbs": float(np.abs(d).max())},
    }
    (out / "warp.json").write_text(json.dumps(warp))
    del reg

    # ---------------------------------------------------------------- (d) integrate
    rng = np.random.default_rng(7331)
    stacks = []
    n_s, n_px = 12, 40
    base = rng.normal(700.0, 12.0, size=(n_s, n_px))
    base[0, :8] += rng.uniform(80, 900, size=8)           # bright outliers (satellite)
    base[5, 8:14] -= rng.uniform(60, 200, size=6)         # dark outliers
    base[3, 14:18] += 3000                                # huge outliers
    base[1, 18:20] += 25                                  # mild outliers within the noise
    base[:, 20:24] = 500.0                                # constant stacks (sigma = 0)
    base[7, 24:28] = np.nan                               # NaN samples
    base[2:9, 28:30] = np.nan                             # only 5 finite samples
    base[1:, 30:32] = np.nan                              # 1 finite sample
    base[:, 32] = np.nan                                  # nothing survives
    base[[0, 4, 9], 33:36] += 55.0                        # three outliers at 4.5 sigma
    sys.path.insert(0, str(HERE.parents[0] / "precompute"))
    import integrate as pre_integrate

    methods = {
        "average": {}, "median": {},
        "kappaSigma": {"sigmaLow": 4.0, "sigmaHigh": 3.0},
        "kappaSigma_2_2": {"sigmaLow": 2.0, "sigmaHigh": 2.0},
        "winsorized": {"sigmaLow": 4.0, "sigmaHigh": 3.0, "cutoff": 5.0},
        "winsorized_3_2": {"sigmaLow": 3.0, "sigmaHigh": 2.0, "cutoff": 5.0},
        "rcr": {"limit": 0.1},
        "rcr_0.5": {"limit": 0.5},
    }
    expected = {}
    for key, params in methods.items():
        method = key.split("_")[0]
        expected[key] = {"method": method, "params": params,
                         "values": rnd([ref.integrate_1d(base[:, k], method, params) for k in range(n_px)], 6)}
    # integrate.py's winsorized (MAD start, re-clip original each pass): loose-tolerance cross-check.
    finite_cols = [k for k in range(n_px) if np.isfinite(base[:, k]).all()]
    pre = pre_integrate.winsorized_sigma_clip_average(base[:, finite_cols][:, :, None])[:, 0]
    expected["winsorized_precompute_py"] = {"method": "winsorized", "params": methods["winsorized"],
                                            "columns": finite_cols, "values": rnd(pre, 4)}
    (out / "integrate.json").write_text(json.dumps({"n": n_s, "stacks": rnd(base, 4), "expected": expected}))

    # ---------------------------------------------------------------- (e) 8-frame stack
    ids = ["f00", "f01", "f02", "f03", "f04", "f05", "f08", "f10"]
    ref_id, cal_state, flat_id = "f03", "dark|flat_50_darkflat", "flat_50_darkflat"
    gx, gy, gw, gh = 2600, 1800, 32, 32  # output rect in the ref (f03, West) grid, bin 1
    H_r = np.array(frames[ref_id]["alignment"]["matrix_ref_to_frame"]).reshape(3, 3)
    F_r = ref.f_rot(W, Hh, frames[ref_id]["pier_side"] == "East")
    u, v = np.meshgrid(np.arange(gx, gx + gw, dtype=np.float64), np.arange(gy, gy + gh, dtype=np.float64))
    warped = []
    frames_out = []
    pad = 8
    for fid in ids:
        fr = frames[fid]
        H_i = np.array(fr["alignment"]["matrix_ref_to_frame"]).reshape(3, 3)
        M = ref.output_to_frame(H_i, H_r, F_r, 1)
        xs, ys = ref.apply_h(M, u, v)
        light = light03 if fid == "f03" else load_frame(repo, fr, astro)
        C = (light - dark) / (flats[flat_id] / f_v[flat_id])
        wv = ref.warp_lanczos3(C, xs, ys)
        st_i, st_r = norm["frames"][fid]["states"][cal_state], norm["frames"][ref_id]["states"][cal_state]
        y = (wv - st_i["median_dn"]) * (st_r["bwmv_dn"] / st_i["bwmv_dn"]) + st_r["median_dn"]
        warped.append(y)
        rx0, ry0 = int(np.floor(xs.min())) - pad, int(np.floor(ys.min())) - pad
        rx1, ry1 = int(np.ceil(xs.max())) + pad + 1, int(np.ceil(ys.max())) + pad + 1
        rx0, ry0 = max(rx0, 0), max(ry0, 0)
        rx1, ry1 = min(rx1, W), min(ry1, Hh)
        sl = (slice(ry0, ry1), slice(rx0, rx1))
        frames_out.append({
            "id": fid, "pier_side": fr["pier_side"], "H": H_i.ravel().tolist(),
            "srcRect": {"x": rx0, "y": ry0, "w": rx1 - rx0, "h": ry1 - ry0},
            "light": rnd(light[sl], 0), "dark": rnd(dark[sl], 3), "flat": rnd(flats[flat_id][sl], 3),
            "norm": st_i,
            "expectedWarpedNormalized": rnd(y, 3),
        })
        print(f"  {fid}: warped, finite={np.isfinite(y).mean():.2f}", file=sys.stderr)
        del light
    stack = np.stack(warped)
    expected_e = {}
    for method in ("average", "median", "kappaSigma", "winsorized", "rcr"):
        vals = np.array([[ref.integrate_1d(stack[:, r, c], method) for c in range(gw)] for r in range(gh)])
        expected_e[method] = rnd(vals, 3)
    (out / "stack.json").write_text(json.dumps({
        "reference": ref_id, "referencePier": frames[ref_id]["pier_side"],
        "H_ref": H_r.ravel().tolist(), "imageWidth": W, "imageHeight": Hh,
        "grid": {"ref": ref_id, "x": gx, "y": gy, "w": gw, "h": gh, "bin": 1},
        "calState": cal_state, "flatId": flat_id, "f_v": f_v[flat_id],
        "refNorm": norm["frames"][ref_id]["states"][cal_state],
        "frames": frames_out, "expected": expected_e,
    }))
    make_hotpixels(repo, out)
    total = sum(p.stat().st_size for p in out.glob("*.json"))
    print(f"wrote fixtures to {out} ({total / 1e6:.2f} MB) in {time.monotonic() - t0:.0f}s", file=sys.stderr)


# ---------------------------------------------------------------- (f) hot pixels in a 20-frame bin-2 stack


def local_excess(img: np.ndarray, size: int = 7) -> np.ndarray:
    """Value minus the median of its size x size neighbourhood (reflected at the edges): isolates 1-2 px spikes."""
    from scipy import ndimage

    x = np.where(np.isfinite(img), img, np.nanmedian(img))
    return x - ndimage.median_filter(x, size=size, mode="reflect")


def make_hotpixels(repo: Path, out: Path) -> None:
    """20 raw frames, ref f03, bin 2, dark|flat_50_darkflat, on a 56x56 bin-2 window (native 3822,2228 112x112).

    The window sits in the galaxy ROI of the workbench (centre 3246,2100), away from the galaxy and with few
    stars, and holds ~30 pixels the master dark flags as hot. Inputs are the runtime bin-2 files that the app
    itself serves, so the fixture exercises the exact numbers the browser sees; the numpy reference (Lanczos-3,
    normalization, mean / median over finite samples) is the same as for stack.json.
    """
    rt = repo / "data" / "derived" / "runtime"
    man = json.loads((rt / "manifest.json").read_text())["assets"]
    norm = json.loads((rt / "normalization.json").read_text())["frames"]
    masters = json.loads((rt / "masters.json").read_text())
    ref_id, state, flat_id, b = "f03", "dark|flat_50_darkflat", "flat_50_darkflat", 2
    W, Hh = man[ref_id]["width"], man[ref_id]["height"]
    fw, fh = W // b, Hh // b

    def load2(aid: str) -> np.ndarray:
        return np.fromfile(rt / man[aid]["files"][str(b)], dtype=np.float32).reshape(fh, fw).astype(np.float64)

    dark, flat = load2("dark"), load2(flat_id)
    f_v = masters[flat_id]["scale_f_v"]["dn"]
    ids = [f"f{i:02d}" for i in range(20)]
    gx, gy, n = 3822, 2228, 112  # native, multiples of b
    ox, oy, ow, oh = gx // b, gy // b, n // b, n // b
    H_r = np.array(man[ref_id]["H"]).reshape(3, 3)
    F_r = ref.f_rot(W, Hh, man[ref_id]["pier_side"] == "East")
    u, v = np.meshgrid(np.arange(ox, ox + ow, dtype=np.float64), np.arange(oy, oy + oh, dtype=np.float64))
    st_r = norm[ref_id]["states"][state]
    pad = 4  # Lanczos radius 3 + 1 for the floor/ceil of the tap window
    frames_out, warped, crops = [], [], {}
    for fid in ids:
        H_i = np.array(man[fid]["H"]).reshape(3, 3)
        M = ref.output_to_frame(H_i, H_r, F_r, b)
        xs, ys = ref.apply_h(M, u, v)
        C = (load2(fid) - dark) / (flat / f_v)
        wv = ref.warp_lanczos3(C, xs, ys)
        st_i = norm[fid]["states"][state]
        warped.append((wv - st_i["median_dn"]) * (st_r["bwmv_dn"] / st_i["bwmv_dn"]) + st_r["median_dn"])
        rx0, ry0 = int(np.floor(xs.min())) - pad, int(np.floor(ys.min())) - pad
        rx1, ry1 = int(np.ceil(xs.max())) + pad + 1, int(np.ceil(ys.max())) + pad + 1
        crops[fid] = (rx0, ry0, rx1, ry1)
        frames_out.append({"id": fid, "pier_side": man[fid]["pier_side"], "H": H_i.ravel().tolist(),
                           "srcRect": {"x": rx0 * b, "y": ry0 * b, "w": (rx1 - rx0) * b, "h": (ry1 - ry0) * b},
                           # bin-2 samples are means of 4 u16 values, so 4x the value is an exact integer
                           "light4": np.rint(4 * load2(fid)[ry0:ry1, rx0:rx1]).astype(np.int64).tolist(), "norm": st_i})
    masters_out = {}
    for side in ("West", "East"):
        rs = [crops[f] for f in ids if man[f]["pier_side"] == side]
        x0, y0 = min(r[0] for r in rs), min(r[1] for r in rs)
        x1, y1 = max(r[2] for r in rs), max(r[3] for r in rs)
        masters_out[side] = {"rect": {"x": x0 * b, "y": y0 * b, "w": (x1 - x0) * b, "h": (y1 - y0) * b},
                             "dark": rnd(dark[y0:y1, x0:x1], 3), "flat": rnd(flat[y0:y1, x0:x1], 3)}
    stack = np.stack(warped)
    avg, med = np.nanmean(stack, 0), np.nanmedian(stack, 0)
    single = warped[ids.index(ref_id)]
    # hot pixels: the master dark on the output grid (f03 is the reference, so its sensor grid is the output grid)
    dwin = dark[oy:oy + oh, ox:ox + ow]
    dmadn = 1.4826 * float(np.median(np.abs(dwin - np.median(dwin))))
    dex = local_excess(dwin)
    hot = np.argwhere(dex > 25 * dmadn)
    ex = {k: local_excess(a) for k, a in (("reference", single), ("average", avg), ("median", med))}
    sig = {k: 1.4826 * float(np.median(np.abs(e - np.median(e)))) for k, e in ex.items()}
    ys_, xs_ = hot[:, 0], hot[:, 1]
    stats = {k: {"excess_p50_dn": float(np.median(e[ys_, xs_])), "sigma_dn": sig[k],
                 "n_above_5sigma": int((e[ys_, xs_] > 5 * sig[k]).sum())} for k, e in ex.items()}
    print(f"hotpixels: {len(hot)} hot pixels; " + "; ".join(f"{k} p50 {s['excess_p50_dn']:.1f} DN, sigma {s['sigma_dn']:.2f}, "
          f">5sigma {s['n_above_5sigma']}" for k, s in stats.items()), file=sys.stderr)
    (out / "hotpixels.json").write_text(json.dumps({
        "reference": ref_id, "imageWidth": W, "imageHeight": Hh,
        "grid": {"ref": ref_id, "x": gx, "y": gy, "w": n, "h": n, "bin": b},
        "calState": state, "flatId": flat_id, "f_v": f_v, "refNorm": st_r,
        "lightScale": 4, "frames": frames_out, "masters": masters_out,
        "hot": [{"x": int(x), "y": int(y), "darkExcess": round(float(dex[y, x]), 2)} for y, x in hot],
        "excessWindow": 7, "hotThresholdMadn": 25,
        "stats": stats,
        "expected": {"average": rnd(avg, 3), "median": rnd(med, 3), "reference": rnd(single, 3)},
    }))


if __name__ == "__main__":
    main()
