// Inverse warp with Lanczos-3, clamping 0.3, mirrored borders — PixInsight's StarAlignment default,
// implemented as in docs/knowledge/wbpp.md §3.2 (SPEC §6.4). Samples whose source position falls outside
// [0,W−1]×[0,H−1] (in the frame's bin-b sample grid) are NaN.
//
// The source is a crop of the frame (`srcRect` in bin-b sample units, `imageW/H` the frame's bin-b dimensions),
// so border mirroring is done against the *image* edges, then translated into crop indices. The footprint
// (geometry.ts) pads the crop by the Lanczos radius, so every tap of an in-image sample lands in the crop.

import type { Mat3 } from './types';

const A = 3;
const LUT_RES = 4096; // samples per unit of |t|; linear interpolation keeps the error ≈ 1e-8
const LUT_N = A * LUT_RES + 2;
const LUT = new Float64Array(LUT_N);
(() => {
  for (let i = 0; i < LUT_N; i++) {
    const t = i / LUT_RES;
    if (t === 0) LUT[i] = 1;
    else if (t >= A) LUT[i] = 0;
    else {
      const pt = Math.PI * t;
      LUT[i] = (Math.sin(pt) / pt) * (Math.sin(pt / A) / (pt / A));
    }
  }
})();

/** L(t) = sinc(t)·sinc(t/3) for |t| < 3, else 0. */
export function lanczos3(t: number): number {
  const a = Math.abs(t);
  if (a >= A) return 0;
  const p = a * LUT_RES;
  const i = p | 0;
  const f = p - i;
  return LUT[i] + (LUT[i + 1] - LUT[i]) * f;
}

/** Exact kernel (no LUT), for tests. */
export function lanczos3Exact(t: number): number {
  const a = Math.abs(t);
  if (a >= A) return 0;
  if (a === 0) return 1;
  const pt = Math.PI * a;
  return (Math.sin(pt) / pt) * (Math.sin(pt / A) / (pt / A));
}

export type WarpSource = {
  data: Float32Array;
  /** crop origin and size in the frame's bin-b sample grid */
  x: number; y: number; w: number; h: number;
  /** frame dimensions in the same bin-b grid */
  imageW: number; imageH: number;
};

/**
 * Fill `out` (outW×outH) with `src` sampled at M·(ox + u, oy + v), where (ox, oy) is the output rect origin in
 * bin-b sample units of the reference grid and M maps that grid to the frame's bin-b grid.
 */
export function warpLanczos3(
  src: WarpSource, M: Mat3, ox: number, oy: number, outW: number, outH: number,
  out: Float32Array = new Float32Array(outW * outH), clamp = 0.3,
): Float32Array {
  const { data, x: cx, y: cy, w: cw, h: ch, imageW: W, imageH: H } = src;
  const wx = new Float64Array(6), wy = new Float64Array(6);
  const ix = new Int32Array(6), iy = new Int32Array(6);
  const maxX = W - 1, maxY = H - 1;
  const m0 = M[0], m1 = M[1], m2 = M[2], m3 = M[3], m4 = M[4], m5 = M[5], m6 = M[6], m7 = M[7], m8 = M[8];
  for (let v = 0; v < outH; v++) {
    const yy = oy + v;
    for (let u = 0; u < outW; u++) {
      const xx = ox + u;
      const d = m6 * xx + m7 * yy + m8;
      const sx = (m0 * xx + m1 * yy + m2) / d;
      const sy = (m3 * xx + m4 * yy + m5) / d;
      const o = v * outW + u;
      if (!(sx >= 0 && sx <= maxX && sy >= 0 && sy <= maxY)) { out[o] = NaN; continue; }
      const x0 = Math.floor(sx), y0 = Math.floor(sy);
      const dx = sx - x0, dy = sy - y0;
      let ok = true;
      for (let k = 0; k < 6; k++) {
        const j = k - 2;
        wx[k] = lanczos3(j - dx);
        wy[k] = lanczos3(j - dy);
        let px = x0 + j, py = y0 + j;
        if (px < 0) px = -px; else if (px > maxX) px = 2 * maxX - px;
        if (py < 0) py = -py; else if (py > maxY) py = 2 * maxY - py;
        px -= cx; py -= cy;
        if (px < 0 || px >= cw || py < 0 || py >= ch) ok = false;
        ix[k] = px; iy[k] = py;
      }
      if (!ok) { out[o] = NaN; continue; }
      let sp = 0, sn = 0, wp = 0, wn = 0;
      for (let i = 0; i < 6; i++) {
        const row = iy[i] * cw;
        const wyi = wy[i];
        for (let j = 0; j < 6; j++) {
          const w = wx[j] * wyi;
          const s = w * data[row + ix[j]];
          if (s < 0) { sn -= s; wn -= w; } else { sp += s; wp += w; }
        }
      }
      if (sp > 0) {
        const r = sn / sp;
        if (r >= 1) { out[o] = sp / wp; continue; }
        if (r > clamp) {
          const t = (r - clamp) / (1 - clamp);
          const c = 1 - t * t;
          sn *= c; wn *= c;
        }
      }
      out[o] = (sp - sn) / (wp - wn);
    }
  }
  return out;
}

/** Nearest-sample copy of the reference's own grid (align:false, naive stack): src rect must contain the output rect. */
export function copyRect(src: WarpSource, ox: number, oy: number, outW: number, outH: number, out = new Float32Array(outW * outH)): Float32Array {
  for (let v = 0; v < outH; v++) {
    const sy = oy + v - src.y;
    for (let u = 0; u < outW; u++) {
      const sx = ox + u - src.x;
      out[v * outW + u] = sx >= 0 && sx < src.w && sy >= 0 && sy < src.h ? src.data[sy * src.w + sx] : NaN;
    }
  }
  return out;
}

/** Mean of b×b blocks (trailing partial blocks dropped) — the same rule the runtime bins use; for tests. */
export function binMean(data: Float32Array, w: number, h: number, b: number): { data: Float32Array; w: number; h: number } {
  const ow = Math.floor(w / b), oh = Math.floor(h / b);
  const out = new Float32Array(ow * oh);
  for (let y = 0; y < oh; y++)
    for (let x = 0; x < ow; x++) {
      let s = 0;
      for (let i = 0; i < b; i++) for (let j = 0; j < b; j++) s += data[(y * b + i) * w + x * b + j];
      out[y * ow + x] = s / (b * b);
    }
  return { data: out, w: ow, h: oh };
}
