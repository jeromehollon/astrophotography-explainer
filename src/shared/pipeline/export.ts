// Full-stack export (SPEC §4.6): 8-bit PNG with the current stretch, and float32 FITS (BITPIX −32, linear [0,1]).
// Both take an optional `crop` (output samples, from commonCrop() in stack.ts) so the download can be cut to the
// region every frame covers; without it the whole result is written, edges and all.

import { toImageData } from './display';
import { calState, flatId, lightSub } from './calibrate';
import { DEFAULT_PARAMS } from './integrate';
import { DN_MAX } from './stf';
import type { CalibrationChoice, DisplayStf, Rect, StackRequest, StackResult } from './types';

/** A copy of `result` cut to `rect` (output samples; must lie inside the result). `noise` and `ms` are kept. */
export function cropResult(result: StackResult, rect: Rect): StackResult {
  const { x, y, w, h } = rect;
  if (x < 0 || y < 0 || w <= 0 || h <= 0 || x + w > result.w || y + h > result.h) throw new Error(`crop ${JSON.stringify(rect)} outside ${result.w}×${result.h}`);
  if (x === 0 && y === 0 && w === result.w && h === result.h) return result;
  const data = new Float32Array(w * h);
  for (let r = 0; r < h; r++) data.set(result.data.subarray((y + r) * result.w + x, (y + r) * result.w + x + w), r * w);
  return { ...result, data, w, h };
}

export function calibTag(c: CalibrationChoice): string {
  return `${lightSub(c)}-${flatId(c) ?? 'noflat'}`;
}

export function exportFilename(req: StackRequest, ext: 'png' | 'fits'): string {
  const n = new Set(req.frames).size;
  return `ngc7331_stack_${n}f_${req.algorithm.name}_${calibTag(req.calibration)}.${ext}`;
}

/** 8-bit greyscale PNG through the given stretch (browser only: uses a canvas). `crop` is applied before the rotation. */
export function exportPng(result: StackResult, stf: DisplayStf, opts: { rotate180?: boolean; crop?: Rect | null } = {}): Promise<Blob> {
  if (opts.crop) result = cropResult(result, opts.crop);
  const canvas = document.createElement('canvas');
  canvas.width = result.w; canvas.height = result.h;
  canvas.getContext('2d')!.putImageData(toImageData(result.data, result.w, result.h, stf, { rotate180: opts.rotate180, nan: 'stage' }), 0, 0);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png'));
}

export type FitsHeader = Record<string, string | number | boolean>;

function fitsCard(key: string, value: string | number | boolean, comment?: string): string {
  let v: string;
  if (typeof value === 'boolean') v = (value ? 'T' : 'F').padStart(20);
  else if (typeof value === 'number') v = (Number.isInteger(value) ? String(value) : value.toPrecision(12)).padStart(20);
  else v = `'${value.replace(/'/g, "''").padEnd(8)}'`.padEnd(20);
  let card = `${key.toUpperCase().padEnd(8)}= ${v}`;
  if (comment) card += ` / ${comment}`;
  return card.slice(0, 80).padEnd(80);
}

/** Header keys per SPEC §4.6 from a request. */
export function fitsHeaderFor(req: StackRequest, result: StackResult, exptimePerFrame = 300): FitsHeader {
  const n = new Set(req.frames).size;
  const params = { ...DEFAULT_PARAMS[req.algorithm.name], ...(req.algorithm.params ?? {}) };
  const h: FitsHeader = {
    IMAGETYP: 'Master Light',
    NCOMBINE: n,
    EXPTIME: exptimePerFrame,
    TOTEXP: exptimePerFrame * n,
    REFFRAME: req.grid.ref,
    CALIB: calState(req.calibration),
    ALGO: req.algorithm.name,
    SOFTWARE: 'stacking-explainer',
    XBINNING: req.grid.bin,
    YBINNING: req.grid.bin,
    NOISE: Number.isFinite(result.noise) ? result.noise / DN_MAX : 0,
  };
  for (const [k, v] of Object.entries(params)) h[`ALG_${k.toUpperCase().slice(0, 4)}`] = v;
  return h;
}

/**
 * Float32 FITS: BITPIX −32, data scaled to [0,1] (DN/65535), NaN → 0. Rows are written bottom-up, the FITS
 * convention, so viewers show the image the way the app does.
 */
export function exportFits(result: StackResult, header: FitsHeader, opts: { crop?: Rect | null } = {}): Blob {
  if (opts.crop) result = cropResult(result, opts.crop);
  const { w, h, data } = result;
  const cards = [
    fitsCard('SIMPLE', true, 'conforms to FITS standard'),
    fitsCard('BITPIX', -32, 'IEEE float32'),
    fitsCard('NAXIS', 2), fitsCard('NAXIS1', w), fitsCard('NAXIS2', h),
    ...Object.entries(header).map(([k, v]) => fitsCard(k, v)),
    'END'.padEnd(80),
  ];
  let head = cards.join('');
  head = head.padEnd(Math.ceil(head.length / 2880) * 2880);
  const nBytes = w * h * 4;
  const body = new ArrayBuffer(Math.ceil(nBytes / 2880) * 2880);
  const dv = new DataView(body);
  for (let y = 0; y < h; y++) {
    const srcRow = (h - 1 - y) * w;
    for (let x = 0; x < w; x++) {
      const v = data[srcRow + x];
      dv.setFloat32((y * w + x) * 4, v === v ? v / DN_MAX : 0, false);
    }
  }
  return new Blob([new TextEncoder().encode(head), body], { type: 'application/fits' });
}
