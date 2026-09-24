# Implementation contracts (phase 4, 2026-09-24)

Every code agent reads this before writing code. SPEC.md wins on semantics; this file fixes the file paths, props and JSON shapes the parallel tracks meet on. Change it only through the orchestrator.

## Repo and workflow

- Main checkout (has `source_images/`, `data/`, `node_modules`): `/mnt/c/Users/Jerome Hollon/Documents/claude/astrophotography-explainer` (quote the path: it has a space). Call it `$MAIN`.
- Each agent works in its own worktree on `core/<name>`; `node_modules` is a symlink to `$MAIN/node_modules`. Run `git merge main` at start and whenever told a dependency has landed.
- Runtime data is read from `$MAIN/data/derived/runtime` via `ASTRO_DATA=...` for the server. Precompute JSON lives in `$MAIN/data/derived/precompute`.
- Ports: each agent runs its own dev servers: `PORT=<api> node server/index.js` and `npx vite --port <web>`. Assigned pairs: foundation 5180/8180, data 5181/8181, pipeline 5182/8182, lessons-a 5183/8183, lessons-b 5184/8184, lessons-c 5185/8185, lessons-d 5186/8186, workbench 5187/8187, reviewers 5190+/8190+. Vite proxies `/api` and `/data` to `http://localhost:8080` by default; override with `VITE_API_PORT=<api>` (foundation adds this to vite.config.ts) or run Vite with `--config` pointing at a copy.
- Gates before reporting done: `npm run typecheck`, `npm test`, `npm run build`. Commit small and often with AGENTS.md-style messages. Never commit `data/`, `source_images/`, `node_modules`, `dist`.
- Figma file `jtYi1LQf1fVyUAUfAgthP5`. Frame/page ids are in `docs/figma-state.json`. Figma is the source of truth for layout, prose, sizes and colours. Read prose from Figma (`get_design_context` / `get_metadata`), never from `docs/copy.md`.
- Screenshots: `node e2e/shot.mjs <url> <out.png>` (full page at 1440). Figma screenshots via the Figma MCP `get_screenshot` on the frame id.

## Section registry (`src/shell/sections.ts`, owner: foundation)

```ts
export type Section = {
  path: string;      // '/welcome' | '/noise' | '/calibration/bias' | '/calibration/darks' | '/calibration/flats' | '/calibration/flats-2' | '/alignment' | '/algorithms' | '/light-frames' | '/light-frames/review' | '/workbench'
  chapter: string;   // TopBar row 1: 'Welcome' | 'Noise & Defects' | 'Calibration' | 'Alignment' | 'Algorithms' | 'Light frames' | 'Workbench'
  page: string;      // TopBar row 2 label: 'Bias' | 'Darks' | 'Flats' | 'Flats, continued' | 'Image Worthiness' | 'Review the Exposures' | '' for single-page chapters
  title: string;     // BottomNav label, e.g. 'Noise & Defects'
  Component: React.ComponentType;
};
```
Each section appends one line to `sections` in wizard order (SPEC §7). Import lazily is not required.

## Section layout (owner: each section)

`src/sections/<name>/index.tsx` default-exports the page component; assets that the page needs at runtime go in `src/sections/<name>/assets/` (import them, Vite hashes them). Copy from `$MAIN/assets/<figma-page>/` (already committed, same images as Figma). Do not import from another section except `light-frames-review` ↔ `workbench`, which share the frame list.

## Shared UI (`src/shared/ui/index.ts`, owner: foundation)

All components are Tailwind + tokens from `src/shared/tokens.css`. Props (all `className?` accepted):

```ts
LessonPage({ children })            // TopBar (two rows: chapters, then pages of the current chapter, current highlighted) + <main> + BottomNav (Previous/Next from the registry). Welcome: no Previous, Next reads "Start: Noise & Defects →". Workbench: no Next.
Reading({ children })               // 1200 px content column centred in 1440 (120 px gutters), vertical stack, cream page
PageHead({ eyebrow, title, subtitle?, lede })
Prose({ children })                 // 680 px reading column, body/md; h2/h3/p styled inside
Rule()                              // 6 px ink rule between reading and stage
Stage({ children })                 // dark full-width "Try it" stage; children sit in the 1200 column
StageHead({ eyebrow?, title, instructions? })
Experiment({ title, help?, controls, children }) // one experiment block inside a Stage: title row, controls row, tiles row (children)
Button({ variant?: 'primary'|'secondary'|'ghost', onStage?, disabled?, onClick, children })
Toggle({ label, checked, onChange, onStage?, disabled? })
Chip({ selected, onClick, children, disabled? }) ; ChipGroup({ label?, children })
Checkbox({ checked, onChange, label? })
Callout({ kind: 'note'|'why'|'caution', title, children })
Badge({ source: 'bias'|'dark'|'flat'|'noise'|'external' } | { frame: 'light'|'bias'|'dark'|'flat'|'darkflat' })
ROITile({ title, caption?, state?: 'default'|'pending'|'processing'|'empty', width?, height?, children }) // children = <img> or <canvas>; well fills width, caption under it
FrameCard({ number, label, thumbSrc, histogram: number[], fwhm: number, note, selected, onSelectedChange, state?: 'default'|'selected'|'reference' })
HistogramMini({ bars: number[] }) ; HistogramBars({ bars: number[], width, height })  // bars are 0..1 heights
ProgressBar({ percent, label })
Slider({ label, min, max, step, value, onChange })
NoiseReadout({ value, ratio? })
Icon({ name: 'chevron-left'|'chevron-right'|'chevron-down'|'check'|'close'|'info'|'warning'|'download'|'play'|'stop'|'crosshair'|'star'|'reset'|'eye' })
Logo({ size?: 24|28|32 })
```

## Shared store (`src/shared/store.ts`, owner: foundation; shape fixed here)

```ts
type FlatLevel = null | 10 | 50 | 85;
type AlgorithmName = 'average'|'median'|'kappaSigma'|'winsorized'|'rcr';
type AppState = {
  calibration: { bias: boolean; dark: boolean; darkFlat: boolean; flat: FlatLevel };
  frames: string[];                // selected light ids
  reference: string;               // 'f03' (design fixes it)
  algorithm: { name: AlgorithmName; params: Record<string, number> };
  set: (patch: Partial<Omit<AppState,'set'>>) => void;
};
export const useAppStore = create<AppState>(...)  // defaults: bias true, dark true, darkFlat true, flat 50; frames = the 20 raw ids; reference 'f03'; algorithm median
```
Lesson pages never reset the store; they read/write only the fields they teach.

## Runtime data (`$MAIN/data/derived/runtime`, owner: data)

- `manifest.json`:
```json
{ "reference": "f07", "pixel_scale_arcsec": 0.277,
  "assets": { "<id>": { "id": "f03", "kind": "light|master|flat|darkflat", "width": 6224, "height": 4168,
     "dtype": "u16|f32", "files": { "1": "pixels/f03.b1.u16", "2": "pixels/f03.b2.f32", "4": "pixels/f03.b4.f32", "8": "pixels/f03.b8.f32" },
     "pier_side": "West|East", "defect": "none|satellite|tracking|cloud", "relative_of": null, "H": [9 floats, row-major, canonical(f07)→this frame sensor],
     "header": { "date_obs": "...", "exptime": 300, "ccd_temp": -3.9, "gain": 100, "offset": 160 }, "wbpp_weight": null } } }
```
  Light ids: `f00`…`f19`, `f11_tracking`, `f14_cloud`, `f15_cloud`, `f16_cloud`. Master ids: `bias`, `dark`, `darkflat_10|50|85`, `flat_{10|50|85}_{darkflat|bias|none}`. Masters have no `H`/pier fields. Lights are u16 DN at bin 1; every bin ≥2 and every master is f32 in DN (ADU). Bins are means of b×b blocks (the trailing partial block is dropped: width_b = floor(W/b)). Synthetic frames are stored already flipped to raw orientation.
- Pixel files: raw little-endian, row-major, no header, under `pixels/`.
- JSON copied verbatim from precompute: `frames.json`, `stars.json`, `histograms.json`, `normalization.json`, `masters.json`, `flat_check.json`, served at `/data/<name>.json`.

## ROI API (owner: data) — SPEC §4.3 verbatim
`GET /api/roi?id=<assetId>&x=<int>&y=<int>&w=<int>&h=<int>&bin=<1|2|4|8>`; x,y,w,h in the asset's sensor space at bin 1, multiples of `bin` when bin>1; all optional (whole image). Headers `X-Roi: x,y,w,h`, `X-Width`, `X-Height`, `X-Dtype: u16|f32`, `Content-Type: application/octet-stream`, `Content-Length`, `Cache-Control: no-store`, `Access-Control-Expose-Headers: X-Roi, X-Width, X-Height, X-Dtype`. Streams rows from the file. 404 unknown id, 400 malformed.

## Pipeline (`src/shared/pipeline`, owner: pipeline) — SPEC §4.4, §6

```ts
// src/shared/pipeline/index.ts
export type StackRequest = { grid: { ref: string; x: number; y: number; w: number; h: number; bin: 1|2|4|8 }; frames: string[]; calibration: CalibrationChoice; algorithm: { name: AlgorithmName; params?: Record<string, number> }; align?: boolean };
export type StackResult = { data: Float32Array; w: number; h: number; noise: number; ms: number };
export function stack(req: StackRequest, opts?: { signal?: AbortSignal; onProgress?: (done: number, total: number) => void }): Promise<StackResult>;  // runs in the worker pool, cached
export function fetchRoi(id: string, rect: {x,y,w,h} | null, bin: 1|2|4|8): Promise<{ data: Float32Array; w: number; h: number; rect: {x,y,w,h} }>; // u16 promoted to f32, byte-capped LRU cache
export function calibrateRoi(id: string, rect, bin, calibration): Promise<{ data: Float32Array; w; h }>; // one frame, sensor space, calibrated (§6.2), no warp
export function autoStf(median: number, madn: number, opts?: { targetBg?: number; clip?: number }): { c0: number; m: number }; // PixInsight AutoSTF, matches tools/astro.py; input in DN
export function stfLut(params, lo?, hi?): (x: number) => number; // 0..1 display
export function toImageData(data: Float32Array, w: number, h: number, stf: { c0; m } | { linearLo; linearHi }, opts?: { rotate180?: boolean; nan?: 'stage' }): ImageData;
export function referenceStf(reference: string, calState: string): { c0; m }; // from normalization.json, SPEC §4.5
export function calState(c: CalibrationChoice): string; // §6.1
export function useStack(req: StackRequest | null): { result: StackResult | null; pending: boolean; error?: string };  // React hook, keyed by canonical JSON
export function RoiCanvas(props: { data: Float32Array | null; w: number; h: number; stf: ...; rotate180?: boolean; pixelated?: boolean; width: number; height: number; className? }): JSX.Element;
```
Lessons that need an extra display: `difference(a, b)` centred on mid grey lives in `src/shared/pipeline/display.ts`.

## Dockerfile (owner: data), SPEC §4.7. Image serves `/` and `/api/roi` on 8080 with `data/derived/runtime` baked in at `/data` (`ASTRO_DATA=/data`).
