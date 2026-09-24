---
name: astro-image
description: Convert, stretch, measure and denoise astrophotography images (FITS/XISF) with the project CLI tools/astro.py. Use when producing web assets (PNG 8/16-bit, JPEG, WebP) from FITS or XISF, applying a PixInsight-style auto STF stretch, detecting stars and measuring FWHM/eccentricity, or starlet-wavelet denoising / visualizing wavelet layers.
---

# astro-image

Run everything via `uv run tools/astro.py <cmd>` from the repo root. The first `uv sync` creates `.venv`. Add `--help` to any command for the full options.

## Pick the command
- **Web image from raw data:** `convert in.fits out.jpg --stretch --quality 85`. For a lossless version use `out.png --bits 16`. Leave out `--stretch` when you want linear data. Linear data looks almost black, which is itself a teaching point.
- **Stretch only:** `stretch in.xisf out.png`. This is PixInsight AutoSTF: target background 0.25, shadows clip −2.8·MADN, channels linked. Use `--unlinked` to neutralize a colour cast. `--shadows/--midtones` set a manual STF. The parameters used are printed to stderr as JSON, so record them if the page shows them.
- **Star metrics:** `stars in.fits [--model moffat] [--pixscale 1.94] --csv s.csv --overlay s.png`. Run it **only on linear, unstretched** data. Stretching changes star profiles. The FWHM guess iterates automatically; pass `--fwhm-guess` to pin it. Output is JSON on stdout with `n_stars`, `fwhm_px_median`, `fwhm_arcsec_median`, `ecc_median`, `background` and `noise`.
- **Denoise:** `denoise in.fits out.xisf --layers 1:3:1,2:2:0.8 --n-layers 4`. Each entry is `layer:threshold(σ):amount`. `--dump-layers DIR` writes each starlet scale as a PNG for diagrams. Add `--stretch` when the output is .png/.jpg.
- **One-shot-colour CFA subs:** add `--debayer auto` (reads BAYERPAT) or `--debayer RGGB`. This is a 2×2 superpixel debayer, so the image comes out at half resolution.
- **Inspect:** `info in.fits` prints the key headers (IMAGETYP, EXPTIME, GAIN, CCD-TEMP, BAYERPAT…), median/MADN and arcsec/px.

## Rules
- Raw inputs live in `source_images/` (git-ignored; see AGENTS.md › Data layout). Write committed web assets only via a recorded command, so they can be regenerated.
- After changing `tools/astro.py`, run `uv run pytest tools`. The tests use synthetic frames with a known FWHM (3.5 px) and known noise.
- In Python you can `import astro` (add `tools/` to `sys.path`) for `load`, `save`, `auto_stf`, `apply_stf`, `mtf`, `measure_stars`, `starlet` and `denoise`. That's handy for composite figures such as histograms before and after a stretch.
