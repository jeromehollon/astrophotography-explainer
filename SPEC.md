# SPEC: Stacking Explainer (hackathon POC)

This is the source of truth for what we build and how agents build it. `AGENTS.md` covers repo conventions and tooling. `docs/knowledge/wbpp.md` covers the PixInsight WBPP pipeline that we replicate. When the three disagree, this file wins; fix the other two.

Status: **v1, approved 2026-09-24**. The spec is re-evaluated after Figma (phase 3). Decisions made with the product owner are logged in §12.

---

## 1. Product

An interactive, desktop-only lesson followed by a workbench. It teaches beginners how to choose **calibration frames** (bias, darks, flats, dark flats) and **light frames**, and how **stacking algorithms** deal with outliers. Everything runs on real data from **Stella Venator Observatory** (Lexington, Kentucky): NGC 7331, EdgeHD 11 at 2800 mm, AP26MC, Red filter, 20 × 300 s.

Contest theme 1, *Exploration & Understanding*. The judges score execution and polish, depth of knowledge, and creativity. One flow done well beats breadth.

**Teaching method (Park Tool style).** Every lesson step follows the same loop: explain the concept briefly → show a real problem in the data → the learner adjusts controls until the problem goes away → they can bring it back and fix it again. Every step has an interactive element with a tight feedback loop.

**Voice.** The prose sits between a textbook and an expert who is excited to share. Avoid short, pithy declarative sentences. The product owner edits all prose in Figma. See the plain-language rules in §9.

## 2. Scope

**In**
- Lesson pages: Welcome, Noise & Defects, Calibration (Bias, Darks, Flats, Flats–Continued), Alignment, Algorithms, Light Frames.
- Workbench: calibration choices, then frame selection with precomputed metrics, then algorithm and parameters, then reference frame, 4 fixed ROIs that update live, full-image stack on demand, and FITS/PNG export.
- Five scenario presets: Default, Naive, Satellite Trail Challenge, Cloud Challenge, Tracking Error Challenge.
- Pixel combination: average, median, kappa-sigma clipping, winsorized sigma clipping, robust Chauvenet rejection (RCR).
- Calibration in WBPP order, with every flat variant precomputed.
- One Docker container: a Node server that serves the SPA plus **one** ROI API endpoint.

**Out (cutting floor):** mobile, touch, Safari, accessibility, auth, persistence across refreshes, drizzle, colour or debayering, user-movable ROIs, computing registration ourselves (we use PixInsight's matrices), sky flats, and flat exposures other than the 10/50/85% sets. Also out, as approved deviations from WBPP (§6.7): local normalization, cosmetic correction, subframe weighting, autocrop.

## 3. Dataset

| Asset | Details |
|---|---|
| Lights | `source_images/light/*FRAME_00NN*.xisf`, NN = 00–19. 6224×4168 UInt16 mono, 300 s, gain 100, offset 160, about −4 °C. Frames 00–07 were shot with the telescope on the **West** side of the pier, 08–19 on the **East** side. The meridian flip rotates the image about 180°. |
| Defects | f03: real **satellite trail** (faint, lower right). f11: synthetic **tracking error** (trailed stars). f14–f16: synthetic **patchy cloud**. |
| Synthetic files | `source_images/light_synthetic_disaster/*.fits`. These are **vertically flipped** relative to the raw XISF (FITS stores rows bottom-up). Flip them once at conversion time. They use the alignment matrix of their untouched raw frame. |
| Registration | `light_registered/*_r.xdrz` `AlignmentMatrix` is a 3×3 homography that maps **reference coordinates (f07) → raw-frame coordinates**. The `_r.xisf` files are registered but **not calibrated**. We use them only as a test oracle for our warp. |
| Masters (from WBPP) | `masterBias` and `masterDark` (300 s) are Float32 in [0,1]; multiply by 65535 to get ADU. The master dark **includes the bias pedestal** (median ≈ 161 vs 160.5), so dark current is negligible and the dark mainly carries hot pixels. |
| Flats | Raw flats at 10% (0.11 s), 50% (2.24 s) and 85% (10 s) histogram levels, 25 each, plus matching dark flats. One 85% frame had a 15 s exposure and is excluded automatically. Measured on f03 (`flat_check.json`):
- With no flat, the dust mote at sensor (720, 2337) is 4.8% dark and the corners are 24% darker than the centre.
- The 10% and 50% flats remove both: the mote comes within ±0.5%, and the corners within 4%.
- The **85% flats are saturated at the sensor's full well**, about 51k DN, well below 65,535. A raw 85% flat measures 1.007 centre/corner against 1.245 at 50%, so it corrects nothing: the mote stays at 4.8%. |
| Old-camera dark | `darkFromOlderCamera.fits`: ASI294MM Pro, 8288×5644, 600 s. **Display only** (amp-glow example). Never applied. |
| Final | `final/masterLight_*.xisf` (WBPP master, 6094×4092 autocrop) and `final/NGC7331.png` (colour composite). Used on the Welcome page. |

Pixel scale 0.277″/px. Registration offsets within one pier side are up to about 47 px (f02/f03 vs f05).

**Frame list.** In the workbench and the Light Frames lesson, learners see **all 24 entries**: the 20 raw frames plus the 4 synthetic defect variants (f11_tracking, f14_cloud, f15_cloud, f16_cloud). Each variant is labelled as a variant of its original. Selecting both an original and its variant stacks the same exposure twice, and that choice is left to the learner.

## 4. Architecture

```
┌──────────────── Docker container (node:22-slim) ─────────────────┐
│ server/  Fastify                                                   │
│   GET /            → dist/ (built SPA, static)                     │
│   GET /data/*.json → precomputed JSON (static)                     │
│   GET /api/roi     → the ONE API: a pixel region of one asset      │
│ /data   baked in: raw pixel files + bin pyramid + JSON             │
└────────────────────────────────────────────────────────────────────┘
Browser: React + TS + Vite + Tailwind SPA. A Web Worker pool runs
         calibrate → warp → normalize → integrate. Nothing heavy runs
         on the server.
```

- **Frontend:** React 19, TypeScript, Vite, Tailwind v4, `react-router` with `HashRouter`, and zustand for state. React plus Tailwind matches the Figma MCP's code output. Charts and diagrams are hand-written SVG components with no chart library.
- **Server:** Node 22 and Fastify with `@fastify/static`. It has no processing logic. It streams precomputed pixel files, including the bin pyramid.
- **Orientation:** every image is shown in **canonical orientation**, which is the West-side sensor orientation (f07). East-side frames and stacks are rotated 180° for display. Calibration frames are sensor-space, which is already canonical.

### 4.1 Coordinate spaces (contract)
- **Sensor space of asset A:** pixel column x (rightwards) and row y (downwards). Row 0 is the first row of the XISF array. Calibration happens here.
- **Canonical space:** f07's sensor grid, which is the PixInsight registration reference. ROI definitions live here at bin 1.
- `H_i`: the 3×3 matrix taken from the xdrz. It maps canonical to frame i's sensor space. Pixel centres sit on **integer** coordinates, as verified in Stage A (`geometry_check.json`). Quote this in `src/shared/pipeline/geometry.ts`.
- **Output grid for reference r:** M_{out→i} = H_i · H_r⁻¹ · F_r, where F_r is the identity for West frames and a 180° rotation about the image centre for East frames. The stack is aligned to r's pixel grid but keeps the canonical orientation.
- **Binning b ∈ {1,2,4,8}:** conjugate with `S_b` as in §6.4. The pipeline tests cover b = 1 against PixInsight's `_r.xisf` and b = 2 for consistency with b = 1.

### 4.2 Runtime data (`/data`, produced by `tools/precompute`, git-ignored, baked into the image)
- `manifest.json` lists every asset: id, kind (`light` | `master` | `flat` | `darkflat`), width, height, dtype, per-bin file paths, and for lights also pier side, defect, relative, header fields and `H` (9 floats).
- Pixel files: raw little-endian, row-major, no header.
  - Lights at b1 are `u16`. Masters are `f32` **in ADU**.
  - Bins 2, 4 and 8 are precomputed `f32` means. The server never bins a whole frame at request time.
  - Synthetic frames are stored already flipped.
- Precomputed JSON: `stars.json`, `histograms.json`, `normalization.json` (per frame × `calState`; §6.5), `masters.json` (per-master statistics and flat scale `f_v`), and `flat_check.json`. The manifest also carries the recorded WBPP weights (display only).
- Asset ids: lights `f00`…`f19`, `f11_tracking`, `f14_cloud`, `f15_cloud`, `f16_cloud`. Masters `bias`, `dark`, `darkflat_{10,50,85}`, and `flat_{10,50,85}_{darkflat,bias,none}` (9 master flats; the suffix is how the flat was calibrated).

### 4.3 ROI API (the one endpoint)
`GET /api/roi?id=<assetId>&x=<int>&y=<int>&w=<int>&h=<int>&bin=<1|2|4|8>`
- x, y, w and h are in the asset's own **sensor space at bin 1**. For bin > 1 they must be multiples of `bin`, and the response holds (w/bin)×(h/bin) samples.
- The rectangle is clamped to the image. Response headers are `X-Roi: x,y,w,h` (the clamped rectangle, bin-1 units), `X-Width`, `X-Height` (sample dimensions) and `X-Dtype: u16|f32`. The body is raw little-endian samples, row-major.
- **No size limit.** `x`, `y`, `w` and `h` are optional; leaving them out returns the whole image. The server **streams** rows straight from the file (positioned `fs.read` per block of rows) and sets `Content-Length`, so memory stays flat for any request size and the client can show download progress. Unknown id → 404; a malformed rectangle → 400. `Cache-Control: no-store`.
- **Why sensor space and not canonical space.** Calibration has to happen *before* alignment, because dust, hot pixels and vignetting are fixed to the sensor (§6.2, §6.4).
  - Requesting in sensor space gives the client exactly what it needs: the same sensor rectangle from the light and from each master, which it calibrates with plain element-wise maths before warping.
  - A canonical-space API would force the server to resample, which is processing on the server. The server would also have to warp every master separately for every frame, which roughly quadruples the transfer. And the order would be wrong: flat division and Lanczos clamping don't commute with warping.
  - The one place that converts a canonical ROI into sensor rectangles is the client's footprint function (§4.4). The server stays a dumb, streaming pixel reader.

### 4.4 Client pipeline (`src/shared/pipeline`, pure TS, runs in workers)
`stack(req: StackRequest) → StackResult`
```ts
type StackRequest = {
  grid: { ref: FrameId; x: number; y: number; w: number; h: number; bin: 1|2|4|8 }; // canonical-oriented output rect
  frames: FrameId[];                 // order-insensitive
  calibration: CalibrationChoice;    // §6
  algorithm: { name: 'average'|'median'|'kappaSigma'|'winsorized'|'rcr'; params?: Record<string, number> };
  align?: boolean;                   // default true; false = naive stack (Alignment lesson)
};
type StackResult = { data: Float32Array; w: number; h: number; noise: number; ms: number };
```
Per frame: **footprint** (map the output rectangle through M, pad by the interpolation radius, clamp) → **fetch** light and master crops for that sensor rectangle at the same bin → **calibrate** in sensor space (§6) → **warp** with PixInsight-equivalent interpolation (§6); pixels outside the frame become NaN and are excluded → **normalize** with precomputed coefficients (§6). Then, per output pixel over the finite samples: **integrate** with the chosen algorithm.

- **Performance budget:** 4 workbench ROIs at bin 2 with 20 frames in **< 1 s** total on a desktop. A full stack at bin 1 is processed in bands of about 256 rows, spread across `hardwareConcurrency − 1` workers, with progress reporting and cancel. Peak memory stays under 1.5 GB.
- **Fetch cache:** in memory, keyed by (id, rect, bin), with a byte-capped LRU.
- **Result cache:** in memory, keyed by the canonical JSON of `StackRequest` (frames sorted), with a byte-capped LRU. It clears on refresh. No localStorage.

### 4.5 Display
- **Lights and stacks:** PixInsight AutoSTF (target background **0.30**, shadows clip **−1.8·MADN**, linked; changed from 0.25 / −2.8 on 2026-09-24 because every Figma asset was rendered with 0.30 / −1.8 and Figma is the source of truth for how images look). The parameters come from the **reference frame's** precomputed median and MADN for the active calibration combination, so every view in that state shares one stretch. The JS STF must match `tools/astro.py` (unit-tested against Python output).
- **Bias, dark, dark flat:** each uses its own AutoSTF.
- **Flats:** linear, no stretch. Map the 0.1–99.9 percentile range to display range.
- **Reference view:** the reference frame at bin 4, calibrated, with markers for the 4 ROIs.
- **Lesson ROI stretch override:** a lesson ROI may carry its own STF when the teaching point needs it. For example, the satellite ROI is stretched so the faint trail is plainly visible. The workbench always uses the reference stretch.
- **ROI tiles:** the workbench shows ROIs of different sizes in one normalized tile form factor (layout set in Figma) with a scale indicator.
- **Noise readout (per ROI):** robust standard deviation (MADN) of the ROI's background pixels after clipping stars, in reference-normalized units, plus the ratio to a single reference frame (for example "3.9× less noise than one frame"). How SNR is presented is decided in Figma.

### 4.6 Routing, state, export
- **Hash routes**, one history entry per page: `#/welcome`, `#/noise`, `#/calibration/{bias,darks,flats,flats-2}`, `#/alignment`, `#/algorithms`, `#/light-frames`, `#/workbench`. The back and forward buttons work.
- **Sections** live in `src/sections/<name>/` and register through one list, `src/shell/sections.ts`, one line each. Shared code lives in `src/shared/` and has one owner.
- **Export** (full stack only):
  - FITS: float32 BITPIX −32, linear, [0,1]. Header: `IMAGETYP='Master Light'`, `NCOMBINE`, `EXPTIME`, `TOTEXP`, `REFFRAME`, `CALIB`, `ALGO` and parameters, `SOFTWARE`.
  - PNG: 8-bit with the current stretch.
  - The filename encodes the settings.

### 4.7 Build and run
- `npm run dev` runs Vite and the server together, with `/api` proxied. `npm run build`, `npm test` (vitest), `npm run e2e` (Playwright, Chromium + Firefox), `uv run pytest tools`.
- `docker build -t stacking-explainer .` then `docker run -p 8080:8080 stacking-explainer`. The build is multi-stage (build the SPA, then a slim runtime). `.dockerignore` excludes `source_images/`, `.venv`, `node_modules`, and everything under `data/` except `data/derived/runtime`. The product owner handles `docker save` and the VPS.

## 5. Precompute (Python, `tools/precompute/`, outputs in `data/derived/`)

| Stage | Output | Depends on |
|---|---|---|
| A ✅ | `frames.json`, `geometry_check.json` (matrix direction, pixel origin, synthetic flip), `stars.json` + `stars/<id>.csv`, `histograms.json`. Stage C adds `ecc_p90` per frame from the CSVs. | none |
| B ✅ | 3 master dark flats, 9 master flats (§6.3) + `masters.json`; `normalization.json` (24 frames × 30 `calState`s); `flat_check.json` (dust-mote contrast and vignetting residual per flat variant). Winsorized clipping seeds its spread with 1.4826·MAD instead of Sn (negligible for flats). | `docs/knowledge/wbpp.md` |
| C | `runtime/`: pixel files (b1 plus the b2/b4/b8 pyramid) and `manifest.json` | Stage B and §4.2 |
| D | Static art: Welcome images (stretched single sub, stretched WBPP master, resized colour composite), the old-camera amp-glow image, Alignment star trio, golden test fixtures (§10) | Figma sizes |

Every stage has one `run_stage_<x>.sh` so it can be regenerated, as AGENTS.md requires.

## 6. Processing semantics (WBPP-faithful)

Derived from WBPP 3.0.1's own source code. `docs/knowledge/wbpp.md` has the references and full algorithm listings; the section numbers below point there.

### 6.1 Calibration choice and WBPP master selection
The learner selects calibration **frames**, and the rules WBPP uses to pick masters (wbpp §2.1, §1.2) then decide how each frame is used:
```ts
type CalibrationChoice = { bias: boolean; dark: boolean; darkFlat: boolean; flat: null | 10 | 50 | 85 };
// derived, exactly as WBPP does it:
lightSub  = dark ? 'dark' : bias ? 'bias' : 'none'                  // D = MD | MB | 0
flatCal   = darkFlat ? 'darkflat' : bias ? 'bias' : 'none'          // selects flat_<level>_<flatCal>
calState  = `${lightSub}|${flat ? `flat_${flat}_${flatCal}` : 'none'}` // key into normalization.json (30 states)
```
- **The bias is not applied to lights when a dark is selected.** The master dark already contains the bias pedestal, and WBPP drops the bias for lights in that case (dark optimization is off by default). The UI shows the bias as "already inside the dark" for the lights and still used for the flats when dark flats are off. That's a teaching moment on the Darks page, not a bug.
- Dark flats always match the chosen flat level.

### 6.2 Calibration formula (sensor space, float32, DN)
`C = (L − D) / (MF_v / f_v)` when a flat is selected, otherwise `C = L − D`. Here `f_v` is the master flat's 5% two-sided trimmed mean (precomputed), so the light's overall level doesn't change. No pedestal, no truncation (wbpp §2.2), and no automatic cosmetic correction (§6.6).

### 6.3 Master frames (precomputed, Stage B)
- The master bias and master dark are used as supplied (built by WBPP 2.8.8, averaged, winsorized 4/3). Facts to keep the prose accurate: the dark is made from **raw 300 s darks at −15 °C**, 11 °C colder than the lights. The product owner has accepted this. It slightly under-corrects hot pixels.
- 3 master dark flats: average, no normalization, winsorized 4/3, cutoff 5.
- 9 master flats `flat_<10|50|85>_<darkflat|bias|none>`: calibrate each flat (− dark flat, − bias, or nothing), then average with multiplicative normalization, rejection winsorized 4/3.

### 6.4 Registration
- Inverse warp into the output grid: `M = S_b⁻¹ · H_i · H_r⁻¹ · F_r · S_b`.
  - PixInsight's registration coordinates put pixel centres on **integers** (AlignmentOrigin 0.5 is the centre of the top-left pixel), and Stage A confirmed it: median residual 0.02 px, against 1.41 px for the half-pixel alternative on East-side frames.
  - `S_b = [[b,0,(b−1)/2],[0,b,(b−1)/2],[0,0,1]]` maps a bin-b index to native coordinates.
  - `F_r` is the 180° display rotation for East-side references: `x → W−1−x`, `y → H−1−y`.
- Interpolation: **Lanczos-3 with clamping 0.3**, the StarAlignment default, implemented exactly as in wbpp §3.2 (6×6 separable taps, mirrored borders).
- Samples whose source position falls outside `[0,W−1]×[0,H−1]` are **NaN**. That replaces WBPP's range rejection of pixels ≤ 0.
- Performance fallback, only if §4.4's budget is missed: bicubic, with the change recorded in §12.

### 6.5 Normalization (precomputed)
- Global **scale + zero offset**: `y = (C − m_i)·(s_r/s_i) + m_r`. `m` is the median; `s` is √(biweight midvariance); `r` is the learner's reference frame (wbpp §4.2–4.3).
- The same normalized values feed both rejection and combination, as in WBPP without local normalization.
- `normalization.json` holds `frames[id].states[calState] = {median_dn: m, bwmv_dn: s (the √BWMV scale), madn_dn}` for 24 frames × 30 `calState`s. They are computed on the calibrated sensor-space frame minus a 64 px border.
- The display STF uses the reference frame's `m` and `madn` for the current `calState`.

### 6.6 Integration
- **Average:** the mean of the finite samples. **Median:** the median of the finite samples. Neither rejects anything.
- **Kappa-sigma clipping** (defaults: low 4, high 3), **winsorized sigma clipping** (4, 3, cutoff 5) and **RCR** (limit 0.1, the value WBPP sets) each reject first and then average the survivors, iterating as specified in wbpp §4.6. Implement them from that listing, down to the constants.
- All weights are equal. The stack stops when fewer than 3 samples remain. If every sample is NaN or rejected, the output is NaN, which is shown in the background colour and written as 0 in the FITS export.
- **Exposed parameters** (the workbench shows them in plain words; presentation is decided in Figma):
  - Kappa-sigma and winsorized: "too dark" and "too bright" limits in standard deviations, 1.0–6.0, step 0.1.
  - RCR: "how unlikely is too unlikely", 0.01–0.5.
- **Frame-count guidance for P7**, from WBPP's own validity table:
  - Kappa-sigma: 8–15 frames.
  - Winsorized: 8 or more.
  - RCR: 15 or more.
  - Learners hear only about our five methods. Percentile, linear fit and ESD are never mentioned (out of scope for beginners).
- **Teaching note (Satellite Challenge, P7):** with 5 frames, kappa-sigma at 3 **cannot** reject a single outlier, whatever its size.
  - The outlier inflates the standard deviation it's measured against. At most it can sit √n standard deviations from the median: 2.24 for 5 frames, or n/√(n−1) = 2.5 with the population formula. A high limit of 3 only starts working at about 8–10 frames, which matches WBPP's "8–15" guidance.
  - Winsorized and RCR use robust spreads, so they can reject it. So can median, at a cost in noise.
  - This is the core puzzle of the challenge.

### 6.7 Deliberate deviations from WBPP (approved 2026-09-24; the goal is low complexity and low CPU time)

| WBPP default | Ours | Why |
|---|---|---|
| Local Normalization (on) | Global scale + zero offset (**approved**) | LN needs per-frame PSF photometry and multiscale background models, which is too heavy for the browser. Global is WBPP's own non-LN path. Side effect: the clouds stay as structures, which is good for teaching rejection. |
| PSF Signal Weight (the author's master used PSF SNR) | Equal weights (**approved**) | No PSF photometry in the browser, and equal weights keep the algorithm comparisons clean. The recorded WBPP weights stay in the manifest and can be displayed. |
| Automatic cosmetic correction (on) | Off (**approved for now**) | Hot pixels are a lesson topic, and rejection across dithered frames removes them, which is itself the teaching point. It may come back later as a workbench option: a precomputed hot-pixel map with a 3×3 median replacement. |
| Linear-fit clipping for 25 flats | Winsorized 4/3 (**approved**) | Panel flats have essentially no outliers, so the difference is negligible. Master flats are precomputed, so this costs the learner nothing, and the winsorized code already exists for the dark flats. |
| Linear fit and ESD available | Not offered and not mentioned (**approved**) | Out of scope for beginners. |
| Autocrop | None (**approved**) | Edges stay NaN and uncropped, as the brief asks. It only matters in the final export (NaN is written as 0). |

## 7. Pages

Each page lists its goal, its problem → fix interaction, the data it uses, and acceptance criteria (AC). Layout, prose and art come from Figma. The ROI sizes and positions below are **placeholders until Figma**.

**P0 Welcome.** The emotional hook: one 300 s sub → WBPP master → final colour image, with a clear line that these are real images from Stella Venator Observatory in Lexington, KY. Data: Stage D static images. AC: renders in under 2 s on localhost; Start goes to `#/noise`.

**P1 Noise & Defects.** What makes up a light frame: target and sky signal, random noise, bias offset, dark signal and hot pixels, uneven response (vignetting, dust), and non-hardware problems (clouds, tracking, satellites, planes). Also why we stack, and what "calibration frames" means. Interactive: the **system SVG** (telescope → camera → sensor → sensor PCB with op-amp and ADC) with colour-coded noise layers. Selecting a layer highlights where it comes from. Also a "why stack" control that averages 1 → N frames on a background ROI to show noise falling. AC: every layer is selectable, and the N-frame noise readout falls roughly as 1/√N.

**P2 Bias.** Problem: every pixel sits on an offset added by the readout electronics. Fix: subtract the bias. Interactive: a bias toggle on a light ROI, with its histogram and a sample pixel's brightness moving (for example about 1,060 → 900). The master bias is shown with its own stretch, and the op-amp/ADC layer peels away in the SVG. AC: the histogram shift equals the master bias median to within 1 ADU.

**P3 Darks.** Problem: hot pixels (and amp glow on some cameras). Fix: subtract a dark taken at the same exposure time and temperature as the lights. Interactive: an ROI rich in hot pixels, toggling none → bias only → dark. When the dark is on, the bias shows as "already inside the dark" (§6.1). The old-camera dark is shown only to illustrate amp glow. The page notes that this dark was taken colder than the lights (−15 °C vs −4 °C), which is acceptable here, and that on this camera the dark is mostly bias plus hot pixels. AC: visible hot pixels disappear only with the dark applied.

**P4 Flats.** Problem: vignetting and dust shadows. Fix: divide by a flat, and calibrate that flat with dark flats. Interactive: a dust-mote ROI and a bin-8 full-field view; toggle the flat, then toggle dark flats (and bias) to show what an uncalibrated flat does, which is over-correction toward the corners. *Candidate for Figma:* a difference view showing what the dark flats change in the corrected result. The difference view is needed, not optional, because the effect is too small to see directly:
- At 50%, the flat's pedestal (about 160 DN) is 0.5% of its 33k level, so the vignetting residual only moves from 0.962 to 0.961.
- At 10% the pedestal is 2.5% of the level, so the effect is larger there.
- Likely also visible: a flat calibrated with bias instead of dark flats keeps its own hot pixels, because the 50% flats were shot at +1 to +3 °C and the master's maximum rises from 38.8k to 49.6k DN. Those print as dark specks in the light. Verify this in design.

AC: the mote and vignetting vanish with the 50% flat calibrated by dark flats.

**P5 Flats–Continued.** Why the histogram target matters. Interactive: choose the 10%, 50% or 85% flat, see each flat's histogram, and see the dust-mote ROI corrected with each. The full-well discussion is now the core explanation, not an aside: the 85% flats look healthy on a histogram (peak at 78%) but the pixels are full, so the flat is featureless and corrects nothing. The 10% flat corrects the mote and vignetting as well as the 50% one on these metrics. Its drawbacks (a 0.11 s exposure that approaches bias speed, and fewer photons per flat) don't show up in the numbers; how to present them is the product owner's call. AC: the mote contrast shown for each level matches `flat_check.json`.

**P6 Alignment.** How frames are brought together and why that raises SNR. Interactive: f02 + f05 (about 47 px apart, same pier side) averaged **without alignment**, which doubles the stars. The trio of stars used for alignment is highlighted, with offset vectors taken from the Stage A catalogues. Toggle align and the stars merge. Then attention turns to the **background**, where the noise readout shows about a 1/√2 drop. AC: the naive stack clearly shows doubled stars; the aligned stack matches the pipeline golden output.

**P7 Algorithms.** How each algorithm decides what an outlier is, explained with high-school maths ("standard deviation", never "sigma"). Interactive: a 5-frame stack that includes f03, shown with average and median side by side on the satellite ROI. There is guidance on which algorithm suits which frame count (from §6). AC: the trail is visible with average and gone with median.

**P8 Light Frames.** Choosing good frames. FWHM, star counts and histograms are tools, and judgement still matters. The data shows this directly:
- The tracking error is invisible in FWHM (8.57 px vs 8.21 for its original). It shows up in the star count, 74 vs 179, because trailed stars fail detection.
- Clouds barely move the star count (163 → 153) but widen the histogram (background spread 108–114 vs 63–80).
- f03 has middling metrics for reasons unrelated to its satellite trail.

No single number catches every defect; looking at the frame does. A lighter version of the workbench: every frame with its thumbnail, metrics and histogram; average or median; one galaxy ROI; full calibration applied and locked; a teaser for the other algorithms. AC: selection changes update the ROI in under 1 s.

**P9 Workbench.** Layout is designed together in Figma. Order of interaction:
1. Calibration panel: bias, dark, flat (none / 10 / 50 / 85%) and dark flats, following the WBPP rules in §6.1. Selecting a calibration frame shows it with the correct stretch.
2. Frame list (all 24 entries, each with metrics and a histogram; select or deselect; set as reference).
3. Algorithm and parameters.
4. Scenario buttons.
5. Reference view with the 4 ROI markers, and the ROI tiles updating live at bin 2.
6. **Stack full image** (bin 1, progress, cancel), then the result view, then export as FITS or PNG.

Default ROIs, in canonical space, with positions and sizes set in Figma: (1) the satellite trail in f03, (2) the central galaxy including faint outer structure, (3) the galaxy group just above it, (4) the dust mote on the left.
*Teaching note:* the dust mote and hot pixels are fixed to the **sensor**. Because of the meridian flip, East-side frames place the mote at the opposite side of the sky. In a stack the mote only comes from the West frames, which is why median and rejection weaken it even without flats.

**Scenarios** (defined in `src/sections/workbench/scenarios.ts`):

| Scenario | Frames | Algorithm | Calibration |
|---|---|---|---|
| Default | The 20 raw frames, i.e. all except the synthetic variants (f03 is included) | median | full (per §6) |
| Naive | All 24 entries | average | full |
| Satellite Trail Challenge | f03 + f02, f04, f05, f07 (the best West-side frames by FWHM) | average | full |
| Cloud Challenge | f14_cloud, f15_cloud, f16_cloud + f09, f13 (best by FWHM and stars, excluding the originals of the cloud frames) | average | full |
| Tracking Error Challenge | f11_tracking + f09, f13 | average | full |

AC: each button sets the full state in one click, and the ROIs update in under 1 s.

## 8. Milestones and stories

Gates for every merge to `main`: `uv run pytest tools`, `npm run typecheck`, `npm test`, `npm run build`. At the end of each milestone, add `npm run e2e` (smoke) and a `docker build` plus container smoke test (`/` and one `/api/roi`).

**Phase 1 (now):** this spec, WBPP knowledge, precompute stages A and B.
**Phase 2:** Figma (library plus one page per section), with the product owner.
**Phase 3:** re-evaluate this spec against the design and update §7 and §11.

**M1: display and selection**
- M1-01 Scaffold: Vite/React/TS/Tailwind, Fastify server, Dockerfile, npm scripts, vitest, Playwright, section registry, and design tokens taken from the Figma library.
- M1-02 Runtime data (Stage C) and the ROI API with unit tests (clamping, bin pyramid, dtype, whole-image streaming, 400/404).
- M1-03 Data client (typed fetch, fetch cache) and the JS STF, tested against Python.
- M1-04 App shell: wizard navigation (previous, next, progress), hash routing, back button.
- M1-05 Workbench shell: every control present. Frame list with metrics and histograms. Calibration frame viewer with the correct stretch. Reference view with ROI markers. ROI tiles that show crops of the reference frame as placeholders.
- M1-06 Skeletons for every lesson page, using the Figma layouts with placeholder content.
- AC: click through every light and calibration frame with the correct stretch and orientation; back button works; `docker run` serves the app.

**M2: average and median, calibration, live ROIs**
- M2-01 Pipeline core: footprint, calibrate, warp, normalize, average and median, NaN edges, worker pool.
- M2-02 Golden tests: a numpy reference implementation of `stack()` for small ROIs, with fixtures compared in vitest within tolerance. Warp checked against PixInsight `_r.xisf` at b1.
- M2-03 Live ROIs (4 × bin 2 in under 1 s), result cache, noise readout.
- M2-04 Full stack: band streaming, progress, cancel, result view, FITS and PNG export.
- AC: calibration is applied in WBPP order, and the ROIs update on every change.

**M3: lessons.** Each page's interactive element and Figma prose, per §7.
**M4: all algorithms and scenarios.** Kappa-sigma, winsorized and RCR with their exposed parameters; the five scenarios.
**Polish:** whatever is left of the 8 hours.

## 9. Language rules for prose and UI copy
- Say "pixel brightness", not ADU. Say "standard deviation", not sigma. Say "dark frames taken with the same exposure time and temperature as your lights", not "matched darks".
- Define every term the first time it appears: light, bias, dark, flat, dark flat, stack, master, reference frame.
- No asides that don't serve the current step. One idea per paragraph.

## 10. Orchestration (autonomous implementation and validation)

**Ownership and models**

| Role | Model / effort | Owns |
|---|---|---|
| Orchestrator (main session) | Opus, high | SPEC.md, AGENTS.md, contracts (§4.1–4.4 types), merges to `main`, gates, reviews |
| Foundation | Opus, high | M1-01, M1-04, `src/shared/` UI primitives and tokens. **Lands first**; everyone else branches from it. |
| Data + server | Sonnet, medium | `tools/precompute/` stages C–D, `server/`, M1-02 |
| Pipeline | Opus, high | `src/shared/pipeline/`, golden fixtures, M2-01/02/04, M4 algorithms |
| Workbench UI | Sonnet, medium | `src/sections/workbench/`, M1-05, M2-03 integration, scenarios |
| Lesson UI (2–3 agents) | Sonnet, medium | `src/sections/<page>/`, split by page group: [welcome, noise], [bias, darks, flats, flats-2], [alignment, algorithms, light-frames] |
| Validator | Sonnet, medium | Runs gates and Playwright screenshot tours after every merge, compares them with the Figma frames, files issues in `TODO.md` |

**Rules**
- Code agents run in git worktrees on `section/<name>`, `asset/<name>` or `core/<name>`. Worktrees don't contain `source_images/` or `data/`, so they read runtime data through `ASTRO_DATA=<abs path to main>/data/derived/runtime`.
- An agent receives this spec, its section brief and the contracts, not the chat history. An agent touches only the files it owns. A cross-boundary change becomes a request in `TODO.md`.
- Agents rebase onto `main` and run the gates. The orchestrator merges. Commit messages follow AGENTS.md.
- **Waves:** (0) precompute and research → (1) Foundation alone → (2) Data+server, Pipeline, Workbench UI and Lesson skeletons in parallel → (3) M2 integration → (4) M3 lessons ‖ M4 algorithms → polish.

## 11. Deferred items and risks

**Deferred to Figma:** ROI sizes and positions, the normalized ROI tile form factor, page layouts, SVG art direction, and all prose.

**Deferred (may revisit if time allows):** a live full-field stack at bin 8 in the reference view.

**Risks**
- A full-resolution stack pulls about 1.0 GB from the server. The product owner deferred this until it becomes a problem.
- Lanczos warping cost in JS. Deferred until it becomes a problem; §6.4 names the fallback.

## 12. Decision log
- 2026-09-24:
  - Lessons use native-resolution ROIs only. Workbench ROIs are 2×2 binned. The full stack runs at full resolution. Source images are never down-binned for delivery.
  - One backend endpoint (ROI regions) is authorized. It has no request-size limit (a whole image may be requested), and it is addressed in each asset's sensor space (§4.3).
  - Deployment is via `docker save`, owned by the product owner.
  - The old-camera dark is display-only.
  - Normalization is authorized and precomputed.
  - Changing the reference re-registers the stack to it, and images keep one canonical orientation.
  - Cache is in memory only and clears on refresh.
  - ROI sizes are deferred to Figma.
  - All 9 flat masters are precomputed.
  - Figma timeboxing is handled by the product owner with the design agent.
  - Masters must follow PixInsight WBPP (knowledge in `docs/knowledge/wbpp.md`).
  - The workbench and Light Frames lesson list all 24 entries (20 raw + 4 synthetic variants). Default selects the 20 raw frames; Naive selects all 24.
  - Rejected: pixel-stack inspector, rejection-map overlay. Deferred: live bin-8 full-field stack, transfer size over the internet, Lanczos cost. The satellite trail is visible with the right stretch, so lessons may use a per-ROI stretch.
  - WBPP deviations in §6.7 approved: global normalization and equal weights (for low complexity and CPU time); cosmetic correction off for now (it may return as a workbench option); linear fit and ESD are never explained to learners; no autocrop (it only matters at export).
  - Master flats use winsorized clipping (lowest complexity; precomputed, so no CPU cost for the learner).
  - Phase 4 (implementation): the display AutoSTF for lights and stacks is 0.30 / −1.8 (the stretch every Figma asset used), not 0.25 / −2.8; the workbench review found the live tiles visibly flatter than the design otherwise.
