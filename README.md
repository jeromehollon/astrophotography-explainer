# Astrophotography Calibration and Stacking, Explained

An interactive, desktop-only lesson followed by a workbench. It teaches how calibration frames (bias, darks, flats, dark flats) and stacking algorithms turn twenty raw exposures of NGC 7331 into a clean master image. Every image on the site is real data from Stella Venator Observatory, and the workbench stacks that data live in your browser.

- `SPEC.md`: what we built and why. `AGENTS.md`: repo conventions and tooling.
- `docs/reviews/`: Figma-versus-page reviews of every page. `TODO.md`: open items.
- Figma file: https://www.figma.com/design/jtYi1LQf1fVyUAUfAgthP5/Astrophotography-Explainer

## How it fits together

```
browser  React 19 + TypeScript + Vite + Tailwind v4 (hash routes, one page per lesson)
         └─ Web Worker pool: calibrate → warp → normalize → integrate (src/shared/pipeline)
server   Node 22 + Fastify: serves dist/, /data/*.json and ONE api, GET /api/roi
data     data/derived/runtime: raw pixel files (bin 1/2/4/8) + manifest, made by tools/precompute
```

The server never processes pixels. It streams a rectangle of one image from disk; the browser does everything else.

## Prerequisites

| Need | Version | Notes |
|---|---|---|
| Node | 22 | `nvm use 22` |
| Python + uv | 3.12 | only for regenerating data and assets: `uv sync` creates `.venv` |
| Docker | any recent | only for the container build |
| Source data | local | `source_images/` (6.7 GB, git-ignored) is needed once, to produce the runtime data |

## 1. Produce the runtime data (once)

The app reads `data/derived/runtime/` (about 3.9 GB, git-ignored). If it is missing, build it from `source_images/`:

```bash
uv sync                                    # Python env
bash tools/precompute/run_stage_a.sh       # frame manifest, geometry check, stars, histograms  (~45 min)
bash tools/precompute/run_stage_b.sh       # master flats, normalization, flat check            (~20 min)
bash tools/precompute/run_stage_c.sh       # pixel pyramid + manifest.json → data/derived/runtime (~10 s)
```

Stages A and B are already done on the project machine (`data/derived/precompute/`), so normally only stage C is needed. `tools/precompute/README.md` documents every output. `uv run pytest tools` checks the tooling.

## 2. Run in development

```bash
npm install
npm run dev
```

This starts Vite on http://localhost:5173 and the API server on port 8080 together. Vite proxies `/api` and `/data` to the server. Open http://localhost:5173/#/welcome.

Useful variations:

```bash
PORT=8181 node server/index.js                        # API alone, on another port
VITE_API_PORT=8181 npx vite --port 5181               # Vite alone, proxying to that port
ASTRO_DATA=/path/to/runtime node server/index.js      # runtime data somewhere else
```

Routes: `#/welcome`, `#/noise`, `#/calibration/{bias,darks,flats,flats-2}`, `#/alignment`, `#/algorithms`, `#/light-frames`, `#/light-frames/review`, `#/workbench`.

## 3. Test and build

```bash
npm run typecheck        # tsc
npm test                 # vitest: pipeline golden tests, ROI API, page logic
npm run build            # production SPA into dist/
npm run e2e              # Playwright wizard smoke test; needs a running dev server:
                         #   E2E_BASE=http://localhost:5173 npm run e2e
node e2e/shot.mjs "http://localhost:5173/#/algorithms" algo.png   # full-page screenshot at 1440 px
```

`npm test` also runs an integration test against the real runtime data when `ASTRO_DATA` is set.

Run the production build without Docker:

```bash
npm run build
npm start                # http://localhost:8080 serves dist/ and the API
```

## 4. Build and run the Docker image

The image bakes `data/derived/runtime` in at `/data`, so build from a checkout that has it (step 1). The image is about 7 GB.

```bash
docker build -t stacking-explainer .
docker run --rm -p 8080:8080 stacking-explainer
# open http://localhost:8080
```

Smoke test a running container:

```bash
curl -sI http://localhost:8080/                                                  # 200 text/html
curl -sI 'http://localhost:8080/api/roi?id=f03&x=100&y=200&w=64&h=32&bin=2'      # 200, X-Roi, X-Dtype: f32
curl -s  http://localhost:8080/data/manifest.json | head -c 200
```

### Deploy to a VPS

```bash
docker save stacking-explainer | gzip > stacking-explainer.tar.gz     # ~2 GB compressed
scp stacking-explainer.tar.gz user@host:
ssh user@host 'gunzip -c stacking-explainer.tar.gz | docker load && \
  docker run -d --restart unless-stopped --name stacking-explainer -p 8080:8080 stacking-explainer'
```

Put a reverse proxy (Caddy, nginx) in front if you want TLS. The container needs no environment variables; `PORT` (default 8080) and `ASTRO_DATA` (default `/data`) can be overridden with `-e`.

## The one API

`GET /api/roi?id=<assetId>&x=<int>&y=<int>&w=<int>&h=<int>&bin=<1|2|4|8>`

Returns raw little-endian samples of one rectangle of one asset in that asset's sensor space (`x`, `y`, `w`, `h` in bin-1 units; all optional, so a bare `id` returns the whole image). Headers: `X-Roi` (clamped rectangle), `X-Width`, `X-Height` (sample dimensions), `X-Dtype` (`u16` for bin-1 lights, `f32` otherwise). Asset ids: lights `f00`…`f19`, `f11_tracking`, `f14_cloud`, `f15_cloud`, `f16_cloud`; masters `bias`, `dark`, `darkflat_{10,50,85}`, `flat_{10,50,85}_{darkflat,bias,none}`. See SPEC §4.3.

## Regenerating page assets

Every static image in `assets/` was made by a script in `tools/assets/` (one per page) from the raw data, so the numbers the pages quote are reproducible. For example:

```bash
uv run tools/assets/algorithms_page.py     # assets/algorithms/*.png + stats.json
```

## Repository layout

```
src/shell/          routing and the section registry (one line per page)
src/shared/ui/      the Figma library as React components; src/shared/tokens.css holds the tokens
src/shared/pipeline stacking pipeline, worker pool, STF display, PNG/FITS export
src/shared/data/    typed fetch of /data/*.json and /api/roi with a byte-capped cache
src/sections/<page> one directory per page, with its own assets
server/             Fastify server and its tests
tools/astro.py      FITS/XISF conversion, stretch, star measurement, denoise
tools/precompute/   stages A–C
tools/assets/       the scripts that made every image in assets/
tools/golden/       numpy reference used by the pipeline's golden tests
docs/               design notes, Figma state, contracts, reviews, WBPP knowledge
```
