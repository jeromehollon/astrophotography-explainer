import { describe, expect, it } from 'vitest';
import fx from './__fixtures__/stack.json';
import { inlineExecutor } from './jobs';
import { backgroundNoise, canonicalKey, stackWith, type Sources } from './stack';
import type { AlgorithmName, Mat3, Rect, StackRequest } from './types';

const f32 = (a: (number | null)[][]) => Float32Array.from(a.flat().map((v) => (v === null ? NaN : v)));

type Fr = (typeof fx.frames)[number];
const byId = new Map<string, Fr>(fx.frames.map((f) => [f.id, f]));
const arrays = new Map<string, { light: Float32Array; dark: Float32Array; flat: Float32Array }>();
for (const f of fx.frames) arrays.set(f.id, { light: f32(f.light), dark: f32(f.dark), flat: f32(f.flat) });

/** Serves sub-rects out of the fixture crops, checking that every request is inside what we stored. */
const sources: Sources = {
  frame(id) {
    const f = byId.get(id)!;
    return { id, width: fx.imageWidth, height: fx.imageHeight, H: f.H as Mat3, east: f.pier_side === 'East' };
  },
  norm(id, state) {
    expect(state).toBe(fx.calState);
    return id === fx.reference && !byId.has(id) ? fx.refNorm : byId.get(id)!.norm;
  },
  fV(fid) { expect(fid).toBe(fx.flatId); return fx.f_v; },
  async fetch(id, rect, bin) {
    expect(bin).toBe(1);
    // Masters are requested for the union of the frames' footprints per pier side; the union of footprints lies
    // inside the union of the stored crops, and every crop of a master holds the same pixels, so assemble per pixel.
    const kind = id === 'dark' ? 'dark' : id === fx.flatId ? 'flat' : 'light';
    const holders = kind === 'light' ? [byId.get(id)!] : fx.frames;
    if (kind === 'light') expect(contains(holders[0].srcRect, rect)).toBe(true);
    const out = new Float32Array(rect.w * rect.h).fill(NaN);
    for (let y = 0; y < rect.h; y++)
      for (let x = 0; x < rect.w; x++) {
        const px = rect.x + x, py = rect.y + y;
        const hld = holders.find((f) => px >= f.srcRect.x && px < f.srcRect.x + f.srcRect.w && py >= f.srcRect.y && py < f.srcRect.y + f.srcRect.h);
        if (!hld) continue; // bounding-box corner no frame reads; stays NaN
        out[y * rect.w + x] = arrays.get(hld.id)![kind][(py - hld.srcRect.y) * hld.srcRect.w + (px - hld.srcRect.x)];
      }
    return { data: out, rect, w: rect.w, h: rect.h };
  },
};
function contains(o: Rect, i: Rect) { return i.x >= o.x && i.y >= o.y && i.x + i.w <= o.x + o.w && i.y + i.h <= o.y + o.h; }

const req = (name: AlgorithmName): StackRequest => ({
  grid: { ...fx.grid, bin: 1 },
  frames: fx.frames.map((f) => f.id),
  calibration: { bias: true, dark: true, darkFlat: true, flat: 50 },
  algorithm: { name },
});

function diffStats(a: Float32Array, b: Float32Array) {
  const d: number[] = [];
  for (let i = 0; i < a.length; i++) { expect(Number.isNaN(a[i])).toBe(Number.isNaN(b[i])); if (!Number.isNaN(a[i])) d.push(Math.abs(a[i] - b[i])); }
  d.sort((x, y) => x - y);
  return { median: d[d.length >> 1], max: d[d.length - 1] };
}

describe('8-frame 32×32 stack vs the numpy reference (SPEC M2-02)', () => {
  for (const name of ['average', 'median', 'kappaSigma', 'winsorized', 'rcr'] as const) {
    it(name, async () => {
      const r = await stackWith(req(name), sources, inlineExecutor);
      expect(r.w).toBe(32); expect(r.h).toBe(32);
      const s = diffStats(r.data, f32(fx.expected[name]));
      expect(s.median).toBeLessThan(0.01);
      expect(s.max).toBeLessThan(0.05);
      expect(r.noise).toBeGreaterThan(0);
      expect(r.noise).toBeLessThan(fx.refNorm.madn_dn); // stacking reduced the noise
    });
  }
  it('reports progress and honours abort', async () => {
    const calls: [number, number][] = [];
    await stackWith(req('median'), sources, inlineExecutor, { onProgress: (d, t) => calls.push([d, t]) });
    expect(calls[calls.length - 1]).toEqual([9, 9]);
    const ac = new AbortController(); ac.abort();
    await expect(stackWith(req('median'), sources, inlineExecutor, { signal: ac.signal })).rejects.toMatchObject({ name: 'AbortError' });
  });
  it('align:false reads every frame on the reference grid (no warp)', async () => {
    const r = await stackWith({ ...req('average'), frames: ['f03'], align: false }, sources, inlineExecutor);
    const ref = await stackWith({ ...req('average'), frames: ['f03'] }, sources, inlineExecutor);
    const s = diffStats(r.data, ref.data);
    expect(s.max).toBeLessThan(0.01); // f03 is the reference: warp is the identity
  });
  it('canonical key is order-insensitive and fills default params', () => {
    const a = canonicalKey({ ...req('kappaSigma'), frames: ['f01', 'f00'] });
    const b = canonicalKey({ ...req('kappaSigma'), frames: ['f00', 'f01'], algorithm: { name: 'kappaSigma', params: { sigmaHigh: 3, sigmaLow: 4 } } });
    expect(a).toBe(b);
  });
  it('backgroundNoise ignores stars and NaN', () => {
    const d = new Float32Array(10000);
    for (let i = 0; i < d.length; i++) d[i] = 700 + 10 * Math.sin(i * 12.9898) * Math.cos(i * 78.233) * 3;
    d[5] = 60000; d[6] = NaN;
    const n = backgroundNoise(d);
    expect(n).toBeGreaterThan(5); expect(n).toBeLessThan(40);
  });
});
