# Stage-A precompute

One-time precompute over the raw NGC 7331 dataset (see `AGENTS.md` › Data
layout). Outputs are JSON/CSV in `data/derived/precompute/` (git-ignored,
regenerable). Run everything with:

```bash
bash tools/precompute/run_stage_a.sh
```

or step by step, from the repo root, with `uv run tools/precompute/<script>.py`.
Each script reads only `source_images/` and writes only under
`data/derived/precompute/`.

## 1. `frames_manifest.py` -> `frames.json`

One entry per light frame: the 20 raw subs (`f00`..`f19`) plus the 4 synthetic
defect frames (`f11_tracking`, `f14_cloud`, `f15_cloud`, `f16_cloud`). Reads
only header/XML metadata (XISF header block, `.xdrz` alignment XML, FITS
header) - no pixel data is loaded, so it runs in well under a second.

```
{
  "frames": [
    {
      "id": "f03",                 # or "f11_tracking" for a synthetic entry
      "frame_index": 3,
      "kind": "raw" | "synthetic",
      "source": "source_images/light/....xisf",   # repo-relative
      "needs_flipud": false,       # true for synthetic FITS frames (bottom-up rows)
      "defect": "none" | "satellite" | "tracking" | "cloud",
      "relative_of": null,         # synthetic frames point at their raw id, e.g. "f11"
      "pier_side": "West" | "East",
      "date_obs": "...", "exptime": 300.0, "ccd_temp": -3.9,
      "gain": 100, "offset": 160, "width": 6224, "height": 4168,
      "alignment": {
        "reference": "f07",
        "matrix_ref_to_frame": [ ...9 floats, row-major 3x3... ],
        "origin": [0.5, 0.5]
      }
    },
    ...
  ]
}
```

`alignment.matrix_ref_to_frame` maps a point in the reference frame (f07)
to this frame's raw pixel coordinates - see `verify_geometry.py` for the
confirmed convention. Synthetic entries reuse their raw relative's
`alignment` block (the FITS defect frames are geometrically identical to
their raw counterpart, just flipped and with a defect added).

Command: `uv run tools/precompute/frames_manifest.py`

## 2. `verify_geometry.py` -> `geometry_check.json`

Two independent sanity checks on the facts asserted in `AGENTS.md`:

**(a) Matrix direction / pixel-origin convention.** For each raw frame,
finds ~10 bright, unsaturated, isolated stars in its registered (`_r.xisf`)
image, intensity-weight-centroids them, maps each through
`alignment.matrix_ref_to_frame`, and independently centroids the same star
in the raw frame. Reports the median residual (px) for two conventions:

- `direct`: apply the matrix to `(x, y)` as-is.
- `half_pixel`: apply it to `(x+0.5, y+0.5)`, then subtract 0.5 from the result.

**(b) Synthetic flip.** For each synthetic defect frame, confirms that
`np.flipud`-ing it lines its bright stars up with its raw relative (small
residual), and that leaving it un-flipped does not (large residual).

```
{
  "matrix_convention": {
    "per_frame": { "f00": {"n_candidates": 10, "n_used": {...}, "median_residual_px": {"direct": 0.02, "half_pixel": 0.02}}, ... },
    "overall_median_residual_px": {"direct": 0.0199, "half_pixel": 1.412},
    "winner": "direct"
  },
  "synthetic_flip": {
    "f11_tracking": {"median_residual_px_flipped": 0.0, "median_residual_px_unflipped": 3.28, ...},
    ...
  },
  "runtime_s": 102.0
}
```

Command: `uv run tools/precompute/verify_geometry.py`

## 3. `star_metrics.py` -> `stars.json` + `stars/<id>.csv`

Runs `astro.measure_stars(img, model="moffat")` (default auto-iterating FWHM
guess) on the **linear** raw data of all 24 frames (flipping the 4 synthetic
FITS frames with `np.flipud` first, per `frames.json`). Frames are farmed out
to a `ProcessPoolExecutor` (<=6 workers - this is the CPU-bound stage, one
frame per core is enough given 16 cores available).

`stars.json`:

```
{
  "pixel_scale_arcsec_per_px": 0.277,
  "frames": {
    "f00": {
      "id": "f00", "n_stars": 108, "fwhm_px_median": 8.9, "fwhm_arcsec_median": 2.47,
      "ecc_median": 0.46, "background": 0.0167, "noise": 0.00067,
      "fwhm_guess_used_px": 9.2, "runtime_s": 102.7
    },
    ...
  },
  "runtime_s": ...
}
```

`stars/<id>.csv`: one row per detected star with whatever fields
`astro.measure_stars` returns per star (`x`, `y`, `flux`/`amp`, `fwhm`,
`fwhm_major`, `fwhm_minor`, `ecc`, `beta`, `snr`, `ok`).

Command: `uv run tools/precompute/star_metrics.py`

## 4. `histograms.py` -> `histograms.json`

Per-item ADU statistics (16-bit scale, 0-65535) and two histograms, for all
24 lights (`frames.json`) plus `masterBias`, `masterDark_300s`,
`darkFromOlderCamera` and `masterLight_final`. `astro.load()` already
normalizes every input (integer by dtype range, float calibration/master
frames kept as-is) to float32 `[0,1]`, so ADU here is `pixel_value * 65535`.
Parallelized with a `ProcessPoolExecutor` (<=8 workers - this stage is I/O +
numpy-bound, not CPU-fit-bound, so more workers than `star_metrics.py` pay off).

```
{
  "adu_max": 65535.0,
  "saturation_threshold_adu": 65000.0,
  "items": {
    "f00": {
      "id": "f00", "source": "...", "min":.., "max":.., "mean":.., "median":..,
      "madn":.., "p0_1":.., "p99_9":.., "saturated_fraction":..,
      "histogram_full": {"lo": 0.0, "hi": 65536.0, "n": 512, "counts": [...512 ints...]},
      "histogram_zoom": {"lo": .., "hi": .., "n": 256, "counts": [...256 ints...]},
      "runtime_s": ..
    },
    ...
  },
  "runtime_s": ...
}
```

`histogram_zoom` covers `[max(0, median - 10*madn), median + 30*madn]`, i.e.
mostly background with the wide tail toward bright pixels.

Command: `uv run tools/precompute/histograms.py`

---

# Stage-B precompute

WBPP-faithful calibration masters, per-frame normalization statistics, and a
numeric check of flat-field correction. See `docs/knowledge/wbpp.md` for the
method and `SPEC.md` §6 for how the app uses these outputs. Stage A's
`frames.json` must exist first. Run everything with:

```bash
bash tools/precompute/run_stage_b.sh
```

Wall time on 16 cores: masters about 26 min, normalization about 4.5 min,
flat check about 30 s.

## 5. `integrate.py` (library)

Shared numpy helpers, tested in `tools/test_precompute.py`:

- `winsorized_sigma_clip_average(stack, sigma_low=4, sigma_high=3, cutoff=5)`:
  PixInsight's winsorized sigma clipping followed by an average. It runs in
  chunks of 256 rows and is vectorized across pixels.
- `bwmv_scale(x)`: the square root of the biweight midvariance around the
  median (c = 9). It matches `astropy.stats.biweight_midvariance`.
- `trimmed_mean(x, 0.05)`: a two-sided trimmed mean, used for the flat scale `f_v`.

**Deviation from wbpp.md §4.6:** the winsorized clip seeds its initial
spread with `1.4826·MAD` instead of the O(n²) Rousseeuw–Croux Sn estimator.
The effect is negligible for calibration frames, which have almost no
outliers.

## 6. `masters.py` -> `masters/*.fits` + `masters.json`

Float32 FITS in `[0,1]` (multiply by 65535 for DN):

- `darkflat_{10,50,85}`: the raw dark flats averaged, with no normalization
  and winsorized clipping 4/3, cutoff 5.
- `flat_{10,50,85}_{darkflat,bias,none}`: each raw flat is first
  calibrated. `darkflat` subtracts the matching master dark flat, `bias`
  subtracts `masterBias`, and `none` leaves it raw. The flats are then
  averaged with multiplicative normalization (`y_i = x_i·m_0/m_i`) and
  winsorized clipping 4/3.
  - This is a documented simplification of WBPP's automatic linear-fit
    clipping, approved in SPEC §6.7.
  - One 85% flat with a 15 s exposure (the others are 10 s) is dropped
    automatically and logged to stderr.

`masters.json`, keyed by master id:

```
{
  "flat_50_darkflat": {
    "id": "flat_50_darkflat", "kind": "flat" | "darkflat", "level": 50,
    "flat_cal": "darkflat" | "bias" | "none",           # flats only
    "inputs": {"count": 25, "exposure_s": 2.2401, "ccd_temp_range": [1.3, 2.9]},
    "median_dn": .., "mean_dn": .., "min_dn": .., "max_dn": ..,
    "scale_f_v": {"unit_0_1": .., "dn": ..}             # flats only: 5% trimmed mean
  },
  ...
}
```

Command: `uv run tools/precompute/masters.py`

## 7. `normalization.py` -> `normalization.json`

For each of the 24 frames and each of the 30 calibration states, the frame
is calibrated in sensor space. The formula (float32, no truncation, no
pedestal) is:

```
C = (L − D) / (MF_v / f_v)   if a flat is selected
C = L − D                    otherwise
```

Statistics are taken over the frame minus a 64 px border. There are 30
states because light_dark ∈ {none, bias, dark} × flat ∈ {none, 9 masters}.
Bias + dark is identical to dark under WBPP's rules, so it isn't computed
separately. The work is parallelized per frame (≤ 10 workers).

```
{
  "border_px": 64,
  "light_dark_states": ["none", "bias", "dark"],
  "flat_ids": ["flat_10_darkflat", ...],
  "frames": {
    "f07": {
      "id": "f07",
      "states": {
        "dark|flat_50_darkflat": {"median_dn": .., "bwmv_dn": .., "madn_dn": ..},
        ...                                        # 30 keys "<light_dark>|<flat id or none>"
      },
      "runtime_s": ..
    },
    ...
  },
  "runtime_s": ..
}
```

- `median_dn` is the location `m`.
- `bwmv_dn` is the **scale** `s`, i.e. √(biweight midvariance), in DN.
- `madn_dn` is 1.4826·MAD. Together with `median_dn` it feeds the display STF.

Command: `uv run tools/precompute/normalization.py`

## 8. `flat_check.py` -> `flat_check.json`

A numeric check of flat-field correction on f03, used by the Flats lessons.

- **Mote contrast:** the dust mote is located from `flat_50_darkflat` at
  sensor (720, 2337). Contrast is `mean(core r ≤ 25 px) / mean(annulus
  150–220 px) − 1`.
- **Vignetting residual:** the median of the four 300×300 corner boxes
  divided by the median of the central 600×600 box.

Both are reported for `(L − MD)` with no flat and for each of the 9 flat
variants.

```
{
  "mote_center_px": {"x": 720, "y": 2337}, "core_radius_px": 25, "annulus_px": [150, 220],
  "corner_box_px": 300, "centre_box_px": 600, "frame": "f03",
  "variants": {
    "none": {"mote_contrast": -0.048, "core_mean": .., "annulus_mean": ..,
             "vignetting_residual": 0.764, "corner_median": .., "centre_median": ..},
    "flat_50_darkflat": {...}, ...
  }
}
```

Results:
- The 10% and 50% flats remove the mote (within ±0.5%) and the vignetting
  (residual about 0.96).
- The 85% flats change nothing (mote −4.8%, residual 0.77). They are
  saturated at the sensor's full well, about 51k DN.

Command: `uv run tools/precompute/flat_check.py`

---

# Stage-C precompute

The runtime data directory the Fastify server streams (SPEC §4.2/§4.3,
`docs/contracts.md`). Stages A and B must exist first. Run:

```bash
bash tools/precompute/run_stage_c.sh
```

About 4 GB in `data/derived/runtime/` (git-ignored, baked into the Docker
image at `/data`). Wall time is I/O-bound: tens of seconds on a local SSD.

## 9. `runtime.py` -> `runtime/manifest.json` + `runtime/pixels/*`

- `pixels/<id>.b1.u16` for the 24 lights: raw u16 DN exactly as stored in
  the XISF (the 4 synthetic FITS frames are `np.flipud`-ed to raw
  orientation per `frames.json` `needs_flipud`).
- `pixels/<id>.b1.f32` for the 14 masters (`bias`, `dark`, `darkflat_*`,
  `flat_*`): float32 DN. The WBPP masters and the Stage-B FITS are both
  stored in `[0,1]` and are multiplied by 65535.
- `pixels/<id>.b{2,4,8}.f32`: float32 means of `b×b` blocks. The trailing
  partial block is dropped, so a bin-`b` file is `floor(W/b) × floor(H/b)`
  samples (6224×4168 → 3112×2084, 1556×1042, 778×521).
- All files are little-endian, row-major, headerless. Each one is written to
  `<name>.tmp` and renamed, so any file present under its final name is
  complete.
- `manifest.json` follows `docs/contracts.md` exactly: `reference`,
  `pixel_scale_arcsec` and one `assets[<id>]` entry with `kind`, `width`,
  `height`, `dtype`, per-bin `files`, and for lights `pier_side`, `defect`,
  `relative_of`, `H` (= `alignment.matrix_ref_to_frame`), `header`
  (`date_obs`, `exptime`, `ccd_temp`, `gain`, `offset`), `wbpp_weight`
  (`null`: the registered XISF headers carry no weight keyword) and
  `ecc_p90` (90th-percentile star eccentricity from `stars/<id>.csv`).
- `frames.json`, `stars.json`, `histograms.json`, `normalization.json`,
  `masters.json` and `flat_check.json` are copied verbatim.

Lights are submitted to the worker pool before masters. `--only f03,bias`
rebuilds a subset; existing pixel files are kept, so delete one to force a
rewrite. `ASTRO_REPO=<checkout>` reads `source_images/` and `data/` from
another checkout (useful from a git worktree).

Command: `uv run tools/precompute/runtime.py`
