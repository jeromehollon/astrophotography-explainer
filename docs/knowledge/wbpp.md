# PixInsight WBPP: how the reference pipeline works

This file is local knowledge for implementing agents. It covers how PixInsight's **WeightedBatchPreprocessing (WBPP)** script calibrates, registers, normalizes and integrates, which settings this dataset's masters actually used, and what that means for our in-browser pipeline. The masters in `source_images/` were built with WBPP, and our pipeline replicates it where that's practical.

**Sources, in order of authority:**
1. **WBPP 3.0.1 source**, installed locally at `C:/Program Files/PixInsight/src/scripts/BatchPreprocessing/`. This is the exact version that built our master light. Key files: `BPP-processing.js` (ImageCalibration and ImageIntegration setup), `BPP-CalibrationMatcher.js` (which masters calibrate what), `BPP-FrameGroup.js` (auto rejection), `BPP-global.js` (defaults), `BPP-StackEngine.js` (per-type rejection parameters).
2. **PCL headers**, installed at `C:/Program Files/PixInsight/include/pcl/`: `RobustChauvenetRejection.h`, `WinsorizedSigmaClippingRejection.h`, `LanczosInterpolation.h`, `DrizzleData.h`.
3. **PixInsight reference docs**: ImageCalibration and LocalNormalization are installed locally under `C:/Program Files/PixInsight/doc/tools/`. ImageIntegration is only online, archived at https://web.archive.org/web/20240419123811/https://pixinsight.com/doc/tools/ImageIntegration/ImageIntegration.html (the live URL returns 404).
4. **Bernd Landmann**, *Guide to Preprocessing of Raw Data with PixInsight* (2023): https://sh-cosmiccanvas.s3.us-west-2.amazonaws.com/Resources/20230101_GuideToPreprocessingOfRawDataWithPixInsight.pdf
5. PixInsight 1.8.9 release notes on RCR, PSF weights and the new LN: https://pixinsight.com/forum/index.php?threads/pixinsight-1-8-9-released.18148/ · Image weighting doc: https://pixinsight.com/doc/docs/ImageWeighting/ImageWeighting.html · Maples et al. 2018, *Robust Chauvenet Outlier Rejection*, ApJS 238, 2: https://arxiv.org/abs/1807.05276

**UNVERIFIED** marks anything not confirmed from source code or the recorded headers. The docs render their equations as SVG images, so formulas marked *(reconstructed)* come from the surrounding prose and standard PixInsight practice, not from the equation images themselves.

**Units.** PixInsight works in [0,1]. 16-bit DN = value × 65535. "DN/ADU" below is for our reference only. Prose shown to users says "pixel brightness".

---

## 0. WBPP pipeline order (WBPP 3.0.1)

WBPP runs these steps in order. Items marked *(off)* are disabled by default or don't apply to mono data.

1. Build master bias, master dark, master dark-flat and master flat.
2. Calibrate lights (ImageCalibration). Automatic cosmetic correction runs inside this step.
3. Linear defect correction *(off)*, then CosmeticCorrection process *(off)*, then Debayer *(mono: n/a)*.
4. Measurements: PSF signal and noise estimates, FWHM, eccentricity. Then weights.
5. Frame selection *(off)*, then pick the registration reference frame.
6. Plate solve the reference, then register with StarAlignment (drizzle data generated).
7. Build the LN reference (an integration of the best frames), then run LocalNormalization. This produces `.xnml` files.
8. ImageIntegration, then drizzle *(if enabled)*, then autocrop.

Source: Landmann §10, and the `doCalibrate`/integration code in `BPP-processing.js`.

---

## 1. Master calibration frames

### 1.1 Bias and dark masters

WBPP integrates the raw frames with **no pre-calibration**. The master dark is *not* bias-subtracted, so it contains the bias pedestal. WBPP 2.5.0 removed compatibility with pre-calibrated master darks: the code comment reads `IC.calibrateDark = engine.overscan.enabled || masterBiasEnabled; // compatibility with pre-calibrated master dark has been removed`.

The ImageIntegration settings for bias and dark (`BPP-processing.js`, `default:` branch) are:
- `combination = Average`
- `normalization = NoNormalization`
- `rejectionNormalization = NoRejectionNormalization`
- `weightMode = DontCare` (all weights = 1)
- `rangeClipLow/High = false`
- Rejection: auto (§4.7). **Bias and darks always use Winsorized σ-clipping** when there are 6 or more frames, whatever the count. Parameters are σ low 4, σ high 3, and Winsorization cutoff 5.

### 1.2 Flats and dark-flats

A master dark-flat is just a master dark built at the flat's exposure (the Dark image type), so it gets the §1.1 settings.

`BPP-CalibrationMatcher.getCalibrationGroupsFor()` decides how each flat frame is calibrated:
- WBPP looks up a master bias `mb` and a master dark `md` matching the flat's exposure. When `mb` exists, an exact exposure match is required.
- **The bias is dropped whenever a master dark (here, the dark-flat) is present and not optimized** (`optimizeDarks` defaults to `false`).

So each flat is calibrated as:
```
F_cal = F − MDF      if a matching dark-flat exists
F_cal = F − MB       else if a master bias exists
F_cal = F            else (uncalibrated flats → vignetting UNDER-corrected later)
```
`IC.calibrateFlat = false` because each flat frame was already calibrated before integration.

The master-flat integration settings (`case ImageType.Flat`) are:
- `combination = Average`
- `normalization = Multiplicative` (output)
- `rejectionNormalization = EqualizeFluxes`
- `weightMode = DontCare`
- no range rejection
- large-scale rejection off
- Rejection: auto. With 25 flats that gives **Linear Fit clipping** (low 5, high 3.5), because n > 15 and the frames are not the bias or dark type.

The normalization formulas *(reconstructed; the doc gives these in prose)*, where `m` is the median of each whole frame and `0` is the reference (first) frame:
- Multiplicative output: `y_i = x_i · m_0 / m_i`
- Equalize fluxes (rejection): the same multiplicative form, used only when deciding which pixels to reject.

### 1.3 Dark optimization (off by default; described for completeness)

`BPP.Defaults.optimizeDarks = false`. When it's enabled, ImageCalibration computes a factor `k` per frame by minimizing noise (a k-σ noise estimate) of the calibrated frame:
```
Cal = ((L − MB) − k·(MD − MB)) / MF · f
```
It is only relevant for cameras without cooling or with mismatched exposures. Amp glow often fails to calibrate out with it. Sources: IC doc §1.6 and Landmann §7.2.

---

## 2. Light calibration (ImageCalibration as WBPP configures it)

### 2.1 Which masters apply

`getCalibrationGroupsFor()`, with the code comment verbatim: *"MasterBias is needed only when: 1. master dark is NOT present 2. master dark is present and optimized."* So **with dark optimization off (the default), the master bias is not used on lights whenever a master dark is present.**

| User has | WBPP light formula | Notes |
|---|---|---|
| dark + flat (± bias) | `C = (L − MD) / (MF / f)` | Canonical case. Bias is ignored because MD already contains it. |
| dark only (± bias) | `C = L − MD` | |
| bias + flat | `C = (L − MB) / (MF / f)` | Hot pixels and amp glow remain. |
| bias only | `C = L − MB` | |
| flat only | `C = L / (MF / f)` | Pedestal not removed, so the flat **over**-corrects (inverse vignetting). Landmann §8.2. |
| nothing | `C = L` | WBPP warns and skips calibration. |

Here `f` is the **master-flat scaling factor**, a robust mean of the master flat. It's a two-sided symmetric trimmed mean that drops 5% at each end (`IC.flatScaleClippingFactor = 0.05`; IC doc "Scale clipping factor"). Dividing by `MF/f` leaves the light's mean level unchanged. For CFA data WBPP uses separate CFA factors; that doesn't apply to our mono data.

### 2.2 Output pedestal and truncation

- `pedestalMode = Auto` and `pedestalLimit = 0.0001`. If more than 0.01% of a calibrated frame's pixels are ≤ 0, IC adds a robust positive pedestal and writes the `PEDESTAL` keyword. Otherwise no pedestal is added. Our lights sit about 720 DN above the dark, so the pedestal is normally 0 (UNVERIFIED per frame).
- IC truncates its output to [0,1] as the final step. `outputSampleFormat` is f32.

### 2.3 Automatic cosmetic correction (on by default)

`BPP.Defaults.ccEnabled = true` and `ccHighSigma = 10`. These map to `IC.cosmeticCorrectionHigh` and `IC.cosmeticHighSigma` in ImageCalibration. The tooltip says it *"detects pixels with abnormally high or low values in the master dark frame using multiscale and statistical analysis"*, flagging pixels more than 10σ above the median of a high-pass filtered master dark. Those pixels are *"replaced with plausible values calculated from their local neighborhoods"*.

It requires a master dark whose exposure is within 15 s of the light's. The separate CosmeticCorrection process is off (`cosmeticCorrection: false`). Whether the user's WBPP run had auto-CC enabled isn't recorded in the master light (UNVERIFIED).

---

## 3. Measurement, weighting, registration

### 3.1 Subframe weights

- Weighting is on by default. The WBPP default method is **PSF Signal Weight (PSFSW)**. The alternatives are PSF SNR, PSF Scale SNR, SNR estimate, or a custom formula written to a CSV file.
- WBPP writes weights to the `WBPPWGHT` keyword. ImageIntegration then uses `weightScale = BWMV` and `minWeight = 0.05`.
- **PSFSW** combines total PSF flux (`TFlux`) and mean PSF flux (`TMeanFlux`), from hybrid PSF/aperture photometry of detected stars, with noise `N*` and background `M*`, normalized by constants α and β. **PSF SNR** is a ratio-of-powers form built from the same flux terms and `N*²`.
- The exact equations are SVG images (ImageWeighting doc eq. 16 and 18), so they are **UNVERIFIED** here.
- Combination: `weighted average = Σ w_i·y_i / Σ w_i` over non-rejected pixels. Weights are relative to the reference image, which has weight 1 by convention (II doc).

### 3.2 Registration (StarAlignment)

WBPP defaults: `saPixelInterpolation = Auto`, `saClampingThreshold = 0.3`, `saDistortionCorrection = false` (a projective, 8-parameter homography), plate solving on, and drizzle data generated.
- **Auto interpolation** selects Lanczos-3 for same-scale registration (https://pixinsight.com/doc/docs/InterpolationAlgorithms/InterpolationAlgorithms.html). Cubic filters (Mitchell–Netravali) are for strong downsampling only.
- **Lanczos-3 with clamping** (`LanczosInterpolation.h`) works as follows:
  - Kernel: `L(t) = sinc(t)·sinc(t/3)` for |t| < 3.
  - It uses a 6×6 neighbourhood. For a sample position `(x,y)`, `x0 = floor(x)`, `dx = x − x0` (same for y), and taps run over `x0−2 … x0+3`.
  - Each tap contributes `s = v·w`, with separable weight `w = L(j − dx)·L(i − dy)`. Positive `s` accumulates into `sp, wp`; negative `s` into `sn += −s, wn += −w`.
  - Clamping: `r = sn/sp`. If `r ≥ 1`, return `sp/wp`. If `r > 0.3`, then `c = 1 − ((r − 0.3)/0.7)²` and `sn *= c, wn *= c`.
  - Result: `(sp − sn)/(wp − wn)`.
  - Border taps mirror the image (`f[−x]`, `f[2W−2−x]`).
- StarAlignment sets output pixels that map outside the source to **0**. Integration later discards them through range rejection (§4.8).

### 3.3 `.xdrz` alignment data: coordinate convention (verified)

- `AlignmentMatrix` holds 9 numbers, row-major, forming the homography `H`. For an output pixel `(u,v)`: `[x',y',w]ᵀ = H·[u,v,1]ᵀ`, then `x = x'/w`, `y = y'/w`.
- **`H` maps reference-frame coordinates to raw-frame coordinates.** That's the inverse-warp direction: for each output pixel, it gives the position to sample in the raw frame.
  - Reference frame: `FRAME_0007` (its matrix is the identity).
  - Empirical check: frame 3 has `dx = −26.3`, and a star at raw x = 3056 appears at registered x = 3084.
- `AlignmentOrigin = {0.5,0.5}`. From `DrizzleData.h`: *"corresponds to image coordinates {0,0} in the coordinate system used for image registration… the center of the top-left pixel."* So in registration coordinates, pixel `(i,j)` has its centre at `(i,j)`. That matches PCL interpolation's `x0 = floor(x)` convention, so `x` and `y` feed the Lanczos sampler directly, with no ±0.5 shift. Row 0 is the top row (XISF order).
- To use another reference `r`, sample raw frame `i` at `H_i · H_r⁻¹ · p`, where `p` is a pixel in r's raw grid.
- **2×2 binned grids:** binned index `b` has its centre at native `2b + 0.5`. With `S = [[2,0,0.5],[0,2,0.5],[0,0,1]]`, use `H_bin(i←r) = S⁻¹ · H_i · H_r⁻¹ · S`.

---

## 4. Integration (ImageIntegration) — what WBPP sets for lights

### 4.1 Light settings (WBPP 3.0.1 code, `case ImageType.Light`)

- `combination = Average`
- `weightMode = PSFSignalWeight` (default)
- `weightScale = BWMV`
- `minWeight = 0.05`
- Without LN: `normalization = AdditiveWithScaling` and `rejectionNormalization = Scale` ("scaling + zero offset").
- With LN (**WBPP's default**, `localnormalization: true`): both normalizations switch to `LocalNormalization` and `LocalRejectionNormalization`, and `subtractPedestals = false`.
- `clipLow = clipHigh = true`
- `rangeClipLow = true`, `rangeLow = 0`, `rangeClipHigh = false`
- `truncateOnOutOfRange = false`
- `largeScaleClipLow/High = false`
- `winsorizationCutoff = 5`
- Auto rejection (§4.7).

### 4.2 Location and scale estimators

- **Location:** `m` = median of the whole image. The exception is the IKSS scale estimator, which uses the IKSS location instead.
- **Scale (WBPP: BWMV):** `s` = √(biweight midvariance), computed around the median `M`:
  ```
  y_k = (x_k − M) / (9·MAD);   a_k = 1 if |y_k| < 1 else 0
  BWMV = n · Σ a_k (x_k − M)² (1 − y_k²)⁴  /  ( Σ a_k (1 − y_k²)(1 − 5y_k²) )²
  s = sqrt(BWMV)
  ```
  This is Wilcox §3.12, as quoted in the II doc. MAD is the raw median absolute deviation.

### 4.3 Global normalization formulas *(reconstructed)*

Here `0` is the reference image. In ImageIntegration that's the first input image by convention (II doc).
- **Scaling factor:** `k_i = s_0 / s_i`
- **Scale + zero offset** (rejection normalization): `y_i = (x_i − m_i)·k_i + m_0`
- **Additive:** `y_i = x_i − m_i + m_0`
- **Multiplicative:** `y_i = x_i · m_0/m_i`
- **Additive with scaling** (output): `y_i = (x_i − m_i)·k_i + m_0`, the same as scale + zero offset.
- **Multiplicative with scaling:** `y_i = x_i · k_i · m_0/m_i`

So for lights without LN, **one normalized stack serves both rejection and combination**.

### 4.4 Local normalization (WBPP default; we do not replicate it)

- Per-pixel form: `y = k(x,y)·(x − b_i(x,y)) + b_0(x,y)`. The `b` terms are local background models and `k` is a local scale.
- WBPP settings:
  - Method: PSF flux photometry (`localnormalizationMethod = PSFFlux`).
  - `scale = min(W,H)/gridSize`, with gridSize 4. That's about 1042 px here; LN supports discrete scales from 32 to 8192 (UNVERIFIED how it rounds).
  - LN reference: an integration of the best frames (up to 20) by PSFSW. Low and high clipping levels are 4.5e-5 and 0.85.
  - Reference rejection 3.0, target rejection 3.2.
- LN tracks time-varying gradients and partly normalizes clouds. Sources: `BPP-processing.js` around line 540, LN doc §1–3.

### 4.5 Combination

- **Average:** `Σ w·y / Σ w` over the surviving pixels.
- **Median:** the median of the surviving pixels. It gives about 20% lower SNR than the average for the same frames (II doc: the standard error of the median is √(π/2)≈1.25× that of the mean). Its value is implicit robustness to outliers.

### 4.6 Rejection algorithms (per pixel stack, on normalized values)

The PixInsight defaults are the ones WBPP sets (`BPP-StackEngine.js`). Every iterative method stops when nothing more is rejected or fewer than 3 pixels remain.

- **Min/max** (context only): drop the `n_low` smallest and `n_high` largest values. It costs signal unconditionally. Not for production.
  - *Plain:* always throw away the brightest and darkest few.
- **Percentile clipping** (default p_low 0.2, p_high 0.1). A single pass: with `m` the stack median, reject `x` when `(m − x)/m > p_low` or `(x − m)/m > p_high` *(reconstructed)*. Use it for 3–6 frames.
  - *Plain:* throw away anything more than a fixed percentage darker or brighter than the middle value.
- **Sigma (kappa-sigma) clipping** (defaults σ_low 4, σ_high 3). Iterate:
  1. `m` = median, `σ` = standard deviation of the current stack.
  2. Reject `x` when `(m − x)/σ > σ_low` or `(x − m)/σ > σ_high`.
  3. Repeat.

  WBPP flags it outside 8–15 frames.
  - *Plain:* find the middle value and how spread out the values normally are (the standard deviation), throw away anything too many spreads away, and repeat.
- **Winsorized sigma clipping** (σ_low 4, σ_high 3, cutoff 5). This follows PCL `WinsorizedSigmaClippingRejection`. The II doc describes the same Huber scheme with 1.5, 1.134 and 0.0005; that II calls this exact class is UNVERIFIED. On the sorted stack, iterate:
  1. Get robust parameters from a copy `v`:
     - Start with `m = median(v)` and `σ = 1.1926·Sn(v)`. Sn is Rousseeuw–Croux: `lomed_i himed_j |x_i − x_j|`.
     - Huber loop:
       - Set `t0 = m − 1.5σ` and `t1 = m + 1.5σ`.
       - On the **first outer iteration only** (the cutoff): values beyond `m ± 5σ` are replaced by `m`, and values between `t` and the cutoff are clamped to `t0`/`t1`. On later iterations, simply clamp to `[t0,t1]`.
       - Update `σ = 1.134·stddev(v)` and `m = mean(v)`.
       - Stop when `|Δσ|/σ < 0.0005`, and only after at least 2 passes.
  2. Reject from the low end while `(m − x)/σ > σ_low` and from the high end while `(x − m)/σ > σ_high`.
  3. Repeat until no rejection.

  WBPP needs at least 8 frames; the II doc calls it excellent from 15 frames up.
  - *Plain:* before measuring the spread, pull wild values in to the edge of the normal range so a single satellite trail can't inflate the spread. Then reject as in kappa-sigma.
- **Averaged sigma clipping** (context only): IRAF AVSIGCLIP. It estimates σ from a Poisson gain model, for 10 or more frames.
- **Linear fit clipping** (low 5, high 3.5, in average-absolute-deviation units). Fit a straight line to the *sorted* stack, minimizing average absolute deviation and maximizing inliers, then reject points far from the line. It is robust to gradients that vary from frame to frame. Best with 15–25 or more frames. **This is what the dataset's master light used** (§5).
  - *Plain:* line the values up from smallest to largest, draw the best straight line through them, and throw away points that sit far from the line.
- **Generalized ESD** (context only; outliers fraction 0.3, significance 0.05, low relaxation 1). This is Rosner's many-outlier test assuming a normal distribution. It tests the most extreme value repeatedly, up to 30% of the stack, and avoids masking. Good from 15 frames, and workable at 8–10.
  - *Plain:* keep asking "is the most extreme value too extreme to be chance?" until the answer is no.
- **Robust Chauvenet Rejection (RCR)**. WBPP sets the limit to **0.1**; the PCL default is 0.5, which is the classic Chauvenet criterion. Taken verbatim from `RobustChauvenetRejection.h`:
  ```
  sort(data); i=0; j=N
  for phase in 0,1,2:
    loop:
      phase0: mean = median(data[i:j]); sigma = LineFitDeviation(...)
      phase1: mean = median(data[i:j]); sigma = SampleDeviation(...)
      phase2: mean = mean(data[i:j]);   sigma = stddev(data[i:j])
      if 1+sigma == 1 or (j−i) < 3: return
      n = j − i
      d0 = n·Q((mean − data[i])/sigma);  d1 = n·Q((data[j−1] − mean)/sigma)
      if d0 >= limit and d1 >= limit: break        # both extremes plausible → next phase
      if d1 < d0: j −= 1 else: i += 1               # reject ONE most-improbable extreme
  Q(z)   = 0.5·(1 − erf(z/√2))                       # one-sided normal tail probability
  FN(N)  = 1 / (1 − 2.9442·N^(−1.073))               # small-sample correction
  SampleDeviation  = FN(N) · (the ⌊0.683·N⌋-th smallest |x − mean|)
  LineFitDeviation = if n' = int(0.683·N + 0.317) < 8: SampleDeviation
                     else: y = first n' of sorted |x − mean|;  x_k = √2·erfinv((k+1−0.317)/N), k=0..n'−1
                           least-squares line y≈a+bx;  return FN(N)·(a + b·1)
  ```
  For N > 30000, bulk rejection kicks in. It never applies to our stacks of 24 or fewer. WBPP asks for at least 15 frames.
  - *Plain:* with this many frames, would a value this far from the middle be expected to turn up even once by chance? If not, remove the single most unlikely value and ask again. The questions get more precise over three rounds.

### 4.7 WBPP auto rejection (`FrameGroup.bestRejectionMethod()`, verbatim logic)

```
n < 6                                   → Percentile clipping
n ≤ 15  OR  type is Bias or Dark         → Winsorized sigma clipping
otherwise                               → Linear fit clipping
```

WBPP's validity warnings (`BPP-FrameGroup.js` ~line 1276):
- Percentile clipping: n ≤ 8.
- Sigma clipping: 8 ≤ n ≤ 15.
- Winsorized sigma clipping: n ≥ 8.
- Averaged sigma clipping: 8–10.
- Linear fit clipping: n ≥ 20.
- ESD: n ≥ 25 is best.
- RCR: n ≥ 15.

This gives our frame-count guidance for the Algorithms page.

### 4.8 Range rejection and out-of-frame pixels

`rangeClipLow` rejects every pixel **≤ rangeLow (0)** before the statistical rejection runs. That's how the black borders left by registration, and pixels truncated to zero, are excluded. Clip high (≥ 0.98) is available but off for lights.

### 4.9 Large-scale rejection (off by default)

When enabled, it grows rejected regions using multiscale structure: protected layers 2, growth 2. It is meant for big artifacts such as plane and satellite trails and cloud edges. The exact algorithm is UNVERIFIED.

### 4.10 Autocrop (WBPP default on)

It builds the low-rejection map, which is the fraction of frames rejected low at each pixel, and so marks where registration left borders. It then finds the largest axis-aligned rectangle where the map is ≤ 0.25 (`TOLERANCE = 0.25` in `getAutocropRegion`) and stores it in `WBPPCROP`.

---

## 5. What this dataset's masters recorded (header XML → `PixInsight:ProcessingHistory`)

| Master | Built by | Inputs | Integration settings |
|---|---|---|---|
| **Bias** `masterBias_BIN-1_6224x4168.xisf` | WBPP 2.8.8, 2025-06-27 | 100 raw bias frames, dark library 2025-03-07, gain 100, −11.9…−7.6 °C | Average; NoNormalization; **Winsorized σ-clip 4/3, cutoff 5**; DontCare weights; no range clip |
| **Dark** `masterDark_…_EXPOSURE-300.00s.xisf` | WBPP 2.8.8, 2025-06-27 | **Raw** 300 s darks (12 listed, `numberOfImages = 11`), gain 100, **−14.9/−15.0 °C**, not bias-subtracted | Average; NoNormalization; **Winsorized σ-clip 4/3, cutoff 5**; DontCare |
| **Light** `masterLight_…_autocrop.xisf` | **WBPP 3.0.1**, 2026-09-18 | All 20 frames `…_c_2_r.xisf` (calibrated `_c`, registered `_r`; the `_2` is UNVERIFIED), `.xnml` and `.xdrz` | Average; **weightMode PSFSNR** (user changed the PSFSW default), `WBPPWGHT`, BWMV, minWeight 0.05; **LocalNormalization** (output and rejection); **Linear fit clipping 5/3.5** (auto, n = 20); clipLow/High on; rangeClipLow ≤ 0 on; large-scale off; drizzle data on; Moffat4 PSF |

- **Master light results:**
  - Rejected low: 7,422,087 pixels (1.43% of 518.8 M), which includes the range-rejected borders.
  - Rejected high: 2,227,887 (0.43%).
  - Autocrop `WBPPCROP = (116,61)x(6210,4153)`, giving 6094×4092.
  - Final MRS noise 1.268e-4, about 8.3 DN.
  - Final location 9.53e-3, about 625 DN.
- **Which bias, dark and flat calibrated the `_c` lights isn't recorded** in the master light (UNVERIFIED). Given WBPP's rules, the bias was not applied to lights if this master dark was used.
- **The dark is 11 °C colder than the lights** (−15 °C vs −4 °C). Dark current grows with temperature, so the dark under-represents the lights' dark signal. On this sensor at 300 s the absolute amount is tiny: the master dark's median is 161 DN against the bias's 160.5. The mismatch mostly shows up as under-corrected hot pixels. The user has accepted this for teaching.
- **Recorded WBPP weights** (PSFSNR, normalized so the maximum is 1), by frame:
  - 0000–0003: .500 .503 .480 .525
  - 0004–0007: .703 .685 .560 .742
  - 0008–0011: .628 .845 .923 .914
  - 0012–0015: .787 .770 **1.000** .879
  - 0016–0019: .245 .322 .425 .400

  The late frames 16–19 have the lowest weights and also the highest high-rejection counts (531 k for frame 16).

---

## 6. Implications for our browser pipeline

### 6.1 Stage order (exact)

For each selected frame `i`, over the sensor-space rectangle that the ROI (or tile) needs:

1. **Load** the raw light crop in DN. Synthetic FITS frames must be `flipud` first; see AGENTS.md.
2. **Calibrate in sensor space**, following WBPP's master-selection rules (§2.1):
   ```
   D = MD            if dark ON
       MB            else if bias ON
       0             else
   C = (L − D) / (MF_v / f_v)      if flat ON  (MF_v = chosen master-flat variant, f_v its 5%-trimmed mean)
   C = (L − D)                     otherwise
   ```
   Keep the result as float32. Don't truncate and don't add a pedestal (§6.3).
3. **Register:** inverse-warp into the output grid with `H_i·H_r⁻¹`, using the binned form `S⁻¹·…·S` for 2×2 ROIs (§3.3). Sample with Lanczos-3 and clamping 0.3. Output pixels whose source position falls outside `[0,W−1]×[0,H−1]` become **NaN**.
4. **Normalize** with precomputed, reference-relative scale + zero offset: `y = (C − m_i)·(s_r/s_i) + m_r`. The same values feed both rejection and combination (§4.3).
5. **Reject** per pixel over the non-NaN values. NaN plays the role of WBPP's range rejection of ≤ 0. Use the §4.6 algorithms with WBPP defaults:
   - kappa-σ 4/3
   - winsorized 4/3, cutoff 5
   - RCR limit 0.1
   - percentile 0.2/0.1, if we expose it for small stacks
6. **Combine:** equal-weight average or median of the survivors (§6.3 explains why weights are off). If all values are NaN or rejected, output NaN.
7. **No autocrop.** Display NaN as the background colour.

### 6.2 Replicated exactly

- The master selection logic (the bias drops out when a dark is present).
- The calibration formula and the 5%-trimmed-mean flat scale.
- The master dark and master bias themselves, which are WBPP-built.
- Master-flat construction per §1.2.
- StarAlignment's actual matrices and Lanczos-3 with clamping.
- Median/BWMV estimators and the scale + zero offset / additive-with-scaling normalization.
- The RCR, Winsorized and σ-clip algorithms and their defaults.
- Range rejection of out-of-frame pixels.

### 6.3 Simplified, with justification

- **Local normalization → global.** LN needs PSF photometry and multiscale background models per frame, and it's too heavy to justify in the browser. Global scale + zero offset is exactly what WBPP does when LN is off. All frames come from one night on one target.
  - *Caveat:* LN would partly normalize cloud frames 14–16. With global normalization the clouds stay as structures, which is better for teaching rejection.
- **Weights off (DontCare).** The dataset's master used PSFSNR weights. PSF photometry in the browser is out of scope, and equal weights keep the average vs. median vs. rejection comparison clean.
  - Keep the recorded WBPP weights (§5) in the frame manifest so they can be displayed.
  - Weights could be re-enabled later from precomputed values. The synthetic frames would need a proxy weight from our star metrics, such as total star flux over noise².
- **No pedestal or truncation.** Floats avoid clipping. For our lights at about 720 DN above the dark, WBPP's auto-pedestal would be 0 in practice, so the results are the same except for a handful of clipped pixels.
- **Auto cosmetic correction skipped.** Hot pixels are a lesson topic, and dithered stacks with rejection remove them, which is itself the teaching point. Optional later: a precomputed hot-pixel mask (> 10σ above the median of a high-pass filtered master dark) replaced with a 3×3 median.
- **Master flats use Winsorized instead of Linear-fit clipping.** WBPP's auto rule picks Linear fit for 25 flats, but panel flats have essentially no outliers, so the difference is negligible. Implement Linear fit in the precompute only if time allows.
- **Linear fit clipping and ESD in the browser:** not in the MVP algorithm list. RCR and Winsorized cover robust rejection. Mention Linear fit on the Algorithms page as "what the author's own master used".
- **Normalization stats:** computed on the calibrated frame in sensor space, excluding a border of about 64 px, rather than on the registered frame. The median and BWMV are robust to the edge difference.

### 6.4 Precompute this implies (Python, `tools/`)

1. **Master dark-flats ×3** (10%, 50% and 85% exposures): average, no normalization, Winsorized 4/3 with cutoff 5.
2. **Master flats ×9**, one per exposure {10,50,85} × calibration {`−MDF`, `−MB`, none}:
   - Per-flat calibration as in §1.2.
   - Integration: average, multiplicative normalization (median), equalize-fluxes rejection normalization, rejection per §6.3.
   - Store each master with its **scale `f_v`** (5% two-sided trimmed mean).
3. **Normalization stats.** Stats are needed for every frame (24 = 20 raw + 4 flipped synthetic) × every effective light-calibration state.
   - The states: **{none, bias, dark} × {no flat, 9 flat variants} = 30**. Bias + dark is identical to dark, per WBPP.
   - For each combination, store the median `m` and the BWMV scale `s` of `C`, in DN, over the sensor area minus a 64 px border.
   - That's 720 (m, s) pairs.
   - STF display parameters for any reference and calibration state then come straight from these numbers: median plus MADN, or keep MADN too.
4. The per-frame **alignment matrices** (already in `.xdrz`) and their inverses.
5. The **recorded WBPP weights** and rejection counts per frame (§5), for display only.
6. *(Optional)* A hot-pixel mask from the master dark (> 10σ above the median of a high-pass filtered master dark), if we later emulate auto-CC.
