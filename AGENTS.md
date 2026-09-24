# AGENTS.md: Astrophotography Explainer

Read this before working in the repo. It covers what we're building, the tools, and how parallel agents work without getting in each other's way.

## Product requirements

- **What:** a single-page educational web app that explains **image stacking and calibration frames** (lights, darks, flats, dark-flats/flat-darks, bias) in astrophotography: why each frame exists, what noise or artifact it removes, and how stacking improves SNR.
- **Spec:** `SPEC.md` is the source of truth for scope, architecture, contracts, milestones and agent orchestration. Read it before starting any story.
- **Build:** a React/TS/Tailwind SPA built with Vite, served by a small Node (Fastify) server. That server exposes exactly **one** API, `GET /api/roi`, which returns a pixel region of one image (SPEC §4.3). All image processing runs in the browser. Everything ships as one Docker container.
- **Platform:** desktop only. Target the latest **Chrome and Firefox**. Don't spend time on mobile layouts, Safari, or touch.
- **Assets:** every example image is made from real or synthetic data by `tools/astro.py`, so the numbers the page shows (FWHM, noise, SNR) are reproducible.
- **Status:** implemented (2026-09-24): all eleven pages, the live pipeline, the ROI API and the Docker image are on `main`. Figma-vs-page reviews live in `docs/reviews/`; open items are in `TODO.md`. Run `npm run dev` (needs `data/derived/runtime`, see `tools/precompute/README.md`) or `docker build -t stacking-explainer . && docker run -p 8080:8080 stacking-explainer`.

## Tooling

| Need | Tool |
|---|---|
| Python env (project-local `.venv`, Python 3.12) | `uv sync`, then `uv run …` |
| FITS I/O | astropy |
| XISF I/O | `xisf` (PixInsight format, read and write) |
| Background, star detection | photutils (`Background2D`, `DAOStarFinder`) |
| PSF fitting | scipy `least_squares` (elliptical Gaussian or Moffat) |
| PNG 8/16-bit (incl. 16-bit RGB) | pypng |
| JPEG / WebP | Pillow |
| Everything above, as one CLI | **`tools/astro.py`** |
| Tests with synthetic ground truth | `uv run pytest tools` (must stay green) |
| Figma | Figma MCP (connected) plus the `figma:*` skills |

The project skill `.claude/skills/astro-image/SKILL.md` covers the CLI in more depth.

### `tools/astro.py` quick reference

Internally, images are float32 `(C,H,W)` in `[0,1]`. Integer input is scaled by its dtype range.

```bash
uv run tools/astro.py info  in.fits                                   # header + stats JSON
uv run tools/astro.py convert in.xisf out.png --bits 16               # linear, lossless 16-bit
uv run tools/astro.py convert in.fits out.jpg --stretch --quality 85  # stretched lossy
uv run tools/astro.py stretch in.fits out.png [--unlinked] [--target-bg 0.25 --clip -2.8]
uv run tools/astro.py stretch in.fits out.png --shadows 0.02 --midtones 0.1   # manual STF
uv run tools/astro.py stars   in.fits --model moffat --csv stars.csv --overlay stars.png
uv run tools/astro.py denoise in.fits out.xisf --layers 1:3:1,2:2:0.8,3:1:0.5 --dump-layers L/
# add --debayer RGGB (or --debayer auto to use the BAYERPAT header) for one-shot-color CFA frames
```

- **stretch** implements PixInsight's AutoSTF: `c0 = median + clip·MADN` (MADN = 1.4826·MAD), `m = MTF(target_bg, median − c0)`, then `MTF(m, (x−c0)/(1−c0))`. Channels are linked by default, which keeps the colour balance. The parameters it uses are printed to stderr as JSON.
- **stars** runs only on **linear** data. By default it iterates the detection kernel and cutout size to the measured FWHM, and it drops fits under 1.5 px as hot pixels. On a real sub it takes about 45 s and gives ≈2.7″ (≈10 px). It prints the median FWHM in pixels and in arcsec. Arcsec come from `--pixscale` or from the `XPIXSZ`/`FOCALLEN` headers.
- **denoise** soft-thresholds the chosen starlet (à trous B3-spline) layers. The format is `layer:threshold_in_sigma:amount`. Noise is estimated from layer 1 via MAD. `--dump-layers` writes each scale as an image, which is useful for infographics.
- Output format follows the extension: `.png` (`--bits 8|16`), `.jpg`, `.webp`, `.fits`, `.xisf`.

## Data layout

- `source_images/` (**git-ignored, 6.7 GB, local only**): real NGC 7331 data taken with an EdgeHD 11 at 2800 mm, AP26MC camera, Red filter, 300 s subs, 0.277″/px. Subfolders:
  - `light/`: 20 raw subs. It also holds deliberately bad frames (`*_TRAIL_*`, `*_PATCHY_CLOUD*`) for teaching rejection.
  - `calibration/`: master bias, master dark, raw flats, and a mismatched `darkFromOlderCamera.fits`.
  - `light_registered/`: registered subs (`.xisf` plus PixInsight `.xdrz` drizzle data).
  - `light_synthetic_disaster/`
  - `final/`: the integrated master light and `NGC7331.png`.
- `data/derived/` (git-ignored): regenerable outputs. `data/derived/precompute/` holds metrics, masters and normalization. `data/derived/runtime/` holds the pixel files and manifest baked into the Docker image. Scripts live in `tools/precompute/`, one `run_stage_<x>.sh` per stage (SPEC §5).
- Dataset quirks every agent must know (verified): the synthetic FITS frames are vertically flipped relative to the raw XISF; the `.xdrz` `AlignmentMatrix` maps reference (FRAME_0007) coordinates → raw frame coordinates; `light_registered/*_r.xisf` are registered but **uncalibrated**; the master dark includes the bias pedestal. See SPEC §3.
- Web-ready assets go wherever the app scaffold puts static files. Commit those, and commit the exact `astro.py` command that produced each one (a `Makefile` or a script) so they can be regenerated.

## Parallel work (hackathon mode)

We fan out to many agents to cut wall-clock time. Organise work so agents don't touch the same files.

1. **Shared foundation first, then fan out.** One agent owns shared contracts: design tokens, the Figma library, the app shell, and the section interface. Page and section agents start only after those land on `main`.
2. **Figma structure:** a **shared library** (tokens: colour, type, spacing; components: frame-type badges, image comparer, histogram, callouts) plus **one Figma page per app section**. A section agent edits only its own page and consumes the library. It never edits library components. If it needs a library change, it asks the library owner or records the request in `TODO.md`.
3. **Code structure mirrors Figma:** one directory per section (for example `src/sections/<name>/`) holding its markup, styles, script and assets. Shared code lives in `src/shared/` and has one owner. A section registers itself through a single list in the shell, and agents append to that list with a one-line change so merges stay trivial.
4. **Isolation:** each parallel agent works in its own git worktree or branch named `section/<name>` or `asset/<name>`, and merges or rebases onto `main` frequently.
5. **Independent pipelines:** asset generation (`tools/astro.py`), prose, and UI are separate tracks. They meet through agreed file paths and names, not through shared editing.
6. **Contracts beat coordination.** When two tracks depend on each other, write the interface down (file names, props, token names) in the relevant README or here, commit it, then work in parallel.

## Git: when and how to commit

- Commit at every **coherent, working checkpoint**: a tool that passes its tests, a finished section, a regenerated asset set. Don't commit broken builds to `main`. Commit small and often on branches.
- Run `uv run pytest tools` before committing changes to `tools/`. Once the app has a build, run it too.
- Never commit `source_images/`, `data/`, FITS/XISF files, `.venv`, `node_modules`, secrets, or `.claude/settings.local.json`.
- **Commit messages must make sense to someone with no access to this chat or ticket:**
  - Subject: imperative mood, ≤ 72 characters, says *what* changed ("Add flat-frame vignetting demo section").
  - Body: explains **why**: the problem or motivation, the reasoning behind non-obvious choices, the alternatives you rejected, and any caveats or follow-ups. Name concrete things (files, parameters, data sources) and don't point to "the discussion above" or "as requested".
  - If an asset was regenerated, include the command that made it.

```
Use Moffat PSF fits for FWHM on the seeing demo

Gaussian fits underestimated FWHM by ~10% on the real 2" seeing
subs because their wings are heavier than a Gaussian. Moffat
(beta free, 1–10) matches PixInsight's FWHMEccentricity within 3%
on the same frames, so the number we show readers is defensible.

Regenerated: uv run tools/astro.py stars source_images/light/<frame>.xisf --model moffat
```

## References

**Local knowledge**
- `docs/knowledge/wbpp.md`: how PixInsight WBPP calibrates, normalizes, registers and integrates, and the settings recorded in this dataset's masters. Our pipeline replicates it.

**Astrophotography accuracy**
- Astropy CCD Data Reduction Guide (bias, darks, flats; the rigorous basics): https://www.astropy.org/ccd-reduction-and-photometry-guide/
- Siril calibration: https://siril.readthedocs.io/en/stable/preprocessing/calibration.html
- Siril stacking (rejection, normalization, weighting): https://siril.readthedocs.io/en/stable/preprocessing/stacking.html
- Siril stretching (autostretch uses the same MTF as PixInsight STF): https://siril.readthedocs.io/en/stable/processing/stretching.html
- Siril PSF / FWHM: https://siril.readthedocs.io/en/stable/Dynamic-PSF.html
- DeepSkyStacker theory (plain-language stacking/calibration): http://deepskystacker.free.fr/english/theory.htm
- PixInsight tutorials: https://pixinsight.com/tutorials/ · XISF spec: https://pixinsight.com/doc/docs/XISF-1.0-spec/XISF-1.0-spec.html
- FITS format overview: https://heasarc.gsfc.nasa.gov/docs/heasarc/fits.html · astropy.io.fits: https://docs.astropy.org/en/stable/io/fits/
- photutils (detection, background, PSF): https://photutils.readthedocs.io/en/stable/
- Roger Clark's articles (sensor noise and SNR; opinionated, so cross-check): https://clarkvision.com/articles/
- How Webb's colour images are made: https://webbtelescope.org/contents/articles/how-are-webbs-full-color-images-made

**Educational prose and explorable explanations**
- Bartosz Ciechanowski, *Cameras and Lenses* (the quality bar for interactive explainers): https://ciechanow.ski/cameras-and-lenses/
- Bret Victor, *Explorable Explanations*: https://worrydream.com/ExplorableExplanations/ · gallery: https://explorabl.es/
- Distill, *Research Debt* (why explanation matters): https://distill.pub/2017/research-debt/
- NN/g, how users read on the web: https://www.nngroup.com/articles/how-users-read-on-the-web/
- Plain language guide: https://digital.gov/guides/plain-language

**Infographic and visual design**
- FT Visual Vocabulary (choosing the chart form): https://github.com/Financial-Times/chart-doctor/tree/main/visual-vocabulary
- Datawrapper on colour in visualization: https://blog.datawrapper.de/colors/
- ColorBrewer (safe palettes): https://colorbrewer2.org/
- WCAG 2.2 quick reference (contrast, keyboard): https://www.w3.org/WAI/WCAG22/quickref/
- The Pudding (visual-essay patterns): https://pudding.cool/
