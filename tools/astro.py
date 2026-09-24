#!/usr/bin/env python3
"""Astro image helpers for producing the explainer's assets.

Run with `uv run tools/astro.py <command> --help`. Commands:
  info     header and pixel statistics
  convert  FITS/XISF -> PNG (8/16-bit), JPEG, WebP, FITS or XISF, optionally stretched
  stretch  PixInsight-style auto STF (or manual shadows/midtones), then save
  stars    detect stars on a linear image and measure FWHM (elliptical Gaussian or Moffat fits)
  denoise  starlet (a trous B3-spline) wavelet denoise on chosen layers

Internally every image is float32, shape (C, H, W), normalized to [0, 1].
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np

# ---------------------------------------------------------------- I/O

HEADER_KEYS = ("IMAGETYP", "FRAME", "EXPTIME", "EXPOSURE", "GAIN", "OFFSET", "CCD-TEMP", "SET-TEMP",
               "BAYERPAT", "XBINNING", "XPIXSZ", "FOCALLEN", "FILTER", "OBJECT", "INSTRUME", "TELESCOP", "DATE-OBS")


def _normalize(data: np.ndarray) -> np.ndarray:
    """Map integer data to [0,1] by dtype range; float data is kept if already in [0,1]."""
    if np.issubdtype(data.dtype, np.integer):
        info = np.iinfo(data.dtype)
        return ((data.astype(np.float64) - info.min) / (info.max - info.min)).astype(np.float32)
    data = data.astype(np.float32)
    hi = float(np.nanmax(data))
    if hi > 1.0:  # float ADU (e.g. calibrated FITS from other software)
        data = data / (65535.0 if hi <= 65535.0 else hi)
    return np.nan_to_num(np.clip(data, 0.0, 1.0))


def load(path: str | Path) -> tuple[np.ndarray, dict]:
    """Return (image[C,H,W] float32 in [0,1], header dict)."""
    path = Path(path)
    ext = path.suffix.lower()
    if ext in (".fits", ".fit", ".fts"):
        from astropy.io import fits
        with fits.open(path) as hdul:
            hdu = next(h for h in hdul if h.data is not None)
            data = hdu.data
            header = {k: hdu.header[k] for k in hdu.header if k and k not in ("COMMENT", "HISTORY")}
        # astropy applies BZERO/BSCALE; unsigned 16-bit comes back as uint16
        if data.ndim == 2:
            data = data[None]
    elif ext == ".xisf":
        from xisf import XISF
        meta: dict = {}
        data = XISF.read(str(path), image_metadata=meta)  # (H, W, C)
        data = np.moveaxis(data, -1, 0)
        header = {k: v[0]["value"] for k, v in meta.get("FITSKeywords", {}).items() if v}
    else:
        raise SystemExit(f"unsupported input: {path}")
    return _normalize(np.ascontiguousarray(data)), header


def debayer_superpixel(img: np.ndarray, pattern: str) -> np.ndarray:
    """2x2 superpixel debayer of a single-channel CFA frame (halves resolution, no interpolation)."""
    pattern = pattern.upper()
    cfa = img[0]
    h, w = cfa.shape[0] // 2 * 2, cfa.shape[1] // 2 * 2
    planes = [cfa[0:h:2, 0:w:2], cfa[0:h:2, 1:w:2], cfa[1:h:2, 0:w:2], cfa[1:h:2, 1:w:2]]
    by = {"R": [], "G": [], "B": []}
    for ch, plane in zip(pattern, planes):
        by[ch].append(plane)
    return np.stack([np.mean(by[c], axis=0) for c in "RGB"]).astype(np.float32)


def save(img: np.ndarray, path: str | Path, bits: int = 8, quality: int = 90, header: dict | None = None) -> None:
    """Save (C,H,W) [0,1] image. Format from extension: .png (8/16-bit), .jpg/.jpeg, .webp, .fits, .xisf."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    ext = path.suffix.lower()
    img = np.clip(img, 0.0, 1.0)
    if ext in (".fits", ".fit"):
        from astropy.io import fits
        hdr = fits.Header()
        for k, v in (header or {}).items():
            if k in HEADER_KEYS:
                hdr[k] = v
        fits.PrimaryHDU(img[0] if img.shape[0] == 1 else img, header=hdr).writeto(path, overwrite=True)
        return
    if ext == ".xisf":
        from xisf import XISF
        XISF.write(str(path), np.moveaxis(img, 0, -1).astype(np.float32), creator_app="astro-tools", codec="zstd", shuffle=True)
        return
    hwc = np.moveaxis(img, 0, -1)
    if ext == ".png":
        import png  # pypng: supports 16-bit RGB, which Pillow does not
        if bits not in (8, 16):
            raise SystemExit("PNG bit depth must be 8 or 16")
        maxv = (1 << bits) - 1
        arr = np.round(hwc * maxv).astype(np.uint16 if bits == 16 else np.uint8)
        h, w, c = arr.shape
        writer = png.Writer(w, h, greyscale=(c == 1), bitdepth=bits, compression=9)
        with open(path, "wb") as f:
            writer.write(f, arr.reshape(h, w * c))
        return
    if ext in (".jpg", ".jpeg", ".webp"):
        from PIL import Image
        arr = np.round(hwc * 255).astype(np.uint8)
        im = Image.fromarray(arr[..., 0] if arr.shape[-1] == 1 else arr)
        kw = {"quality": quality}
        if ext != ".webp":
            kw.update(optimize=True, progressive=True)
        im.save(path, **kw)
        return
    raise SystemExit(f"unsupported output: {path}")


# ---------------------------------------------------------------- STF stretch

def mtf(m: float, x: np.ndarray) -> np.ndarray:
    """PixInsight midtones transfer function: maps m -> 0.5, fixes 0 and 1."""
    x = np.asarray(x, dtype=np.float64)
    if m <= 0:
        return np.where(x > 0, 1.0, 0.0)
    if m >= 1:
        return np.where(x < 1, 0.0, 1.0)
    return ((m - 1) * x) / ((2 * m - 1) * x - m)


def auto_stf(img: np.ndarray, target_bg: float = 0.25, shadows_clip: float = -2.8, linked: bool = True):
    """Return per-channel (c0, m, c1) following PixInsight's AutoSTF script.

    c0 = median + shadows_clip * MADN (clamped to [0,1]); m = MTF(target_bg, median - c0).
    Linked mode averages the statistics across channels so colour balance is preserved.
    """
    stats = []
    for ch in img:
        med = float(np.median(ch))
        madn = 1.4826 * float(np.median(np.abs(ch - med)))
        stats.append((med, madn))
    params = []
    groups = [stats] if linked else [[s] for s in stats]
    for grp in groups:
        med = np.mean([s[0] for s in grp])
        madn = np.mean([s[1] for s in grp])
        if med < 0.5:  # normal (non-inverted) image
            c0 = min(max(med + shadows_clip * madn, 0.0), 1.0)
            m = float(mtf(target_bg, med - c0))
            p = (c0, m, 1.0)
        else:  # inverted: clip highlights instead of shadows
            c1 = min(max(med - shadows_clip * madn, 0.0), 1.0)
            m = float(mtf(target_bg, c1 - med))
            p = (0.0, m, c1)
        params.append(p)
    if linked:
        params = params * img.shape[0]
    return params


def apply_stf(img: np.ndarray, params) -> np.ndarray:
    out = np.empty_like(img)
    for i, (c0, m, c1) in enumerate(params):
        x = np.clip((img[i] - c0) / max(c1 - c0, 1e-12), 0.0, 1.0)
        out[i] = mtf(m, x)
    return out.astype(np.float32)


# ---------------------------------------------------------------- stars / FWHM

def _luminance(img: np.ndarray) -> np.ndarray:
    return img.mean(axis=0) if img.shape[0] > 1 else img[0]


def _fit_star(cut: np.ndarray, model: str):
    """Least-squares fit of an elliptical Gaussian or Moffat to a background-subtracted cutout."""
    from scipy.optimize import least_squares
    yy, xx = np.mgrid[: cut.shape[0], : cut.shape[1]]
    cy, cx = np.unravel_index(np.argmax(cut), cut.shape)
    amp0 = float(cut.max())

    def shape(p):
        a, x0, y0, sx, sy, th, b = p[:7]
        ct, st = np.cos(th), np.sin(th)
        dx, dy = xx - x0, yy - y0
        u = (dx * ct + dy * st) / sx
        v = (-dx * st + dy * ct) / sy
        r2 = u * u + v * v
        if model == "moffat":
            return a * (1 + r2) ** (-p[7]) + b
        return a * np.exp(-0.5 * r2) + b

    p0 = [amp0, cx, cy, 1.5, 1.5, 0.0, 0.0] + ([2.5] if model == "moffat" else [])
    lo = [0, 0, 0, 0.3, 0.3, -np.pi, -np.inf] + ([1.0] if model == "moffat" else [])
    hi = [np.inf, cut.shape[1], cut.shape[0], cut.shape[1], cut.shape[0], np.pi, np.inf] + ([10.0] if model == "moffat" else [])
    res = least_squares(lambda p: (shape(p) - cut).ravel(), p0, bounds=(lo, hi))
    p = res.x
    if model == "moffat":  # FWHM = 2 * alpha * sqrt(2^(1/beta) - 1)
        k = 2 * np.sqrt(2 ** (1 / p[7]) - 1)
    else:
        k = 2 * np.sqrt(2 * np.log(2))
    fw = sorted([k * p[3], k * p[4]], reverse=True)
    return {"x_fit": p[1], "y_fit": p[2], "amp": p[0], "fwhm_major": fw[0], "fwhm_minor": fw[1],
            "fwhm": float(np.sqrt(fw[0] * fw[1])), "ecc": float(np.sqrt(1 - (fw[1] / fw[0]) ** 2)),
            "beta": float(p[7]) if model == "moffat" else None, "ok": bool(res.success)}


def measure_stars(img: np.ndarray, fwhm_guess: float | None = None, sigma: float = 5.0, max_stars: int = 500,
                  model: str = "gaussian", min_fwhm: float = 1.5):
    """Detect and fit stars. With fwhm_guess=None the detection kernel/cutout size is iterated
    to the measured median FWHM, so it works from wide-field (~2 px) to long focal length (~10+ px).
    Fits narrower than min_fwhm px are dropped as hot pixels / cosmic rays."""
    g = fwhm_guess or 3.0
    for _ in range(1 if fwhm_guess else 5):
        stars, bk = _measure_once(img, g, sigma, max_stars, model, min_fwhm)
        if not stars:
            break
        new = float(np.median([s["fwhm"] for s in stars]))
        if abs(new - g) / g < 0.15:
            break
        g = new
    bk["fwhm_guess_used"] = g
    return stars, bk


def _measure_once(img, fwhm_guess, sigma, max_stars, model, min_fwhm):
    from astropy.stats import SigmaClip
    from photutils.background import Background2D, MedianBackground
    from photutils.detection import DAOStarFinder

    lum = _luminance(img).astype(np.float64)
    bsize = max(16, min(lum.shape) // 16)
    bkg = Background2D(lum, bsize, filter_size=(3, 3), sigma_clip=SigmaClip(sigma=3.0), bkg_estimator=MedianBackground())
    data = lum - bkg.background
    noise = float(np.median(bkg.background_rms))
    finder = DAOStarFinder(threshold=sigma * noise, fwhm=fwhm_guess, n_brightest=max_stars,
                           peak_max=0.95 - float(np.median(bkg.background)), exclude_border=True, min_separation=2 * fwhm_guess)
    table = finder(data)
    half = max(4, int(np.ceil(fwhm_guess * 2.5)))
    stars = []
    for row in table if table is not None else []:
        x, y = int(round(row["x_centroid"])), int(round(row["y_centroid"]))
        if x - half < 0 or y - half < 0 or x + half >= data.shape[1] or y + half >= data.shape[0]:
            continue
        cut = data[y - half: y + half + 1, x - half: x + half + 1]
        try:
            f = _fit_star(cut, model)
        except Exception:
            continue
        if not f["ok"] or f["fwhm"] < min_fwhm or f["fwhm"] > 1.6 * half:
            continue
        f["x"], f["y"] = x - half + f.pop("x_fit"), y - half + f.pop("y_fit")
        f["snr"] = float(f["amp"] / noise)
        stars.append(f)
    return stars, {"background": float(np.median(bkg.background)), "noise": noise}


def pixel_scale(header: dict) -> float | None:
    """arcsec/pixel from XPIXSZ (um, already binned per N.I.N.A./ASIAIR convention) and FOCALLEN (mm)."""
    try:
        return 206.265 * float(header["XPIXSZ"]) / float(header["FOCALLEN"])
    except (KeyError, ValueError, ZeroDivisionError):
        return None


# ---------------------------------------------------------------- starlet wavelets

B3 = np.array([1, 4, 6, 4, 1], dtype=np.float64) / 16.0
# Noise std of each starlet layer for unit-variance white Gaussian noise (Starck & Murtagh).
STARLET_NOISE = [0.8907, 0.2007, 0.0856, 0.0413, 0.0205, 0.0103, 0.0052, 0.0026]


def starlet(plane: np.ndarray, n_layers: int) -> list[np.ndarray]:
    """Isotropic undecimated wavelet transform. Returns [w1..wn, residual]; sum reconstructs the input."""
    from scipy.ndimage import convolve1d
    c = plane.astype(np.float64)
    out = []
    for j in range(n_layers):
        k = np.zeros(4 * 2 ** j + 1)
        k[:: 2 ** j] = B3  # "holes" (a trous)
        s = convolve1d(convolve1d(c, k, axis=0, mode="mirror"), k, axis=1, mode="mirror")
        out.append(c - s)
        c = s
    out.append(c)
    return out


def denoise(img: np.ndarray, layers: dict[int, tuple[float, float]], n_layers: int = 4) -> np.ndarray:
    """layers: {layer_index(1-based): (threshold_in_sigma, amount 0..1)}. Soft-thresholds each chosen layer.

    Mirrors the idea behind PixInsight MultiscaleLinearTransform noise reduction: noise sigma is
    estimated once from layer 1 (MAD) and scaled to each layer by the known starlet noise response.
    """
    n_layers = max(n_layers, max(layers))
    out = np.empty_like(img)
    for i, plane in enumerate(img):
        w = starlet(plane, n_layers)
        sigma = np.median(np.abs(w[0] - np.median(w[0]))) / 0.6745 / STARLET_NOISE[0]
        for j, (k, amount) in layers.items():
            t = k * sigma * STARLET_NOISE[j - 1]
            layer = w[j - 1]
            soft = np.sign(layer) * np.maximum(np.abs(layer) - t, 0.0)
            w[j - 1] = layer + amount * (soft - layer)
        out[i] = np.clip(np.sum(w, axis=0), 0.0, 1.0)
    return out.astype(np.float32)


# ---------------------------------------------------------------- CLI

def _prep(args) -> tuple[np.ndarray, dict]:
    img, hdr = load(args.input)
    pat = getattr(args, "debayer", None)
    if pat == "auto":
        pat = hdr.get("BAYERPAT")
    if pat and img.shape[0] == 1:
        img = debayer_superpixel(img, str(pat).strip())
    return img, hdr


def _maybe_stretch(img, args):
    if getattr(args, "stretch", False) or args.cmd == "stretch":
        if args.shadows is not None or args.midtones is not None:
            params = [(args.shadows or 0.0, args.midtones if args.midtones is not None else 0.5, 1.0)] * img.shape[0]
        else:
            params = auto_stf(img, args.target_bg, args.clip, linked=not args.unlinked)
        print(json.dumps({"stf": [dict(zip(("c0", "m", "c1"), map(float, p))) for p in params]}), file=sys.stderr)
        img = apply_stf(img, params)
    return img


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)

    def common(p, out=True):
        p.add_argument("input")
        if out:
            p.add_argument("output", help=".png .jpg .webp .fits .xisf")
            p.add_argument("--bits", type=int, default=8, choices=(8, 16), help="PNG bit depth")
            p.add_argument("--quality", type=int, default=90, help="JPEG/WebP quality")
        p.add_argument("--debayer", metavar="RGGB|auto", help="superpixel-debayer a CFA frame first")

    def stf_opts(p):
        p.add_argument("--target-bg", type=float, default=0.25, help="auto STF target background (PI default 0.25)")
        p.add_argument("--clip", type=float, default=-2.8, help="auto STF shadows clipping in MADN units (PI default -2.8)")
        p.add_argument("--unlinked", action="store_true", help="stretch channels independently (neutralizes colour casts)")
        p.add_argument("--shadows", type=float, help="manual shadows clip (overrides auto)")
        p.add_argument("--midtones", type=float, help="manual midtones balance (overrides auto)")

    p = sub.add_parser("info", help="print header keys and statistics as JSON"); common(p, out=False)
    p = sub.add_parser("convert", help="convert format; linear unless --stretch"); common(p); stf_opts(p)
    p.add_argument("--stretch", action="store_true")
    p = sub.add_parser("stretch", help="auto STF stretch and save"); common(p); stf_opts(p)
    p = sub.add_parser("stars", help="detect stars and measure FWHM on a LINEAR image"); common(p, out=False)
    p.add_argument("--fwhm-guess", type=float, help="px; default: iterate automatically")
    p.add_argument("--sigma", type=float, default=5.0, help="detection threshold above background noise")
    p.add_argument("--max-stars", type=int, default=500)
    p.add_argument("--model", choices=("gaussian", "moffat"), default="gaussian")
    p.add_argument("--pixscale", type=float, help="arcsec/px (default: from XPIXSZ/FOCALLEN)")
    p.add_argument("--csv", help="write per-star table")
    p.add_argument("--overlay", help="write a stretched image with detected stars circled")
    p = sub.add_parser("denoise", help="starlet wavelet denoise"); common(p)
    p.add_argument("--layers", default="1:3:1,2:2:0.8,3:1:0.5",
                   help="comma list of layer:threshold_sigma:amount (default %(default)s)")
    p.add_argument("--n-layers", type=int, default=4)
    p.add_argument("--dump-layers", metavar="DIR", help="also write each starlet layer as a 16-bit PNG (for illustrations)")
    p.add_argument("--stretch", action="store_true", help="auto-STF the result before saving (use with .png/.jpg)")
    stf_opts(p)

    args = ap.parse_args(argv)
    img, hdr = _prep(args)

    if args.cmd == "info":
        lum = _luminance(img)
        print(json.dumps({"shape_chw": list(img.shape), "header": {k: hdr[k] for k in HEADER_KEYS if k in hdr},
                          "median": float(np.median(lum)), "madn": float(1.4826 * np.median(np.abs(lum - np.median(lum)))),
                          "min": float(lum.min()), "max": float(lum.max()), "arcsec_per_px": pixel_scale(hdr)}, indent=2, default=str))
    elif args.cmd in ("convert", "stretch"):
        save(_maybe_stretch(img, args), args.output, args.bits, args.quality, hdr)
    elif args.cmd == "stars":
        stars, bk = measure_stars(img, args.fwhm_guess, args.sigma, args.max_stars, model=args.model)
        scale = args.pixscale or pixel_scale(hdr)
        fw = np.array([s["fwhm"] for s in stars]) if stars else np.array([np.nan])
        summary = {"n_stars": len(stars), "fwhm_px_median": float(np.median(fw)),
                   "fwhm_arcsec_median": float(np.median(fw) * scale) if scale else None,
                   "ecc_median": float(np.median([s["ecc"] for s in stars])) if stars else None, **bk}
        print(json.dumps(summary, indent=2))
        if args.csv:
            import csv
            with open(args.csv, "w", newline="") as f:
                wr = csv.DictWriter(f, fieldnames=list(stars[0]) if stars else ["x"])
                wr.writeheader(); wr.writerows(stars)
        if args.overlay:
            from PIL import Image, ImageDraw
            vis = apply_stf(img, auto_stf(img))
            rgb = np.moveaxis(np.repeat(vis, 3, 0) if vis.shape[0] == 1 else vis, 0, -1)
            im = Image.fromarray(np.round(rgb * 255).astype(np.uint8))
            d = ImageDraw.Draw(im)
            for s in stars:
                r = 1.5 * s["fwhm"]
                d.ellipse([s["x"] - r, s["y"] - r, s["x"] + r, s["y"] + r], outline=(0, 255, 120))
            Path(args.overlay).parent.mkdir(parents=True, exist_ok=True)
            im.save(args.overlay)
    elif args.cmd == "denoise":
        spec = {}
        for item in args.layers.split(","):
            j, k, a = item.split(":")
            spec[int(j)] = (float(k), float(a))
        out = denoise(img, spec, args.n_layers)
        if args.dump_layers:
            for i, w in enumerate(starlet(_luminance(img), max(args.n_layers, max(spec)))):
                lo, hi = np.percentile(w, [0.5, 99.5])
                save(((w - lo) / max(hi - lo, 1e-12))[None].astype(np.float32), Path(args.dump_layers) / f"layer_{i + 1}.png", 16)
        save(_maybe_stretch(out, args), args.output, args.bits, args.quality, hdr)


if __name__ == "__main__":
    main()
