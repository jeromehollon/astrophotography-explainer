import { describe, expect, it } from 'vitest';
import fx from './__fixtures__/hotpixels.json';
import { inlineExecutor } from './jobs';
import { commonCrop, stackWith, type Sources } from './stack';
import type { Mat3, Rect, StackRequest } from './types';

// 20 real frames (ref f03, bin 2, dark|flat_50_darkflat) on a 56×56 window with 28 pixels the master dark flags
// as hot. What this pins down (tools/golden/make_fixtures.py, section f):
//   1. the browser average and median equal numpy's on the same runtime bin-2 data (masters fetched per pier
//      side, East frames through the 180° flip, NaN samples dropped per pixel);
//   2. what is left of the hot pixels. The master dark takes out only about a third of each hot pixel's excess
//      (docs/design-notes.md §5 item 11), and the frames were dithered in pairs (f00–f03 lie within ~2 native px of
//      each other; f04/f05, f06/f07, … within ~1 px), so on the reference grid a hot pixel is hit by 2–4 of the 20
//      frames and the average keeps ≈ 1/10 of the single-frame excess, several σ of the (4× lower) stack noise.
//      The median, with 2–4 of 20 samples hot, removes it.

const f32 = (a: (number | null)[][]) => Float32Array.from(a.flat().map((v) => (v === null ? NaN : v)));
type Fr = (typeof fx.frames)[number];
const byId = new Map<string, Fr>(fx.frames.map((f) => [f.id, f]));
const lights = new Map<string, Float32Array>(fx.frames.map((f) => [f.id, Float32Array.from(f.light4.flat(), (v) => v / fx.lightScale)]));
const masters = Object.fromEntries(Object.entries(fx.masters).map(([side, m]) => [side, { rect: m.rect, dark: f32(m.dark), flat: f32(m.flat) }]));
const contains = (o: Rect, i: Rect) => i.x >= o.x && i.y >= o.y && i.x + i.w <= o.x + o.w && i.y + i.h <= o.y + o.h;

function cut(src: Float32Array, srcRect: Rect, rect: Rect, bin: number) {
  const sw = srcRect.w / bin, w = rect.w / bin, h = rect.h / bin, ox = (rect.x - srcRect.x) / bin, oy = (rect.y - srcRect.y) / bin;
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) out.set(src.subarray((oy + y) * sw + ox, (oy + y) * sw + ox + w), y * w);
  return { data: out, rect, w, h };
}

const sources: Sources = {
  frame(id) { const f = byId.get(id)!; return { id, width: fx.imageWidth, height: fx.imageHeight, H: f.H as Mat3, east: f.pier_side === 'East' }; },
  norm(id, state) { expect(state).toBe(fx.calState); return byId.get(id)!.norm; },
  fV(fid) { expect(fid).toBe(fx.flatId); return fx.f_v; },
  async fetch(id, rect, bin) {
    expect(bin).toBe(fx.grid.bin);
    const f = byId.get(id);
    if (f) { expect(contains(f.srcRect, rect)).toBe(true); return cut(lights.get(id)!, f.srcRect, rect, bin); }
    // a master: the union of one pier side's footprints, which the fixture stores per side
    const side = Object.keys(masters).find((s) => contains(masters[s].rect, rect));
    expect(side, `master ${id} request ${JSON.stringify(rect)} outside the stored crops`).toBeDefined();
    const m = masters[side!];
    return cut(id === 'dark' ? m.dark : m.flat, m.rect, rect, bin);
  },
};

const req = (name: 'average' | 'median', frames = fx.frames.map((f) => f.id)): StackRequest => ({
  grid: { ...fx.grid, bin: fx.grid.bin as 2 }, frames, calibration: { bias: true, dark: true, darkFlat: true, flat: 50 }, algorithm: { name },
});

function diffStats(a: Float32Array, b: Float32Array) {
  const d: number[] = [];
  for (let i = 0; i < a.length; i++) { expect(Number.isNaN(a[i])).toBe(Number.isNaN(b[i])); if (!Number.isNaN(a[i])) d.push(Math.abs(a[i] - b[i])); }
  d.sort((x, y) => x - y);
  return { median: d[d.length >> 1], p99: d[Math.floor(0.99 * (d.length - 1))], max: d[d.length - 1] };
}

/** Value minus the median of its k×k neighbourhood (edges reflected), as the fixture's local_excess. */
function localExcess(data: Float32Array, w: number, h: number, k: number): Float32Array {
  const r = k >> 1, out = new Float32Array(w * h), win: number[] = [];
  const refl = (i: number, n: number) => (i < 0 ? -i - 1 : i >= n ? 2 * n - i - 1 : i);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    win.length = 0;
    for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) win.push(data[refl(y + j, h) * w + refl(x + i, w)]);
    win.sort((a, b) => a - b);
    out[y * w + x] = data[y * w + x] - win[win.length >> 1];
  }
  return out;
}
const median = (a: ArrayLike<number>) => { const s = Array.from(a).sort((x, y) => x - y); return s.length % 2 ? s[(s.length - 1) / 2] : 0.5 * (s[s.length / 2 - 1] + s[s.length / 2]); };
const madn = (a: ArrayLike<number>) => { const m = median(a); return 1.4826 * median(Array.from(a, (v) => Math.abs(v - m))); };

describe('20-frame bin-2 stack with hot pixels vs the numpy reference', () => {
  const w = fx.grid.w / fx.grid.bin, h = fx.grid.h / fx.grid.bin;
  const excessAt = (data: Float32Array) => {
    const e = localExcess(data, w, h, fx.excessWindow);
    const at = fx.hot.map((p) => e[p.y * w + p.x]);
    const sigma = madn(e);
    return { p50: median(at), sigma, above5: at.filter((v) => v > 5 * sigma).length };
  };

  it('average equals numpy (nanmean of the Lanczos-warped, normalized frames)', async () => {
    const r = await stackWith(req('average'), sources, inlineExecutor);
    expect(r.w).toBe(w); expect(r.h).toBe(h);
    const s = diffStats(r.data, f32(fx.expected.average));
    expect(s.median).toBeLessThan(0.002); expect(s.p99).toBeLessThan(0.01); expect(s.max).toBeLessThan(0.5);
    const e = excessAt(r.data), x = fx.stats.average;
    expect(e.p50).toBeCloseTo(x.excess_p50_dn, 1); expect(e.sigma).toBeCloseTo(x.sigma_dn, 1); expect(e.above5).toBe(x.n_above_5sigma);
  });
  it('median equals numpy (nanmedian)', async () => {
    const r = await stackWith(req('median'), sources, inlineExecutor);
    const s = diffStats(r.data, f32(fx.expected.median));
    expect(s.median).toBeLessThan(0.002); expect(s.max).toBeLessThan(0.5);
    const e = excessAt(r.data), x = fx.stats.median;
    expect(e.p50).toBeCloseTo(x.excess_p50_dn, 1); expect(e.above5).toBe(x.n_above_5sigma);
  });
  it('the reference frame alone equals numpy and shows the hot pixels the dark left behind', async () => {
    const r = await stackWith(req('average', [fx.reference]), sources, inlineExecutor);
    const s = diffStats(r.data, f32(fx.expected.reference));
    expect(s.median).toBeLessThan(0.002); expect(s.max).toBeLessThan(0.5);
    const e = excessAt(r.data), x = fx.stats.reference;
    expect(e.p50).toBeCloseTo(x.excess_p50_dn, 1); expect(e.above5).toBe(x.n_above_5sigma);
  });
  it('hot-pixel residual: the average keeps ~1/10 of the single-frame excess (paired dithers), the median none', () => {
    const ref = fx.stats.reference, avg = fx.stats.average, med = fx.stats.median;
    expect(ref.excess_p50_dn).toBeGreaterThan(4 * ref.sigma_dn);          // hot pixels survive the dark in one frame
    const ratio = avg.excess_p50_dn / ref.excess_p50_dn;
    expect(ratio).toBeGreaterThan(1 / 20); expect(ratio).toBeLessThan(4 / 20); // between "one hit" and "four hits" of 20
    expect(avg.excess_p50_dn).toBeGreaterThan(avg.sigma_dn);              // and still above the stack noise
    expect(avg.n_above_5sigma).toBeGreaterThan(0);
    expect(med.excess_p50_dn).toBeLessThan(med.sigma_dn);                 // the median removes them
    expect(med.n_above_5sigma).toBe(0);
  });
  it('every frame covers this window: commonCrop is the whole grid', () => {
    expect(commonCrop(req('average'), sources)).toEqual({ x: 0, y: 0, w, h });
  });
});
