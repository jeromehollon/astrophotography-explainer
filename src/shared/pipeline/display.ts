// Float32 DN → RGBA display (SPEC §4.5). NaN (no data) is drawn in the stage colour #0F1220.

import { displayLut } from './stf';
import type { DisplayStf } from './types';

export const NAN_RGB: [number, number, number] = [0x0f, 0x12, 0x20];

/** RGBA bytes for w×h samples through the display transfer; `rotate180` flips the output for East-side views. */
export function toRgba(data: Float32Array, w: number, h: number, stf: DisplayStf, opts: { rotate180?: boolean; nan?: 'stage' } = {}): Uint8ClampedArray<ArrayBuffer> {
  const lut = displayLut(stf);
  const n = w * h;
  const out = new Uint8ClampedArray(new ArrayBuffer(n * 4));
  const rot = !!opts.rotate180;
  for (let i = 0; i < n; i++) {
    const x = data[i];
    const o = (rot ? n - 1 - i : i) * 4;
    if (x !== x) {
      out[o] = NAN_RGB[0]; out[o + 1] = NAN_RGB[1]; out[o + 2] = NAN_RGB[2];
    } else {
      const g = Math.round(lut(x) * 255);
      out[o] = g; out[o + 1] = g; out[o + 2] = g;
    }
    out[o + 3] = 255;
  }
  return out;
}

export function toImageData(data: Float32Array, w: number, h: number, stf: DisplayStf, opts: { rotate180?: boolean; nan?: 'stage' } = {}): ImageData {
  const rgba = toRgba(data, w, h, stf, opts);
  if (typeof ImageData !== 'undefined') return new ImageData(rgba, w, h);
  return { data: rgba, width: w, height: h, colorSpace: 'srgb' } as unknown as ImageData;
}

/** a − b, centred on mid grey: 0 difference → 32767.5 DN, so the same STF/linear range can display it. Either NaN → NaN. */
export function difference(a: Float32Array, b: Float32Array, gain = 1, mid = 32767.5): Float32Array {
  if (a.length !== b.length) throw new Error('difference: size mismatch');
  const out = new Float32Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = (a[i] - b[i]) * gain + mid;
  return out;
}

/** A linear display range for a difference image: ±k·MADN of the finite differences around `mid`. */
export function differenceRange(diff: Float32Array, k = 6, mid = 32767.5): { linearLo: number; linearHi: number } {
  let n = 0;
  const v = new Float64Array(diff.length);
  for (let i = 0; i < diff.length; i++) if (diff[i] === diff[i]) v[n++] = Math.abs(diff[i] - mid);
  if (!n) return { linearLo: mid - 1, linearHi: mid + 1 };
  const s = v.subarray(0, n).sort();
  const mad = s[Math.floor(n / 2)] * 1.4826 || 1;
  return { linearLo: mid - k * mad, linearHi: mid + k * mad };
}

export function rotate180(data: Float32Array): Float32Array {
  const out = new Float32Array(data.length);
  for (let i = 0, n = data.length; i < n; i++) out[n - 1 - i] = data[i];
  return out;
}
