import { describe, expect, it } from 'vitest';
import { ownStf } from './live';

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
