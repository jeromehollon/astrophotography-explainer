// stack(): per frame footprint → fetch light + masters at the same bin → calibrate → warp → normalize, then
// integrate (SPEC §4.4). Big outputs go through bands of ~256 rows so peak memory stays flat.

import { ByteLru } from '../data/lru';
import { fetchManifest, fetchMasters, fetchNormalization } from '../data/json';
import { fetchRoi } from '../data/roi';
import type { Asset } from '../data/types';
import { calibrate, calState, flatId as flatIdOf, subtractId } from './calibrate';
import { applyH, flipMatrix, footprint, mat3Inv, mat3Mul, outputToFrame, scaleMatrix, unionRect } from './geometry';
import { DEFAULT_PARAMS } from './integrate';
import type { Executor, FrameJob } from './jobs';
import { getExecutor } from './pool';
import { normCoeff, type NormStats } from './normalize';
import { medianMadn } from './stf';
import type { Bin, Mat3, Rect, StackRequest, StackResult } from './types';

export type FrameInfo = { id: string; width: number; height: number; H: Mat3; east: boolean };

/** Everything stack() needs from the data layer; tests inject fixtures here. */
export type Sources = {
  frame(id: string): FrameInfo;
  norm(id: string, state: string): NormStats;
  fV(flatId: string): number;
  fetch(id: string, rect: Rect, bin: Bin, signal?: AbortSignal): Promise<{ data: Float32Array; rect: Rect; w: number; h: number }>;
};

export const BAND_ROWS = 256;
const BAND_THRESHOLD = 1_500_000; // output samples above which we band

export function canonicalKey(req: StackRequest): string {
  const { grid, calibration, algorithm } = req;
  const params = { ...DEFAULT_PARAMS[algorithm.name], ...(algorithm.params ?? {}) };
  return JSON.stringify({
    grid: { ref: grid.ref, x: grid.x, y: grid.y, w: grid.w, h: grid.h, bin: grid.bin },
    frames: [...req.frames].sort(),
    calibration: { bias: !!calibration.bias, dark: !!calibration.dark, darkFlat: !!calibration.darkFlat, flat: calibration.flat ?? null },
    algorithm: { name: algorithm.name, params: Object.fromEntries(Object.keys(params).sort().map((k) => [k, params[k]])) },
    align: req.align !== false,
  });
}

export const resultCache = new ByteLru<StackResult>(512 * 1024 * 1024);

function abortError(): Error {
  return typeof DOMException !== 'undefined' ? new DOMException('stack aborted', 'AbortError') : Object.assign(new Error('stack aborted'), { name: 'AbortError' });
}

function throwIfAborted(signal?: AbortSignal) { if (signal?.aborted) throw abortError(); }

type Plan = {
  id: string; info: FrameInfo;
  Mnative: Mat3; Mbin: Mat3;
  norm: NormStats;
};

/** Native-unit transform output ref grid → frame i sensor (bin 1). */
export function frameTransform(fi: FrameInfo, ref: FrameInfo, align: boolean): Mat3 {
  const Fr = flipMatrix(ref.width, ref.height, ref.east);
  if (!align) return Fr; // naive: every frame read on the reference's own (oriented) grid
  return mat3Mul(fi.H, mat3Mul(mat3Inv(ref.H), Fr));
}

function crop(src: { data: Float32Array; rect: Rect; w: number; h: number }, rect: Rect, bin: Bin): Float32Array {
  const ox = (rect.x - src.rect.x) / bin, oy = (rect.y - src.rect.y) / bin;
  const w = rect.w / bin, h = rect.h / bin;
  if (ox === 0 && oy === 0 && w === src.w && h === src.h) return src.data;
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) out.set(src.data.subarray((oy + y) * src.w + ox, (oy + y) * src.w + ox + w), y * w);
  return out;
}

/** Robust noise readout: MADN of the background after clipping stars (> median + 3·MADN), in DN. */
export function backgroundNoise(data: Float32Array): number {
  const first = medianMadn(data);
  if (!first.n) return NaN;
  const hi = first.median + 3 * first.madn;
  const bg = new Float32Array(first.n);
  let n = 0;
  for (let i = 0; i < data.length; i++) { const x = data[i]; if (x === x && x <= hi) bg[n++] = x; }
  return medianMadn(bg.subarray(0, n)).madn;
}

/** Run a stack against explicit sources and executor (tests, node). */
export async function stackWith(
  req: StackRequest, sources: Sources, exec: Executor,
  opts: { signal?: AbortSignal; onProgress?: (done: number, total: number) => void } = {},
): Promise<StackResult> {
  const t0 = performance.now();
  const { grid } = req;
  const bin = grid.bin;
  const align = req.align !== false;
  if ([grid.x, grid.y, grid.w, grid.h].some((v) => v % bin)) throw new Error('grid rect must be a multiple of bin');
  const ref = sources.frame(grid.ref);
  const state = calState(req.calibration);
  const darkId = subtractId(req.calibration);
  const flatId = flatIdOf(req.calibration);
  const fV = flatId ? sources.fV(flatId) : 1;
  const refNorm = sources.norm(grid.ref, state);
  const ids = [...new Set(req.frames)];
  const plans: Plan[] = ids.map((id) => {
    const info = sources.frame(id);
    const Mnative = frameTransform(info, ref, align);
    const S = scaleMatrix(bin);
    const Mbin = mat3Mul(mat3Inv(S), mat3Mul(Mnative, S));
    return { id, info, Mnative, Mbin, norm: sources.norm(id, state) };
  });

  const outW = grid.w / bin, outH = grid.h / bin;
  const banded = outW * outH > BAND_THRESHOLD;
  const bandRows = banded ? BAND_ROWS : outH;
  const bands: { y0: number; rows: number }[] = [];
  for (let y = 0; y < outH; y += bandRows) bands.push({ y0: y, rows: Math.min(bandRows, outH - y) });
  const total = bands.length * (plans.length + 1);
  let done = 0;
  const progress = () => opts.onProgress?.(done, total);
  progress();

  const out = new Float32Array(outW * outH);
  for (const band of bands) {
    throwIfAborted(opts.signal);
    const outRect: Rect = { x: grid.x, y: grid.y + band.y0 * bin, w: grid.w, h: band.rows * bin };
    // Footprints, and a union per pier side for the masters.
    const feet = plans.map((p) => footprint(p.Mnative, outRect, bin, p.info.width, p.info.height));
    const unions = new Map<boolean, Rect | null>();
    plans.forEach((p, i) => { if (feet[i]) unions.set(p.info.east, unionRect(unions.get(p.info.east) ?? null, feet[i])); });
    const masterFetch = new Map<string, Promise<{ data: Float32Array; rect: Rect; w: number; h: number }>>();
    const master = (mid: string, east: boolean) => {
      const key = `${mid}|${east}`;
      let p = masterFetch.get(key);
      if (!p) { p = sources.fetch(mid, unions.get(east)!, bin, opts.signal); masterFetch.set(key, p); }
      return p;
    };
    const jobs = plans.map(async (p, i) => {
      const foot = feet[i];
      if (!foot) { done++; progress(); return null; }
      const [light, dark, flat] = await Promise.all([
        sources.fetch(p.id, foot, bin, opts.signal),
        darkId ? master(darkId, p.info.east) : null,
        flatId ? master(flatId, p.info.east) : null,
      ]);
      throwIfAborted(opts.signal);
      const job: FrameJob = {
        light: light.data,
        dark: dark ? crop(dark, light.rect, bin) : null,
        flat: flat ? crop(flat, light.rect, bin) : null,
        fV,
        src: { x: light.rect.x / bin, y: light.rect.y / bin, w: light.w, h: light.h },
        imageW: Math.floor(p.info.width / bin), imageH: Math.floor(p.info.height / bin),
        M: p.Mbin,
        ox: outRect.x / bin, oy: outRect.y / bin, outW, outH: band.rows,
        norm: normCoeff(p.norm, refNorm),
      };
      const r = await exec.frame(job);
      done++; progress();
      return r;
    });
    const warped = (await Promise.all(jobs)).filter((f): f is Float32Array => !!f);
    throwIfAborted(opts.signal);
    const params = { ...DEFAULT_PARAMS[req.algorithm.name], ...(req.algorithm.params ?? {}) };
    if (warped.length === 0) {
      out.fill(NaN, band.y0 * outW, (band.y0 + band.rows) * outW);
    } else {
      const lanes = Math.max(1, Math.min(exec.lanes, Math.floor((band.rows * outW) / 65536)));
      const chunk = Math.ceil(band.rows / lanes);
      const parts: Promise<Float32Array>[] = [];
      for (let r0 = 0; r0 < band.rows; r0 += chunk) {
        const r1 = Math.min(band.rows, r0 + chunk);
        parts.push(exec.integrate({ frames: warped, w: outW, h: band.rows, name: req.algorithm.name, params, row0: r0, row1: r1 }));
      }
      const results = await Promise.all(parts);
      let r0 = 0;
      for (const res of results) { out.set(res, (band.y0 + r0) * outW); r0 += res.length / outW; }
    }
    done++; progress();
  }
  throwIfAborted(opts.signal);
  return { data: out, w: outW, h: outH, noise: backgroundNoise(out), ms: performance.now() - t0 };
}

// ---------------------------------------------------------------- live sources from /data + /api/roi

let liveSources: Promise<Sources> | null = null;

function assetInfo(a: Asset): FrameInfo {
  return { id: a.id, width: a.width, height: a.height, H: (a.H ?? [1, 0, 0, 0, 1, 0, 0, 0, 1]) as Mat3, east: a.pier_side === 'East' };
}

export function getLiveSources(): Promise<Sources> {
  if (!liveSources) {
    liveSources = Promise.all([fetchManifest(), fetchNormalization(), fetchMasters()]).then(([manifest, norm, masters]) => ({
      frame(id) {
        const a = manifest.assets[id];
        if (!a) throw new Error(`unknown asset ${id}`);
        return assetInfo(a);
      },
      norm(id, state) {
        const s = norm.frames[id]?.states[state];
        if (!s) throw new Error(`no normalization for ${id} ${state}`);
        return s;
      },
      fV(fid) {
        const m = masters[fid];
        if (!m?.scale_f_v) throw new Error(`no f_v for ${fid}`);
        return m.scale_f_v.dn;
      },
      fetch: (id, rect, bin, signal) => fetchRoi(id, rect, bin, { signal }),
    }));
    liveSources.catch(() => { liveSources = null; });
  }
  return liveSources;
}

/** Public entry: worker pool + result LRU keyed by the canonical request JSON. */
export async function stack(req: StackRequest, opts: { signal?: AbortSignal; onProgress?: (done: number, total: number) => void } = {}): Promise<StackResult> {
  const key = canonicalKey(req);
  const hit = resultCache.get(key);
  if (hit) { opts.onProgress?.(1, 1); return hit; }
  const sources = await getLiveSources();
  const res = await stackWith(req, sources, getExecutor(), opts);
  resultCache.set(key, res, res.data.byteLength);
  return res;
}

/** One frame, sensor space, calibrated (§6.2), no warp. `rect` in bin-1 units (multiples of bin) or null = whole frame. */
export async function calibrateRoi(id: string, rect: Rect | null, bin: Bin, calibration: StackRequest['calibration'], opts: { signal?: AbortSignal } = {}): Promise<{ data: Float32Array; w: number; h: number; rect: Rect }> {
  const sources = await getLiveSources();
  const darkId = subtractId(calibration);
  const flatId = flatIdOf(calibration);
  const info = sources.frame(id);
  const full: Rect = { x: 0, y: 0, w: Math.floor(info.width / bin) * bin, h: Math.floor(info.height / bin) * bin };
  const r = rect ?? full;
  const [light, dark, flat] = await Promise.all([
    sources.fetch(id, r, bin, opts.signal),
    darkId ? sources.fetch(darkId, r, bin, opts.signal) : null,
    flatId ? sources.fetch(flatId, r, bin, opts.signal) : null,
  ]);
  const data = calibrate(light.data, dark ? crop(dark, light.rect, bin) : null, flat ? crop(flat, light.rect, bin) : null, flatId ? sources.fV(flatId) : 1);
  return { data, w: light.w, h: light.h, rect: light.rect };
}

/** Where the output rect of `grid` lands in frame `id`'s sensor (bin-1), for ROI markers on the reference view. */
export function gridToSensor(grid: StackRequest['grid'], id: string, sources: Sources, align = true): Rect | null {
  const info = sources.frame(id), ref = sources.frame(grid.ref);
  return footprint(frameTransform(info, ref, align), { x: grid.x, y: grid.y, w: grid.w, h: grid.h }, 1, info.width, info.height);
}

export { applyH, outputToFrame };
