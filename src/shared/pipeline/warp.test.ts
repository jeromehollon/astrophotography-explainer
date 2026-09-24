import { describe, expect, it } from 'vitest';
import fx from './__fixtures__/warp.json';
import { applyH, footprint, outputToFrame, rectContains } from './geometry';
import type { Mat3 } from './types';
import { binMean, lanczos3, lanczos3Exact, warpLanczos3 } from './warp';

const f32 = (a: (number | null)[][]) => Float32Array.from(a.flat().map((v) => (v === null ? NaN : v)));
const I: Mat3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];

function stats(a: Float32Array, b: Float32Array, mask?: (i: number) => boolean) {
  const d: number[] = [];
  for (let i = 0; i < a.length; i++) if (!mask || mask(i)) d.push(Math.abs(a[i] - b[i]));
  d.sort((x, y) => x - y);
  return { median: d[d.length >> 1], p99: d[Math.floor(0.99 * (d.length - 1))], max: d[d.length - 1], n: d.length };
}

describe('Lanczos-3 kernel', () => {
  it('LUT matches the exact kernel to 1e-7', () => {
    for (let t = -3; t <= 3; t += 0.0137) expect(Math.abs(lanczos3(t) - lanczos3Exact(t))).toBeLessThan(1e-7);
    expect(lanczos3(0)).toBe(1);
    expect(lanczos3(1)).toBeCloseTo(0, 7);
    expect(lanczos3(3)).toBe(0);
  });
  it('identity transform on integer positions copies the source exactly', () => {
    const w = 10, h = 8;
    const data = Float32Array.from({ length: w * h }, (_, i) => 100 + (i * 37) % 91);
    const out = warpLanczos3({ data, x: 0, y: 0, w, h, imageW: w, imageH: h }, I, 0, 0, w, h);
    out.forEach((v, i) => expect(v).toBeCloseTo(data[i], 4));
  });
  it('samples outside the image are NaN', () => {
    const w = 10, h = 8;
    const data = new Float32Array(w * h).fill(5);
    const M: Mat3 = [1, 0, -3, 0, 1, 0, 0, 0, 1];
    const out = warpLanczos3({ data, x: 0, y: 0, w, h, imageW: w, imageH: h }, M, 0, 0, w, h);
    expect(Number.isNaN(out[0])).toBe(true);
    expect(Number.isNaN(out[2])).toBe(true);
    expect(out[3]).toBeCloseTo(5, 5);
  });
});

describe('warp of f03 vs PixInsight _r.xisf at bin 1 (SPEC M2-02)', () => {
  const H = fx.H as Mat3;
  const src = { data: f32(fx.src), x: fx.srcRect.x, y: fx.srcRect.y, w: fx.srcRect.w, h: fx.srcRect.h, imageW: fx.imageWidth, imageH: fx.imageHeight };
  const M = outputToFrame(H, I, I, 1);
  const { x, y, w, h } = fx.outRect;
  const out = warpLanczos3(src, M, x, y, w, h);
  const pi = f32(fx.expectedPixInsight);
  const np = f32(fx.expectedNumpy);
  it('the footprint lies inside the fixture crop', () => {
    const foot = footprint(H, fx.outRect, 1, fx.imageWidth, fx.imageHeight)!;
    expect(rectContains(fx.srcRect, foot)).toBe(true);
  });
  it('matches the numpy reference to 0.01 DN', () => {
    const s = stats(out, np);
    expect(s.max).toBeLessThan(0.02);
  });
  it('matches PixInsight within u16 rounding (max 0.51 DN) and a few DN near stars', () => {
    const s = stats(out, pi);
    expect(s.median).toBeLessThan(0.5);
    expect(s.p99).toBeLessThan(2);
    expect(s.max).toBeLessThan(4);
    const bg = stats(out, pi, (i) => pi[i] < 2000);
    expect(bg.max).toBeLessThan(0.75);
  });
  it('bin 2 geometry: warping the binned image samples the same native positions as bin 1', () => {
    // Smooth synthetic frame (a plane plus a wide Gaussian): Lanczos reproduces it closely at any bin, so
    // bin-then-warp must agree with warp-then-bin; on real noisy data the two average different pixels.
    const W = 240, Hh = 200;
    const img = new Float32Array(W * Hh);
    const f = (x: number, y: number) => 1000 + 3 * x + 2 * y + 800 * Math.exp(-((x - 120) ** 2 + (y - 90) ** 2) / 900);
    for (let yy = 0; yy < Hh; yy++) for (let xx = 0; xx < W; xx++) img[yy * W + xx] = f(xx, yy);
    const th = 0.01, Hm: Mat3 = [Math.cos(th), -Math.sin(th), 7.3, Math.sin(th), Math.cos(th), -4.6, 0, 0, 1];
    const rect = { x: 40, y: 40, w: 120, h: 96 };
    const out1 = warpLanczos3({ data: img, x: 0, y: 0, w: W, h: Hh, imageW: W, imageH: Hh }, outputToFrame(Hm, I, I, 1), rect.x, rect.y, rect.w, rect.h);
    const b1 = binMean(out1, rect.w, rect.h, 2);
    const imgB = binMean(img, W, Hh, 2);
    const out2 = warpLanczos3({ data: imgB.data, x: 0, y: 0, w: imgB.w, h: imgB.h, imageW: imgB.w, imageH: imgB.h }, outputToFrame(Hm, I, I, 2), rect.x / 2, rect.y / 2, rect.w / 2, rect.h / 2);
    const s = stats(out2, b1.data);
    expect(s.n).toBe(60 * 48);
    expect(s.max).toBeLessThan(1.5);
    expect(s.median).toBeLessThan(0.3);
    // and against the analytic function at the mapped native block centre (= S_2 conjugation, SPEC §6.4)
    const M1 = outputToFrame(Hm, I, I, 1);
    let worst = 0;
    for (let v = 0; v < 48; v++) for (let u = 0; u < 60; u++) {
      const [sx, sy] = applyH(M1, rect.x + 2 * u + 0.5, rect.y + 2 * v + 0.5);
      worst = Math.max(worst, Math.abs(out2[v * 60 + u] - f(sx, sy)));
    }
    expect(worst).toBeLessThan(2);
  });
});
