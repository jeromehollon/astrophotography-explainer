"""Verifies tools/astro.py against synthetic frames with known ground truth. Run: uv run pytest tools"""
import json
import subprocess
import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).parent))
import astro  # noqa: E402

TRUE_FWHM = 3.5
NOISE = 0.004


def synth(h=384, w=384, n=60, seed=1, channels=1):
    """Linear sky: pedestal + Gaussian stars of known FWHM + Gaussian noise, as uint16."""
    rng = np.random.default_rng(seed)
    yy, xx = np.mgrid[:h, :w]
    img = np.full((h, w), 0.05)
    s = TRUE_FWHM / (2 * np.sqrt(2 * np.log(2)))
    for _ in range(n):
        x, y, a = rng.uniform(20, w - 20), rng.uniform(20, h - 20), rng.uniform(0.05, 0.6)
        img += a * np.exp(-((xx - x) ** 2 + (yy - y) ** 2) / (2 * s * s))
    img = np.stack([img] * channels)
    img = img + rng.normal(0, NOISE, img.shape)
    return np.round(np.clip(img, 0, 1) * 65535).astype(np.uint16)


@pytest.fixture(scope="module")
def files(tmp_path_factory):
    from astropy.io import fits
    from xisf import XISF
    d = tmp_path_factory.mktemp("data")
    mono, rgb = synth(), synth(channels=3, seed=2)
    hdr = fits.Header({"XPIXSZ": 3.76, "FOCALLEN": 400.0, "IMAGETYP": "Light Frame"})
    fits.PrimaryHDU(mono, header=hdr).writeto(d / "mono.fits")
    fits.PrimaryHDU(rgb).writeto(d / "rgb.fits")
    XISF.write(str(d / "rgb.xisf"), np.moveaxis(rgb, 0, -1))
    return d, mono, rgb


def test_load_fits_and_xisf_agree(files):
    d, _, rgb = files
    a, hdr = astro.load(d / "rgb.fits")
    b, _ = astro.load(d / "rgb.xisf")
    assert a.shape == b.shape == (3, 384, 384)
    np.testing.assert_allclose(a, b, atol=1e-6)
    np.testing.assert_allclose(a, rgb / 65535, atol=1e-6)


def test_png_bit_depths_are_lossless(files, tmp_path):
    import png
    d, _, rgb = files
    img, _ = astro.load(d / "rgb.xisf")
    for bits in (8, 16):
        astro.save(img, tmp_path / f"o{bits}.png", bits=bits)
        w, h, rows, info = png.Reader(filename=str(tmp_path / f"o{bits}.png")).read()
        arr = np.vstack(list(rows)).reshape(h, w, 3)
        assert info["bitdepth"] == bits
        expect = np.round(np.moveaxis(img, 0, -1) * ((1 << bits) - 1))
        np.testing.assert_array_equal(arr, expect)


def test_jpeg_and_webp(files, tmp_path):
    from PIL import Image
    d, _, _ = files
    img, _ = astro.load(d / "rgb.fits")
    for ext in ("jpg", "webp"):
        astro.save(img, tmp_path / f"o.{ext}", quality=80)
        assert Image.open(tmp_path / f"o.{ext}").size == (384, 384)


def test_mtf_properties():
    x = np.linspace(0, 1, 11)
    y = astro.mtf(0.2, x)
    assert y[0] == 0 and y[-1] == pytest.approx(1)
    assert astro.mtf(0.2, np.array([0.2]))[0] == pytest.approx(0.5)
    assert np.all(np.diff(y) > 0)


def test_auto_stf_puts_background_at_target(files):
    d, _, _ = files
    img, _ = astro.load(d / "mono.fits")
    out = astro.apply_stf(img, astro.auto_stf(img))
    assert np.median(out) == pytest.approx(0.25, abs=0.01)


def test_star_fwhm_recovered(files):
    d, _, _ = files
    img, hdr = astro.load(d / "mono.fits")
    for model in ("gaussian", "moffat"):
        stars, bk = astro.measure_stars(img, fwhm_guess=3.0, model=model)
        assert len(stars) >= 40
        assert np.median([s["fwhm"] for s in stars]) == pytest.approx(TRUE_FWHM, rel=0.08)
    assert bk["noise"] == pytest.approx(NOISE, rel=0.2)
    assert astro.pixel_scale(hdr) == pytest.approx(206.265 * 3.76 / 400)


def test_starlet_reconstructs_and_denoise_reduces_noise(files):
    d, _, _ = files
    img, _ = astro.load(d / "mono.fits")
    layers = astro.starlet(img[0], 5)
    np.testing.assert_allclose(np.sum(layers, axis=0), img[0], atol=1e-6)
    out = astro.denoise(img, {1: (3, 1), 2: (2, 1)})
    sky_in, sky_out = img[0][:15, :15], out[0][:15, :15]
    assert sky_out.std() < 0.6 * sky_in.std()
    assert abs(sky_out.mean() - sky_in.mean()) < 1e-3


def test_cli_end_to_end(files, tmp_path):
    d, _, _ = files
    run = lambda *a: subprocess.run([sys.executable, str(Path(__file__).parent / "astro.py"), *a],
                                    check=True, capture_output=True, text=True)
    info = json.loads(run("info", str(d / "mono.fits")).stdout)
    assert info["header"]["IMAGETYP"] == "Light Frame"
    run("stretch", str(d / "rgb.xisf"), str(tmp_path / "s.png"), "--bits", "16")
    run("convert", str(d / "rgb.fits"), str(tmp_path / "c.jpg"), "--stretch", "--quality", "85")
    stars = json.loads(run("stars", str(d / "mono.fits"), "--overlay", str(tmp_path / "ov.png"), "--csv", str(tmp_path / "s.csv")).stdout)
    assert stars["fwhm_arcsec_median"] == pytest.approx(TRUE_FWHM * 206.265 * 3.76 / 400, rel=0.08)
    run("denoise", str(d / "mono.fits"), str(tmp_path / "dn.xisf"), "--layers", "1:3:1,2:2:0.7", "--dump-layers", str(tmp_path / "L"))
    assert len(list((tmp_path / "L").glob("layer_*.png"))) == 5
    run("convert", str(d / "rgb.fits"), str(tmp_path / "cfa.fits"))
    for f in ("s.png", "c.jpg", "ov.png", "s.csv", "dn.xisf", "cfa.fits"):
        assert (tmp_path / f).stat().st_size > 0


def test_superpixel_debayer():
    cfa = np.zeros((1, 4, 4), np.float32)
    cfa[0, 0::2, 0::2], cfa[0, 0::2, 1::2], cfa[0, 1::2, 0::2], cfa[0, 1::2, 1::2] = 0.9, 0.5, 0.3, 0.1
    rgb = astro.debayer_superpixel(cfa, "RGGB")
    assert rgb.shape == (3, 2, 2)
    np.testing.assert_allclose(rgb[:, 0, 0], [0.9, 0.4, 0.1])
