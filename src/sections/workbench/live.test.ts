import { describe, expect, it } from 'vitest';
import { commonCropRect, cropResult, ownStf } from './live';

function grid(w: number, h: number, fill: (x: number, y: number) => number): Float32Array {
  const d = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) d[y * w + x] = fill(x, y);
  return d;
}

describe('commonCropRect', () => {
  it('returns the whole grid when nothing is missing', () => {
    expect(commonCropRect(grid(40, 30, () => 1), 40, 30)).toEqual({ x: 0, y: 0, w: 40, h: 30 });
  });
  it('trims a fully missing column strip and a ragged (rotated) top edge', () => {
    // right 3 columns missing everywhere; top edge missing along a diagonal (rotation-like), 3 rows deep
    const d = grid(200, 100, (x, y) => (x >= 197 || y < 3 - Math.floor(x / 70) ? NaN : 1));
    const r = commonCropRect(d, 200, 100);
    expect(r.x + r.w).toBe(197);
    expect(r.x).toBe(0);
    expect(r.y).toBeGreaterThanOrEqual(1);
    expect(r.y + r.h).toBe(100);
    // no interior row or column of the crop has 0.5 % or more missing
    for (let y = r.y; y < r.y + r.h; y++) { let n = 0; for (let x = r.x; x < r.x + r.w; x++) if (Number.isNaN(d[y * 200 + x])) n++; expect(n / r.w).toBeLessThan(0.005); }
  });
  it('keeps the grid when everything is missing', () => {
    expect(commonCropRect(grid(8, 8, () => NaN), 8, 8)).toEqual({ x: 0, y: 0, w: 8, h: 8 });
  });
});

describe('cropResult', () => {
  it('copies the rectangle row by row', () => {
    const res = { data: grid(4, 3, (x, y) => y * 10 + x), w: 4, h: 3, noise: 1, ms: 0 };
    const c = cropResult(res, { x: 1, y: 1, w: 2, h: 2 });
    expect([...c.data]).toEqual([11, 12, 21, 22]);
    expect(cropResult(res, { x: 0, y: 0, w: 4, h: 3 })).toBe(res);
  });
});

describe('ownStf', () => {
  it('puts the image median at the target background and ignores NaN', () => {
    const d = new Float32Array(10000);
    for (let i = 0; i < d.length; i++) d[i] = 1000 + ((i * 7919) % 200) - 100; // median ≈ 1000, spread ±100
    d[5] = NaN;
    const p = ownStf(d);
    expect(p.c0).toBeGreaterThan(700);
    expect(p.c0).toBeLessThan(1000);
    expect(p.m).toBeGreaterThan(0);
    expect(p.m).toBeLessThan(0.05);
  });
});
