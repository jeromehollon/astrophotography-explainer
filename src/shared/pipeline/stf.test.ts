import { describe, expect, it } from 'vitest';
import fx from './__fixtures__/stf.json';
import { autoStf, medianMadn, mtf, stfLut } from './stf';

describe('AutoSTF matches tools/astro.py', () => {
  for (const c of fx.cases) {
    it(`${c.name} target ${c.targetBg} clip ${c.clip}`, () => {
      const p = autoStf(c.median_dn, c.madn_dn, { targetBg: c.targetBg, clip: c.clip });
      expect(Math.abs(p.c0 - c.c0_dn)).toBeLessThan(1e-3); // astro.py works on a float32 crop
      expect(p.m).toBeCloseTo(c.m, 6);
      const lut = stfLut(p);
      c.samples_dn.forEach((x, i) => expect(lut(x)).toBeCloseTo(c.expected[i], 5));
    });
  }
  it('mtf fixes 0, 1 and maps m to 0.5', () => {
    expect(mtf(0.3, 0)).toBe(0);
    expect(mtf(0.3, 1)).toBeCloseTo(1, 12);
    expect(mtf(0.3, 0.3)).toBeCloseTo(0.5, 12);
  });
  it('medianMadn ignores NaN', () => {
    const r = medianMadn(new Float32Array([1, 2, 3, NaN, 4, 100]));
    expect(r.n).toBe(5);
    expect(r.median).toBe(3);
  });
});
