// Pixel-stack integration: average, median, kappa-sigma, winsorized sigma clipping and RCR, implemented from the
// PCL listings in docs/knowledge/wbpp.md §4.5–4.6 with WBPP's constants (SPEC §6.6). All weights are equal.
// Rejection iterates until nothing more is rejected or fewer than 3 samples remain; if every sample is NaN the
// output is NaN. Samples are the normalized values (SPEC §6.5).

import type { AlgorithmName } from './types';

export type IntegrateParams = Record<string, number>;

export const DEFAULT_PARAMS: Record<AlgorithmName, IntegrateParams> = {
  average: {},
  median: {},
  kappaSigma: { sigmaLow: 4, sigmaHigh: 3 },
  winsorized: { sigmaLow: 4, sigmaHigh: 3, cutoff: 5 },
  rcr: { limit: 0.1 },
};

// ---------------------------------------------------------------- special functions

/** erf with ~1e-13 absolute error: Taylor series below |z|<2.5, continued fraction for erfc above. */
export function erf(z: number): number {
  const a = Math.abs(z);
  let r: number;
  if (a < 2.5) {
    // Σ (−1)^n z^(2n+1) / (n! (2n+1)) · 2/√π
    let term = a, sum = a;
    const z2 = a * a;
    for (let n = 1; n < 80; n++) {
      term *= -z2 / n;
      const add = term / (2 * n + 1);
      sum += add;
      if (Math.abs(add) < 1e-17 * Math.abs(sum)) break;
    }
    r = (2 / Math.sqrt(Math.PI)) * sum;
  } else if (a > 6.5) {
    r = 1;
  } else {
    // erfc(a) = exp(−a²)/√π · 1/(a + 1/(2a + 2/(a + 3/(2a + ...)))) evaluated by modified Lentz.
    const tiny = 1e-300;
    let f = a, C = a, D = 0;
    for (let n = 1; n < 200; n++) {
      const an = n / 2;
      const bn = a; // erfc CF: a + (1/2)/(a + 1/(a + (3/2)/(a + 2/(a + ...)))), a_n = n/2, b_n = a
      D = bn + an * D; if (D === 0) D = tiny; D = 1 / D;
      C = bn + an / C; if (C === 0) C = tiny;
      const delta = C * D;
      f *= delta;
      if (Math.abs(delta - 1) < 1e-16) break;
    }
    r = 1 - Math.exp(-a * a) / (Math.sqrt(Math.PI) * f);
  }
  return z < 0 ? -r : r;
}

/** Inverse error function: Giles' single-precision approximation refined by two Newton steps. */
export function erfinv(y: number): number {
  if (y <= -1) return -Infinity;
  if (y >= 1) return Infinity;
  if (y === 0) return 0;
  let w = -Math.log((1 - y) * (1 + y));
  let x: number;
  if (w < 5) {
    w -= 2.5;
    let p = 2.81022636e-8;
    p = 3.43273939e-7 + p * w; p = -3.5233877e-6 + p * w; p = -4.39150654e-6 + p * w; p = 0.00021858087 + p * w;
    p = -0.00125372503 + p * w; p = -0.00417768164 + p * w; p = 0.246640727 + p * w; p = 1.50140941 + p * w;
    x = p * y;
  } else {
    w = Math.sqrt(w) - 3;
    let p = -0.000200214257;
    p = 0.000100950558 + p * w; p = 0.00134934322 + p * w; p = -0.00367342844 + p * w; p = 0.00573950773 + p * w;
    p = -0.0076224613 + p * w; p = 0.00943887047 + p * w; p = 1.00167406 + p * w; p = 2.83297682 + p * w;
    x = p * y;
  }
  const k = 2 / Math.sqrt(Math.PI);
  for (let i = 0; i < 3; i++) x -= (erf(x) - y) / (k * Math.exp(-x * x));
  return x;
}

// ---------------------------------------------------------------- helpers on a sorted slice v[i..j)

function median(v: Float64Array, i: number, j: number): number {
  const n = j - i;
  return n % 2 ? v[i + (n - 1) / 2] : 0.5 * (v[i + n / 2 - 1] + v[i + n / 2]);
}

function mean(v: Float64Array, i: number, j: number): number {
  let s = 0;
  for (let k = i; k < j; k++) s += v[k];
  return s / (j - i);
}

/** Sample standard deviation (n − 1). */
function stddev(v: Float64Array, i: number, j: number, m: number): number {
  const n = j - i;
  if (n < 2) return 0;
  let s = 0;
  for (let k = i; k < j; k++) { const d = v[k] - m; s += d * d; }
  return Math.sqrt(s / (n - 1));
}

function sortNumeric(a: Float64Array): void {
  a.sort();
}

/**
 * Rousseeuw–Croux Sn = lomed_i himed_j |x_i − x_j| (no constant) on the sorted slice v[i..j). For each i the
 * distances to the left (x_i − x_j, j < i) and to the right (x_j − x_i, j > i) are both sorted, so the k-th
 * smallest comes from a two-pointer merge: O(n) per i, O(n²) in all, no sorting.
 */
export function snEstimator(v: Float64Array, i: number, j: number, scratchA: Float64Array, scratchB: Float64Array): number {
  const n = j - i;
  const hiIdx = Math.floor(n / 2);          // (floor(n/2)+1)-th smallest, 0-based
  const loIdx = Math.floor((n + 1) / 2) - 1; // floor((n+1)/2)-th smallest, 0-based
  const inner = scratchB.subarray(0, n);
  void scratchA;
  for (let a = 0; a < n; a++) {
    const xa = v[i + a];
    // k-th smallest (k = hiIdx, 0-based) among {0} ∪ left distances ∪ right distances
    let l = a - 1, r = a + 1, count = 0, val = 0; // distance 0 (j = a) is the smallest
    while (count < hiIdx) {
      const dl = l >= 0 ? xa - v[i + l] : Infinity;
      const dr = r < n ? v[i + r] - xa : Infinity;
      if (dl <= dr) { val = dl; l--; } else { val = dr; r++; }
      count++;
    }
    inner[a] = val;
  }
  sortNumeric(inner);
  return inner[loIdx];
}

// ---------------------------------------------------------------- algorithms (v sorted, finite)

export function kappaSigmaClip(v: Float64Array, n: number, sigmaLow: number, sigmaHigh: number): number {
  let i = 0, j = n;
  while (j - i >= 3) {
    const m = median(v, i, j);
    const s = stddev(v, i, j, mean(v, i, j));
    if (1 + s === 1) break;
    const i0 = i, j0 = j;
    while (i < j && (m - v[i]) / s > sigmaLow) i++;
    while (j > i && (v[j - 1] - m) / s > sigmaHigh) j--;
    if (i === i0 && j === j0) break;
  }
  return j > i ? mean(v, i, j) : NaN;
}

/** Huber/Winsorization loop (wbpp.md §4.6 step 1) on a copy of v[i..j). Writes [m, sigma] into `out`. */
function winsorize(v: Float64Array, i: number, j: number, cutoff: number, copy: Float64Array, sA: Float64Array, sB: Float64Array, out: Float64Array): void {
  const n = j - i;
  const c = copy.subarray(0, n);
  for (let k = 0; k < n; k++) c[k] = v[i + k];
  let m = median(v, i, j);
  let s = 1.1926 * snEstimator(v, i, j, sA, sB);
  if (1 + s === 1) { out[0] = m; out[1] = s; return; }
  for (let it = 1; it <= 50; it++) {
    const t0 = m - 1.5 * s, t1 = m + 1.5 * s;
    if (it === 1 && cutoff > 0) {
      const c0 = m - cutoff * s, c1 = m + cutoff * s;
      for (let k = 0; k < n; k++) if (c[k] < c0 || c[k] > c1) c[k] = m;
    }
    for (let k = 0; k < n; k++) c[k] = c[k] < t0 ? t0 : c[k] > t1 ? t1 : c[k];
    m = mean(c, 0, n);
    const sNew = 1.134 * stddev(c, 0, n, m);
    const done = it > 1 && Math.abs(sNew - s) / s < 0.0005;
    s = sNew;
    if (done || 1 + s === 1) break;
  }
  out[0] = m; out[1] = s;
}

export function winsorizedSigmaClip(v: Float64Array, n: number, sigmaLow: number, sigmaHigh: number, cutoff: number, scratch: Scratch): number {
  let i = 0, j = n;
  const ms = scratch.ms;
  while (j - i >= 3) {
    winsorize(v, i, j, cutoff, scratch.copy, scratch.a, scratch.b, ms);
    const m = ms[0], s = ms[1];
    if (1 + s === 1) break;
    const i0 = i, j0 = j;
    while (i < j && (m - v[i]) / s > sigmaLow) i++;
    while (j > i && (v[j - 1] - m) / s > sigmaHigh) j--;
    if (i === i0 && j === j0) break;
  }
  return j > i ? mean(v, i, j) : NaN;
}

function fnCorrection(n: number): number {
  return 1 / (1 - 2.9442 * Math.pow(n, -1.073));
}

function sampleDeviation(v: Float64Array, i: number, j: number, m: number, d: Float64Array): number {
  const n = j - i;
  const dd = d.subarray(0, n);
  for (let k = 0; k < n; k++) dd[k] = Math.abs(v[i + k] - m);
  sortNumeric(dd);
  let k = Math.floor(0.683 * n);
  if (k > n - 1) k = n - 1;
  return fnCorrection(n) * dd[k];
}

const erfinvAbscissae = new Map<string, Float64Array>();
/** x_k = √2·erfinv((k+1−0.317)/n), k = 0..n1−1: depends only on (n, n1), so cache it. */
function abscissae(n: number, n1: number): Float64Array {
  const key = `${n}|${n1}`;
  let t = erfinvAbscissae.get(key);
  if (!t) {
    t = new Float64Array(n1);
    for (let k = 0; k < n1; k++) t[k] = Math.SQRT2 * erfinv((k + 1 - 0.317) / n);
    erfinvAbscissae.set(key, t);
  }
  return t;
}

function lineFitDeviation(v: Float64Array, i: number, j: number, m: number, d: Float64Array): number {
  const n = j - i;
  const n1 = Math.trunc(0.683 * n + 0.317);
  if (n1 < 8) return sampleDeviation(v, i, j, m, d);
  const dd = d.subarray(0, n);
  for (let k = 0; k < n; k++) dd[k] = Math.abs(v[i + k] - m);
  sortNumeric(dd);
  // least-squares line y ≈ a + b·x through (x_k, y_k)
  const xs = abscissae(n, n1);
  let sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (let k = 0; k < n1; k++) {
    const x = xs[k];
    const y = dd[k];
    sx += x; sy += y; sxx += x * x; sxy += x * y;
  }
  const den = n1 * sxx - sx * sx;
  const b = den !== 0 ? (n1 * sxy - sx * sy) / den : 0;
  const a = (sy - b * sx) / n1;
  return fnCorrection(n) * (a + b);
}

function Q(z: number): number {
  return 0.5 * (1 - erf(z / Math.SQRT2));
}

export function robustChauvenet(v: Float64Array, n: number, limit: number, scratch: Scratch): number {
  let i = 0, j = n;
  const d = scratch.a;
  for (let phase = 0; phase < 3; phase++) {
    for (;;) {
      const cnt = j - i;
      if (cnt < 3) return cnt > 0 ? mean(v, i, j) : NaN;
      let m: number, s: number;
      if (phase === 0) { m = median(v, i, j); s = lineFitDeviation(v, i, j, m, d); }
      else if (phase === 1) { m = median(v, i, j); s = sampleDeviation(v, i, j, m, d); }
      else { m = mean(v, i, j); s = stddev(v, i, j, m); }
      if (1 + s === 1) return mean(v, i, j);
      const d0 = cnt * Q((m - v[i]) / s);
      const d1 = cnt * Q((v[j - 1] - m) / s);
      if (d0 >= limit && d1 >= limit) break;
      if (d1 < d0) j--; else i++;
    }
  }
  return mean(v, i, j);
}

// ---------------------------------------------------------------- driver

export type Scratch = { v: Float64Array; copy: Float64Array; a: Float64Array; b: Float64Array; ms: Float64Array };

export function makeScratch(n: number): Scratch {
  return { v: new Float64Array(n), copy: new Float64Array(n), a: new Float64Array(n), b: new Float64Array(n), ms: new Float64Array(2) };
}

/** Integrate one pixel stack given in `scratch.v[0..n)` (unsorted, finite). */
export function integrateSamples(name: AlgorithmName, params: IntegrateParams, n: number, scratch: Scratch): number {
  if (n === 0) return NaN;
  const v = scratch.v;
  if (name === 'average') return mean(v, 0, n);
  const s = v.subarray(0, n);
  sortNumeric(s);
  switch (name) {
    case 'median': return median(v, 0, n);
    case 'kappaSigma': return kappaSigmaClip(v, n, params.sigmaLow ?? 4, params.sigmaHigh ?? 3);
    case 'winsorized': return winsorizedSigmaClip(v, n, params.sigmaLow ?? 4, params.sigmaHigh ?? 3, params.cutoff ?? 5, scratch);
    case 'rcr': return robustChauvenet(v, n, params.limit ?? 0.1, scratch);
  }
}

/**
 * Integrate `frames` (each w×h, same layout, NaN = no sample) into `out`. Rows [row0,row1) only, so bands can be
 * split across workers.
 */
export function integrateFrames(
  frames: Float32Array[], w: number, h: number, name: AlgorithmName, params: IntegrateParams = {},
  out: Float32Array = new Float32Array(w * h), row0 = 0, row1 = h,
): Float32Array {
  const nf = frames.length;
  const scratch = makeScratch(nf);
  const v = scratch.v;
  const p = { ...DEFAULT_PARAMS[name], ...params };
  for (let y = row0; y < row1; y++) {
    for (let x = 0; x < w; x++) {
      const o = y * w + x;
      let n = 0;
      for (let f = 0; f < nf; f++) {
        const s = frames[f][o];
        if (s === s) v[n++] = s; // finite check (NaN !== NaN); Infinity never occurs
      }
      out[o] = integrateSamples(name, p, n, scratch);
    }
  }
  return out;
}

/** Integrate a single one-dimensional stack (tests, lessons). NaN samples are dropped. */
export function integrate1d(samples: ArrayLike<number>, name: AlgorithmName, params: IntegrateParams = {}): number {
  const scratch = makeScratch(samples.length);
  let n = 0;
  for (let i = 0; i < samples.length; i++) if (Number.isFinite(samples[i])) scratch.v[n++] = samples[i];
  return integrateSamples(name, { ...DEFAULT_PARAMS[name], ...params }, n, scratch);
}
