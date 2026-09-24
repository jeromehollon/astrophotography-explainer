/**
 * Adapter between the two pages and the stacking pipeline (docs/contracts.md, src/shared/pipeline).
 * Every image on these pages is a live result (via the pipeline's useStack / useCalibratedRoi, which drop
 * stale results by key and share in-flight fetches): the ROI strip and the wide galaxy view are stack()
 * results on the reference (f03) grid at bin 2, the viewer shows one calibrated frame at bin 4 and its
 * four ROIs as single-frame stacks, and Download PNG runs the full grid at bin 1 and crops it to the area every
 * frame covers. Every live image is stretched with its own AutoSTF (ownStf below). West-side output is
 * rotated 180° for display (design-notes item 27). The bundled PNGs remain only as a first paint
 * while normalization.json loads.
 */
import { useMemo, useRef } from 'react';
import {
  autoStf, exportPng, medianMadn, stack, useCalibratedRoi, useStack,
  type StackRequest, type StackResult, type StfParams,
} from '../../shared/pipeline';
import type { AlgorithmName, CalibrationChoice } from './store';
import { FALLBACK_STF, FRAME_BY_ID, REFERENCE, ROIS, SENSOR, WIDE_RECT, fullSrc, roiSrc, stackSrc, type Rect, type RoiKey } from './data';

export const LIVE = true;

export type View =
  | { kind: 'img'; src: string; rotate180?: boolean }
  | { kind: 'raw'; data: Float32Array; w: number; h: number; stf: StfParams; rotate180: boolean };

export type StackInputs = { frames: string[]; calibration: CalibrationChoice; algorithm: AlgorithmName };

/*
 * Every live view gets its own AutoSTF (SPEC §4.5 parameters: target background 0.30, shadows clip −1.8) computed
 * from the median and MADN of that image's own finite samples, so a single frame, a 3-frame average and a 20-frame
 * median each show their own background at the same grey. The reference-frame STF from normalization.json is no
 * longer used for display: the owner asked that a stretch be computed for each image. Results larger than
 * MAX_STAT_SAMPLES are subsampled with a fixed stride before the sort.
 */
export const DISPLAY_STF = { targetBg: 0.3, clip: -1.8 };
const MAX_STAT_SAMPLES = 1_000_000;
/** Design-time stretch from stats.json is in [0,1] units; the pipeline works in DN. Used only when an image has no finite samples. */
const FALLBACK: StfParams = { c0: FALLBACK_STF.c0 * 65535, m: FALLBACK_STF.m };
export function ownStf(data: Float32Array): StfParams {
  let samples: ArrayLike<number> = data;
  if (data.length > MAX_STAT_SAMPLES) {
    const stride = Math.ceil(data.length / MAX_STAT_SAMPLES);
    const sub = new Float32Array(Math.ceil(data.length / stride));
    for (let i = 0, j = 0; i < data.length; i += stride) sub[j++] = data[i];
    samples = sub;
  }
  const { median, madn, n } = medianMadn(samples);
  if (n === 0 || !Number.isFinite(median) || !Number.isFinite(madn)) return FALLBACK;
  return autoStf(median, madn, DISPLAY_STF);
}
function rawView(data: Float32Array, w: number, h: number, rotate180: boolean): View {
  return { kind: 'raw', data, w, h, stf: ownStf(data), rotate180 };
}

const grid = (r: Rect, bin: 1 | 2 | 4 | 8): StackRequest['grid'] => ({ ref: REFERENCE, x: r.x, y: r.y, w: r.w, h: r.h, bin });
const regionRect = (region: RoiKey | 'wide'): Rect => (region === 'wide' ? WIDE_RECT : ROIS[region].rect);

/** Live stack of one region (ROI at bin 2, or the wide galaxy view at bin 2). */
export function useRegionStack(region: RoiKey | 'wide', inputs: StackInputs): { view: View | null; pending: boolean; empty: boolean } {
  const req = useMemo<StackRequest | null>(() => (inputs.frames.length === 0 ? null : {
    grid: grid(regionRect(region), 2), frames: inputs.frames, calibration: inputs.calibration, algorithm: { name: inputs.algorithm },
  }), [region, inputs.frames, inputs.calibration, inputs.algorithm]);
  const { result, pending } = useStack(req);
  const last = useRef<View | null>(null);
  const view = useMemo<View | null>(() => {
    if (result) return rawView(result.data, result.w, result.h, true);
    if (inputs.frames.length === 0) return null;
    // while a new result is pending keep the last live canvas; before the very first result show the bundled default stack
    return last.current ?? { kind: 'img', src: stackSrc(region, inputs.algorithm === 'average' ? 'average' : 'median') };
  }, [result, region, inputs.algorithm, inputs.frames.length]);
  if (view?.kind === 'raw') last.current = view;
  return { view, pending, empty: inputs.frames.length === 0 };
}

/** The selected frame in the viewer: the whole calibrated frame at bin 4 (no warp) and its four ROIs at bin 2 on the reference grid. */
export function useFrameView(id: string, calibration: CalibrationChoice): { full: View | null; rois: Record<RoiKey, View | null>; pending: boolean } {
  const west = FRAME_BY_ID[id]?.pierSide === 'West';
  const whole = useCalibratedRoi(id, null, 4, calibration);
  const roiReq = (k: RoiKey): StackRequest => ({ grid: grid(ROIS[k].rect, 2), frames: [id], calibration, algorithm: { name: 'average' } });
  const trail = useStack(useMemo(() => roiReq('trail'), [id, calibration]));
  const galaxy = useStack(useMemo(() => roiReq('galaxy'), [id, calibration]));
  const group = useStack(useMemo(() => roiReq('group'), [id, calibration]));
  const mote = useStack(useMemo(() => roiReq('mote'), [id, calibration]));
  const rois = { trail, galaxy, group, mote };
  const last = useRef<Partial<Record<RoiKey | 'full', View>>>({});
  // Each view's STF is computed once per result: the view object is cached by the result's data buffer.
  const toView = (k: RoiKey): View | null => {
    const r = rois[k].result;
    if (r) {
      if (last.current[k]?.kind !== 'raw' || (last.current[k] as { data: Float32Array }).data !== r.data) last.current[k] = rawView(r.data, r.w, r.h, true);
      return last.current[k]!;
    }
    return last.current[k] ?? { kind: 'img', src: roiSrc(id, k) };
  };
  if (whole.data && (last.current.full?.kind !== 'raw' || (last.current.full as { data: Float32Array }).data !== whole.data)) {
    last.current.full = rawView(whole.data, whole.w, whole.h, west);
  }
  return {
    full: whole.data ? last.current.full! : last.current.full ?? { kind: 'img', src: fullSrc(id) },
    rois: { trail: toView('trail'), galaxy: toView('galaxy'), group: toView('group'), mote: toView('mote') },
    pending: whole.pending || trail.pending || galaxy.pending || group.pending || mote.pending,
  };
}

/**
 * The largest interior rectangle every frame covers: rows and columns are scanned from each edge inward until one
 * holds fewer than NAN_FRACTION missing (NaN) samples. After registration the frames' footprints differ by the
 * dither, so the union grid has ragged NaN edges that would otherwise appear as stage-coloured borders in the PNG.
 */
const NAN_FRACTION = 0.005;
export function commonCropRect(data: Float32Array, w: number, h: number): Rect {
  const rowNaN = new Uint32Array(h), colNaN = new Uint32Array(w);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) if (data[row + x] !== data[row + x]) { rowNaN[y]++; colNaN[x]++; }
  }
  let x0 = 0, y0 = 0, x1 = w, y1 = h;
  // A fully missing column makes every row look partly missing (and vice versa), so the edge with the largest
  // missing fraction is trimmed first, the counts are updated for that line, and the scan repeats until every
  // edge line is below the threshold.
  const isNaN = (x: number, y: number) => data[y * w + x] !== data[y * w + x];
  for (;;) {
    if (y1 - y0 < 2 || x1 - x0 < 2) return { x: 0, y: 0, w, h };
    const f = [rowNaN[y0] / (x1 - x0), rowNaN[y1 - 1] / (x1 - x0), colNaN[x0] / (y1 - y0), colNaN[x1 - 1] / (y1 - y0)];
    let edge = 0;
    for (let i = 1; i < 4; i++) if (f[i] > f[edge]) edge = i;
    if (f[edge] < NAN_FRACTION) break;
    if (edge === 0) { for (let x = x0; x < x1; x++) if (isNaN(x, y0)) colNaN[x]--; y0++; }
    else if (edge === 1) { for (let x = x0; x < x1; x++) if (isNaN(x, y1 - 1)) colNaN[x]--; y1--; }
    else if (edge === 2) { for (let y = y0; y < y1; y++) if (isNaN(x0, y)) rowNaN[y]--; x0++; }
    else { for (let y = y0; y < y1; y++) if (isNaN(x1 - 1, y)) rowNaN[y]--; x1--; }
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

export function cropResult(result: StackResult, r: Rect): StackResult {
  if (r.x === 0 && r.y === 0 && r.w === result.w && r.h === result.h) return result;
  const data = new Float32Array(r.w * r.h);
  for (let y = 0; y < r.h; y++) data.set(result.data.subarray((r.y + y) * result.w + r.x, (r.y + y) * result.w + r.x + r.w), y * r.w);
  return { ...result, data, w: r.w, h: r.h };
}

export type FullStack = { blob: Blob; w: number; h: number; cropped: boolean };

/**
 * Stack the full reference grid at bin 1, crop to the region every frame covers, and return an 8-bit PNG with
 * the image's own AutoSTF (SPEC §4.6).
 */
export async function stackFullPng(inputs: StackInputs, onProgress: (done: number, total: number) => void, signal: AbortSignal): Promise<FullStack> {
  const req: StackRequest = { grid: grid({ x: 0, y: 0, w: SENSOR.w, h: SENSOR.h }, 1), frames: inputs.frames, calibration: inputs.calibration, algorithm: { name: inputs.algorithm } };
  const full = await stack(req, { signal, onProgress });
  const result = cropResult(full, commonCropRect(full.data, full.w, full.h));
  const blob = await exportPng(result, ownStf(result.data), { rotate180: true });
  return { blob, w: result.w, h: result.h, cropped: result !== full };
}

export function pngFilename(inputs: StackInputs): string {
  const c = inputs.calibration;
  const calib = [c.bias && 'bias', c.dark && 'dark', c.darkFlat && 'darkflat', c.flat && `flat${c.flat}`].filter(Boolean).join('-') || 'nocal';
  return `ngc7331_stack_${inputs.frames.length}f_${inputs.algorithm}_${calib}.png`;
}
