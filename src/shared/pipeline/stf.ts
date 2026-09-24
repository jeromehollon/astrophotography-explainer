// PixInsight AutoSTF and MTF, matching tools/astro.py `stretch` (SPEC §4.5). Inputs are in DN (0..65535).
//
//   c0 = median + clip·MADN   (clamped to [0, 65535])
//   m  = MTF(targetBg, (median − c0)/65535)
//   display(x) = MTF(m, clamp((x − c0)/(65535 − c0), 0, 1))
// MTF(m, x) = ((m − 1)·x) / ((2m − 1)·x − m); maps m → 0.5, fixes 0 and 1.

import type { DisplayStf, StfParams } from './types';

export const DN_MAX = 65535;

export function mtf(m: number, x: number): number {
  if (m <= 0) return x > 0 ? 1 : 0;
  if (m >= 1) return x < 1 ? 0 : 1;
  return ((m - 1) * x) / ((2 * m - 1) * x - m);
}

/** AutoSTF parameters for a linear image with the given median and MADN (both in DN). Non-inverted images only. */
export function autoStf(median: number, madn: number, opts: { targetBg?: number; clip?: number } = {}): StfParams {
  const targetBg = opts.targetBg ?? 0.25;
  const clip = opts.clip ?? -2.8;
  const c0 = Math.min(Math.max(median + clip * madn, 0), DN_MAX);
  const m = mtf(targetBg, (median - c0) / DN_MAX);
  return { c0, m };
}

/** Display transfer for DN values: 0..1. `lo` defaults to c0, `hi` to 65535 DN. */
export function stfLut(params: StfParams, lo?: number, hi?: number): (x: number) => number {
  const c0 = lo ?? params.c0;
  const c1 = hi ?? DN_MAX;
  const span = Math.max(c1 - c0, 1e-12);
  const m = params.m;
  return (x: number) => {
    let t = (x - c0) / span;
    if (!(t > 0)) return 0;
    if (t > 1) t = 1;
    return mtf(m, t);
  };
}

/** A 65536-entry Float32 table of the display transfer for integer DN 0..65535 (for u16 data) — optional helper. */
export function stfTable(params: StfParams): Float32Array {
  const f = stfLut(params);
  const t = new Float32Array(DN_MAX + 1);
  for (let i = 0; i <= DN_MAX; i++) t[i] = f(i);
  return t;
}

export function isLinearRange(s: DisplayStf): s is { linearLo: number; linearHi: number } {
  return (s as { linearLo?: number }).linearLo !== undefined;
}

/** Display function for either STF params or a linear range. */
export function displayLut(s: DisplayStf): (x: number) => number {
  if (isLinearRange(s)) {
    const span = Math.max(s.linearHi - s.linearLo, 1e-12);
    return (x: number) => {
      const t = (x - s.linearLo) / span;
      return t <= 0 ? 0 : t >= 1 ? 1 : t;
    };
  }
  return stfLut(s);
}

/** Median and MADN of the finite samples (DN), used for per-tile stretches and for the noise readout. */
export function medianMadn(data: ArrayLike<number>): { median: number; madn: number; n: number } {
  const v = new Float64Array(data.length);
  let n = 0;
  for (let i = 0; i < data.length; i++) {
    const x = data[i];
    if (Number.isFinite(x)) v[n++] = x;
  }
  if (n === 0) return { median: NaN, madn: NaN, n: 0 };
  const a = v.subarray(0, n).sort();
  const med = n % 2 ? a[(n - 1) / 2] : 0.5 * (a[n / 2 - 1] + a[n / 2]);
  const d = new Float64Array(n);
  for (let i = 0; i < n; i++) d[i] = Math.abs(a[i] - med);
  d.sort();
  const mad = n % 2 ? d[(n - 1) / 2] : 0.5 * (d[n / 2 - 1] + d[n / 2]);
  return { median: med, madn: 1.4826 * mad, n };
}

/** Values of the p-th (0..100) percentile over finite samples; used for the flats' linear display range (SPEC §4.5). */
export function percentiles(data: ArrayLike<number>, ps: number[]): number[] {
  const v = new Float64Array(data.length);
  let n = 0;
  for (let i = 0; i < data.length; i++) if (Number.isFinite(data[i])) v[n++] = data[i];
  if (!n) return ps.map(() => NaN);
  const a = v.subarray(0, n).sort();
  return ps.map((p) => a[Math.min(n - 1, Math.max(0, Math.round((p / 100) * (n - 1))))]);
}
