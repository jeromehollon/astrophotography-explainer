import { describe, expect, it } from 'vitest';
import fx from './__fixtures__/calibrate.json';
import { calState, calibrate, flatId, lightSub, subtractId } from './calibrate';

const f32 = (a: (number | null)[][]) => Float32Array.from(a.flat().map((v) => (v === null ? NaN : v)));

describe('calibration choice → WBPP masters (SPEC §6.1)', () => {
  it('drops the bias for lights when a dark is selected', () => {
    expect(lightSub({ bias: true, dark: true, darkFlat: true, flat: 50 })).toBe('dark');
    expect(calState({ bias: true, dark: true, darkFlat: true, flat: 50 })).toBe('dark|flat_50_darkflat');
    expect(calState({ bias: true, dark: false, darkFlat: false, flat: 10 })).toBe('bias|flat_10_bias');
    expect(calState({ bias: false, dark: false, darkFlat: false, flat: null })).toBe('none|none');
    expect(calState({ bias: false, dark: true, darkFlat: false, flat: 85 })).toBe('dark|flat_85_none');
    expect(flatId({ bias: true, dark: false, darkFlat: true, flat: null })).toBeNull();
    expect(subtractId({ bias: true, dark: false, darkFlat: false, flat: null })).toBe('bias');
  });
});

describe('calibrate matches the numpy formula on a 64×64 crop of f03', () => {
  const L = f32(fx.light), D = f32(fx.dark), B = f32(fx.bias);
  it('dark|flat_50_darkflat', () => {
    const out = calibrate(L, D, f32(fx.flat_50_darkflat), fx.f_v.flat_50_darkflat);
    const exp = f32(fx.expected['dark|flat_50_darkflat']);
    out.forEach((v, i) => expect(Math.abs(v - exp[i])).toBeLessThan(0.02));
  });
  it('bias|flat_10_bias', () => {
    const out = calibrate(L, B, f32(fx.flat_10_bias), fx.f_v.flat_10_bias);
    const exp = f32(fx.expected['bias|flat_10_bias']);
    out.forEach((v, i) => expect(Math.abs(v - exp[i])).toBeLessThan(0.02));
  });
  it('dark|none and none|none', () => {
    const out = calibrate(L, D, null);
    const exp = f32(fx.expected['dark|none']);
    out.forEach((v, i) => expect(Math.abs(v - exp[i])).toBeLessThan(0.002));
    expect(calibrate(L, null, null)).toEqual(L);
  });
});
