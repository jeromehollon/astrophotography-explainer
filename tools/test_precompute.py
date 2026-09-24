"""Fast pytest checks for tools/precompute/integrate.py. Run: uv run pytest tools"""
import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).parent / "precompute"))
import integrate  # noqa: E402


def test_bwmv_matches_astropy():
    from astropy.stats import biweight_midvariance

    rng = np.random.default_rng(0)
    x = rng.normal(10.0, 2.0, size=5000)
    expected = np.sqrt(biweight_midvariance(x, c=9.0, M=np.median(x)))
    got = integrate.bwmv_scale(x)
    assert got == pytest.approx(expected, rel=1e-6)


def test_bwmv_matches_astropy_with_outliers():
    from astropy.stats import biweight_midvariance

    rng = np.random.default_rng(1)
    x = rng.normal(0.0, 1.0, size=2000)
    x[:20] = 500.0  # gross outliers, should be downweighted to ~0 by the biweight
    expected = np.sqrt(biweight_midvariance(x, c=9.0, M=np.median(x)))
    got = integrate.bwmv_scale(x)
    assert got == pytest.approx(expected, rel=1e-6)


def test_trimmed_mean_matches_scipy():
    from scipy.stats import trim_mean

    rng = np.random.default_rng(2)
    x = rng.normal(5.0, 1.0, size=997)
    expected = trim_mean(x, 0.05)
    got = integrate.trimmed_mean(x, 0.05)
    assert got == pytest.approx(expected, rel=1e-9)


def test_trimmed_mean_drops_extremes():
    x = np.concatenate([[-1000.0], np.full(98, 5.0), [1000.0]])
    # 5% of 100 = 5 dropped each end with floor(); here frac*n=5 -> trims 5 each side
    got = integrate.trimmed_mean(x, 0.05)
    assert got == pytest.approx(5.0, abs=1e-6)


def test_winsorized_clip_average_clean_stack_matches_mean():
    rng = np.random.default_rng(3)
    n, h, w = 20, 8, 8
    stack = 100.0 + rng.normal(0, 1.0, size=(n, h, w))
    out = integrate.winsorized_sigma_clip_average(stack, chunk_rows=4)
    # No outliers: robust average should track the plain mean closely (within a fraction of the noise).
    plain_mean = stack.mean(axis=0)
    assert np.allclose(out, plain_mean, atol=0.5)
    assert out.shape == (h, w)


def test_winsorized_clip_average_rejects_injected_outliers():
    rng = np.random.default_rng(4)
    n, h, w = 20, 6, 6
    stack = 100.0 + rng.normal(0, 1.0, size=(n, h, w)).astype(np.float64)
    truth = stack.copy()
    # Inject one huge outlier per pixel at a different frame index each time.
    outlier_idx = rng.integers(0, n, size=(h, w))
    yy, xx = np.mgrid[0:h, 0:w]
    stack[outlier_idx, yy, xx] = 10000.0
    out = integrate.winsorized_sigma_clip_average(stack, chunk_rows=3)
    clean_mean = np.delete(truth, 0, axis=0).mean(axis=0)  # rough reference: any 19-frame clean mean
    # The rejected-outlier average must sit near the clean population mean, far from
    # what a plain mean (dragged up by the ~10000 outlier) would give.
    assert np.all(out < 150.0)
    assert np.allclose(out, 100.0, atol=2.0)
    plain_mean = stack.mean(axis=0)
    assert np.all(plain_mean > 150.0)  # sanity: the outlier really does dominate a plain average


def test_runtime_block_mean_drops_partial_blocks_and_averages():
    import runtime

    a = np.arange(7 * 9, dtype=np.uint16).reshape(7, 9)
    m2 = runtime.block_mean(a, 2)
    assert m2.dtype == np.float32 and m2.shape == (3, 4)
    assert m2[0, 0] == pytest.approx(a[0:2, 0:2].mean())
    assert m2[2, 3] == pytest.approx(a[4:6, 6:8].mean())
    m8 = runtime.block_mean(np.ones((16, 17), dtype=np.float32) * 3.0, 8)
    assert m8.shape == (2, 2) and np.all(m8 == 3.0)
    assert runtime.block_mean(a, 1).dtype == np.float32
