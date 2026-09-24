import { describe, expect, it } from 'vitest';
import { applyH, flipMatrix, footprint, mat3Inv, mat3Mul, outputToFrame, scaleMatrix } from './geometry';
import type { Mat3 } from './types';

const H03: Mat3 = [0.999652951964561, -5.818927138581339e-05, -26.30298664345548, 0.0001535357195439719, 0.9996229809630736, -26.27018134263182, -1.541782933032526e-09, 1.722688869336833e-08, 1.0];
const H08: Mat3 = [-1.0006, 0.0054, 6298.5805, -0.0046, -1.0009, 4238.4696, 0, 0, 1];
const I: Mat3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];

describe('geometry', () => {
  it('inverse round-trips', () => {
    const p = mat3Mul(H03, mat3Inv(H03));
    p.forEach((v, i) => expect(v).toBeCloseTo(I[i], 9));
  });
  it('S_b puts bin-b sample centres at b·i + (b−1)/2', () => {
    expect(applyH(scaleMatrix(2), 0, 0)).toEqual([0.5, 0.5]);
    expect(applyH(scaleMatrix(4), 3, 1)).toEqual([13.5, 5.5]);
  });
  it('F_r rotates about the image centre for East references only', () => {
    expect(applyH(flipMatrix(6224, 4168, true), 0, 0)).toEqual([6223, 4167]);
    expect(flipMatrix(6224, 4168, false)).toEqual(I);
  });
  it('M for the reference itself is the identity (West) at every bin', () => {
    for (const b of [1, 2, 4, 8] as const) {
      const M = outputToFrame(H03, H03, I, b);
      M.forEach((v, i) => expect(v).toBeCloseTo(I[i], 8));
    }
  });
  it('M at bin 2 is the bin-1 map conjugated by S_2', () => {
    const M1 = outputToFrame(H03, I, I, 1);
    const M2 = outputToFrame(H03, I, I, 2);
    const [x1, y1] = applyH(M1, 2 * 100 + 0.5, 2 * 50 + 0.5); // native centre of bin-2 sample (100,50)
    const [x2, y2] = applyH(M2, 100, 50);
    expect(2 * x2 + 0.5).toBeCloseTo(x1, 9);
    expect(2 * y2 + 0.5).toBeCloseTo(y1, 9);
  });
  it('footprint covers the mapped rect plus the Lanczos radius, on the bin grid', () => {
    const r = footprint(H03, { x: 2000, y: 1500, w: 96, h: 96 }, 1, 6224, 4168)!;
    expect(r.x).toBeLessThanOrEqual(1974 - 4);
    expect(r.x + r.w).toBeGreaterThanOrEqual(2069 + 4);
    const r2 = footprint(H03, { x: 2000, y: 1500, w: 96, h: 96 }, 2, 6224, 4168)!;
    expect(r2.x % 2).toBe(0); expect(r2.w % 2).toBe(0);
  });
  it('footprint clamps to the image and is null when it misses it', () => {
    expect(footprint(H08, { x: 0, y: 0, w: 64, h: 64 }, 1, 6224, 4168)).toBeNull(); // East frame: (0,0) maps beyond (6224,4168)
    const r = footprint(I, { x: -20, y: -20, w: 64, h: 64 }, 4, 6224, 4168)!;
    expect(r.x).toBe(0); expect(r.y).toBe(0);
  });
});
