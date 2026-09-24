// Coordinate spaces and the output→frame transform.
//
// SPEC §4.1 (quoted):
//   "Sensor space of asset A: pixel column x (rightwards) and row y (downwards). Row 0 is the first row of the
//    XISF array. Calibration happens here."
//   "Canonical space: f07's sensor grid, which is the PixInsight registration reference. ROI definitions live
//    here at bin 1."
//   "H_i: the 3×3 matrix taken from the xdrz. It maps canonical to frame i's sensor space. Pixel centres sit on
//    integer coordinates, as verified in Stage A (geometry_check.json)."  (median residual 0.02 px for the
//    integer-centre convention against 1.41 px for the half-pixel alternative on East-side frames, SPEC §6.4)
//   "Output grid for reference r: M_{out→i} = H_i · H_r⁻¹ · F_r, where F_r is the identity for West frames and a
//    180° rotation about the image centre for East frames. The stack is aligned to r's pixel grid but keeps the
//    canonical orientation."
//   "Binning b ∈ {1,2,4,8}: conjugate with S_b as in §6.4."   M = S_b⁻¹ · H_i · H_r⁻¹ · F_r · S_b
//
// S_b = [[b,0,(b−1)/2],[0,b,(b−1)/2],[0,0,1]] maps a bin-b sample index to native coordinates, because a bin-b
// sample is the mean of a b×b block whose centre sits at b·i + (b−1)/2 in native pixel-centre coordinates.
// F_r: x → W−1−x, y → H−1−y (native units).

import type { Bin, Mat3, Rect } from './types';

export const LANCZOS_RADIUS = 3;

export const IDENTITY: Mat3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];

export function mat3Mul(a: Mat3, b: Mat3): Mat3 {
  const r = new Array(9).fill(0) as Mat3;
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++)
      r[i * 3 + j] = a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j];
  return r;
}

export function mat3Inv(m: Mat3): Mat3 {
  const [a, b, c, d, e, f, g, h, i] = m;
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
  const det = a * A + b * B + c * C;
  if (!det) throw new Error('singular matrix');
  const inv = [A, -(b * i - c * h), b * f - c * e, B, a * i - c * g, -(a * f - c * d), C, -(a * h - b * g), a * e - b * d];
  return inv.map((v) => v / det) as Mat3;
}

/** Bin-b sample index → native coordinates (SPEC §6.4). */
export function scaleMatrix(b: Bin): Mat3 {
  const o = (b - 1) / 2;
  return [b, 0, o, 0, b, o, 0, 0, 1];
}

/** 180° rotation about the image centre for East-side references; identity for West (SPEC §4.1). */
export function flipMatrix(width: number, height: number, east: boolean): Mat3 {
  return east ? [-1, 0, width - 1, 0, -1, height - 1, 0, 0, 1] : IDENTITY;
}

/** M = S_b⁻¹ · H_i · H_r⁻¹ · F_r · S_b: output bin-b sample index (ref grid) → frame i's bin-b sample index. */
export function outputToFrame(Hi: Mat3, Hr: Mat3, Fr: Mat3, b: Bin): Mat3 {
  const S = scaleMatrix(b);
  return mat3Mul(mat3Inv(S), mat3Mul(Hi, mat3Mul(mat3Inv(Hr), mat3Mul(Fr, S))));
}

export function applyH(M: Mat3, x: number, y: number): [number, number] {
  const w = M[6] * x + M[7] * y + M[8];
  return [(M[0] * x + M[1] * y + M[2]) / w, (M[3] * x + M[4] * y + M[5]) / w];
}

/**
 * Sensor rectangle (bin-1 units, multiples of `bin`, clamped to the image) that covers the output rect after
 * mapping through M_native (output ref-grid native coords → frame native coords), padded by the Lanczos radius
 * (3 samples at bin b = 3·b native pixels, plus one extra sample for the floor/ceil of the tap window).
 * Returns null when the footprint misses the frame entirely.
 */
export function footprint(Mnative: Mat3, out: Rect, bin: Bin, width: number, height: number): Rect | null {
  const xs = [out.x, out.x + out.w - 1];
  const ys = [out.y, out.y + out.h - 1];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const x of xs)
    for (const y of ys) {
      const [u, v] = applyH(Mnative, x, y);
      if (u < minX) minX = u;
      if (u > maxX) maxX = u;
      if (v < minY) minY = v;
      if (v > maxY) maxY = v;
    }
  const pad = (LANCZOS_RADIUS + 1) * bin;
  let x0 = Math.floor((minX - pad) / bin) * bin;
  let y0 = Math.floor((minY - pad) / bin) * bin;
  let x1 = Math.ceil((maxX + pad + 1) / bin) * bin;
  let y1 = Math.ceil((maxY + pad + 1) / bin) * bin;
  const W = Math.floor(width / bin) * bin, H = Math.floor(height / bin) * bin;
  x0 = Math.max(0, x0); y0 = Math.max(0, y0); x1 = Math.min(W, x1); y1 = Math.min(H, y1);
  if (x1 <= x0 || y1 <= y0) return null;
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

export function unionRect(a: Rect | null, b: Rect | null): Rect | null {
  if (!a) return b;
  if (!b) return a;
  const x0 = Math.min(a.x, b.x), y0 = Math.min(a.y, b.y);
  const x1 = Math.max(a.x + a.w, b.x + b.w), y1 = Math.max(a.y + a.h, b.y + b.h);
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

export function rectContains(outer: Rect, inner: Rect): boolean {
  return inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.w <= outer.x + outer.w && inner.y + inner.h <= outer.y + outer.h;
}

export function rectEquals(a: Rect, b: Rect): boolean {
  return a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;
}
