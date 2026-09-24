import { describe, expect, it } from 'vitest';
import fx from './__fixtures__/integrate.json';
import { erf, erfinv, integrate1d, integrateFrames } from './integrate';
import type { AlgorithmName } from './types';

const col = (k: number) => fx.stacks.map((row) => (row[k] === null ? NaN : (row[k] as number)));

describe('special functions', () => {
  it('erf agrees with known values', () => {
    expect(erf(0)).toBe(0);
    expect(erf(0.5)).toBeCloseTo(0.5204998778130465, 12);
    expect(erf(1)).toBeCloseTo(0.8427007929497149, 12);
    expect(erf(2)).toBeCloseTo(0.9953222650189527, 12);
    expect(erf(3)).toBeCloseTo(0.9999779095030014, 12);
    expect(erf(4)).toBeCloseTo(0.9999999845827421, 12);
    expect(erf(-1.5)).toBeCloseTo(-0.9661051464753108, 12);
  });
  it('erfinv inverts erf', () => {
    for (const y of [-0.99, -0.5, -0.1, 0.05, 0.3, 0.7, 0.9, 0.999]) expect(erf(erfinv(y))).toBeCloseTo(y, 11);
  });
});

describe('integration matches the numpy reference on 12-sample stacks (wbpp §4.6)', () => {
  const n = fx.stacks[0].length;
  for (const [key, e] of Object.entries(fx.expected)) {
    if (key === 'winsorized_precompute_py') continue;
    it(key, () => {
      for (let k = 0; k < n; k++) {
        const got = integrate1d(col(k), e.method as AlgorithmName, e.params);
        const exp = e.values[k];
        if (exp === null) expect(Number.isNaN(got)).toBe(true);
        else expect(got).toBeCloseTo(exp as number, 3);
      }
    });
  }
  it('winsorized is close to tools/precompute/integrate.py (MAD start instead of Sn)', () => {
    const e = fx.expected.winsorized_precompute_py;
    e.columns.forEach((k, i) => {
      const got = integrate1d(col(k), 'winsorized', e.params);
      expect(Math.abs(got - (e.values[i] as number))).toBeLessThan(6); // different starting sigma and clamp scheme
    });
  });
  it('kappa-sigma 3 cannot reject one outlier among 5 frames (SPEC §6.6 teaching note)', () => {
    expect(integrate1d([100, 101, 99, 100, 5000], 'kappaSigma', { sigmaLow: 4, sigmaHigh: 3 })).toBeCloseTo(1080, 6);
    expect(integrate1d([100, 101, 99, 100, 5000], 'winsorized')).toBeCloseTo(100, 6);
    expect(integrate1d([100, 101, 99, 100, 5000], 'median')).toBe(100);
  });
  it('integrateFrames handles NaN and row bands', () => {
    const w = 4, h = 3;
    const frames = [1, 2, 3, 40].map((v) => new Float32Array(w * h).fill(v));
    frames[3][0] = NaN; frames[0][1] = NaN; frames[1][1] = NaN; frames[2][1] = NaN; frames[3][1] = NaN;
    const out = integrateFrames(frames, w, h, 'median');
    expect(out[0]).toBe(2);
    expect(Number.isNaN(out[1])).toBe(true);
    expect(out[5]).toBe(2.5);
    const band = integrateFrames(frames, w, h, 'average', {}, new Float32Array(w * h).fill(-1), 1, 2);
    expect(band[0]).toBe(-1);
    expect(band[4]).toBe(11.5);
  });
});
