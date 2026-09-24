/**
 * Adapter between the two pages and the stacking pipeline (docs/contracts.md, src/shared/pipeline).
 * Every image on these pages is a live result (via the pipeline's useStack / useCalibratedRoi, which drop
 * stale results by key and share in-flight fetches): the ROI strip and the wide galaxy view are stack()
 * results on the reference (f03) grid at bin 2, the viewer shows one calibrated frame at bin 4 and its
 * four ROIs as single-frame stacks, and Download PNG runs the full grid at bin 1. West-side output is
 * rotated 180° for display (design-notes item 27). The bundled PNGs remain only as a first paint
 * while normalization.json loads.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  autoStf, calState, exportPng, fetchNormalization, stack, useCalibratedRoi, useStack,
  type StackRequest, type StfParams,
} from '../../shared/pipeline';
import type { AlgorithmName, CalibrationChoice } from './store';
import { FALLBACK_STF, FRAME_BY_ID, REFERENCE, ROIS, SENSOR, WIDE_RECT, fullSrc, roiSrc, stackSrc, type Rect, type RoiKey } from './data';

export const LIVE = true;

export type View =
  | { kind: 'img'; src: string; rotate180?: boolean }
  | { kind: 'raw'; data: Float32Array; w: number; h: number; stf: StfParams; rotate180: boolean };

export type StackInputs = { frames: string[]; calibration: CalibrationChoice; algorithm: AlgorithmName };

/*
 * normalization.json → reference STF per calibration state (SPEC §4.5). The design assets were rendered with
 * target background 0.30 and shadows clip −1.8 from the reference frame's statistics *at bin 2*
 * (assets/light-frames-review/stats.json: c0 ≈ 872 DN, m ≈ 0.0014). normalization.json holds bin-1 statistics,
 * whose MADN is about twice the bin-2 value (a 2×2 mean halves the noise), so the MADN is divided by the display
 * bin before AutoSTF. Every view on both pages, and the exported PNG, shares this one stretch.
 */
export const DISPLAY_STF = { targetBg: 0.3, clip: -1.8 };
const DISPLAY_BIN = 2;
type NormStats = { median_dn: number; madn_dn: number };
let normStates: Record<string, NormStats> | null = null;
const statsPromise = fetchNormalization().then(
  (n) => { normStates = n.frames[REFERENCE]?.states ?? null; },
  (e) => console.error('normalization.json', e),
);
function useStatsReady(): boolean {
  const [ready, setReady] = useState(normStates !== null);
  useEffect(() => { let on = true; statsPromise.then(() => { if (on) setReady(true); }); return () => { on = false; }; }, []);
  return ready;
}
/** Design-time stretch from stats.json is in [0,1] units; the pipeline works in DN. */
const FALLBACK: StfParams = { c0: FALLBACK_STF.c0 * 65535, m: FALLBACK_STF.m };
function displayStf(state: string): StfParams {
  const s = normStates?.[state];
  return s ? autoStf(s.median_dn, s.madn_dn / DISPLAY_BIN, DISPLAY_STF) : FALLBACK;
}
export function useReferenceStf(calibration: CalibrationChoice): StfParams {
  const ready = useStatsReady();
  const state = calState(calibration);
  return useMemo(() => (ready ? displayStf(state) : FALLBACK), [ready, state]);
}

const grid = (r: Rect, bin: 1 | 2 | 4 | 8): StackRequest['grid'] => ({ ref: REFERENCE, x: r.x, y: r.y, w: r.w, h: r.h, bin });
const regionRect = (region: RoiKey | 'wide'): Rect => (region === 'wide' ? WIDE_RECT : ROIS[region].rect);

/** Live stack of one region (ROI at bin 2, or the wide galaxy view at bin 2). */
export function useRegionStack(region: RoiKey | 'wide', inputs: StackInputs): { view: View | null; pending: boolean; empty: boolean } {
  const stf = useReferenceStf(inputs.calibration);
  const req = useMemo<StackRequest | null>(() => (inputs.frames.length === 0 ? null : {
    grid: grid(regionRect(region), 2), frames: inputs.frames, calibration: inputs.calibration, algorithm: { name: inputs.algorithm },
  }), [region, inputs.frames, inputs.calibration, inputs.algorithm]);
  const { result, pending } = useStack(req);
  const last = useRef<View | null>(null);
  const view = useMemo<View | null>(() => {
    if (result) return { kind: 'raw', data: result.data, w: result.w, h: result.h, stf, rotate180: true };
    if (inputs.frames.length === 0) return null;
    // while a new result is pending keep the last live canvas; before the very first result show the bundled default stack
    return last.current ?? { kind: 'img', src: stackSrc(region, inputs.algorithm === 'average' ? 'average' : 'median') };
  }, [result, stf, region, inputs.algorithm, inputs.frames.length]);
  if (view?.kind === 'raw') last.current = view;
  return { view, pending, empty: inputs.frames.length === 0 };
}

/** The selected frame in the viewer: the whole calibrated frame at bin 4 (no warp) and its four ROIs at bin 2 on the reference grid. */
export function useFrameView(id: string, calibration: CalibrationChoice): { full: View | null; rois: Record<RoiKey, View | null>; pending: boolean } {
  const stf = useReferenceStf(calibration);
  const west = FRAME_BY_ID[id]?.pierSide === 'West';
  const whole = useCalibratedRoi(id, null, 4, calibration);
  const roiReq = (k: RoiKey): StackRequest => ({ grid: grid(ROIS[k].rect, 2), frames: [id], calibration, algorithm: { name: 'average' } });
  const trail = useStack(useMemo(() => roiReq('trail'), [id, calibration]));
  const galaxy = useStack(useMemo(() => roiReq('galaxy'), [id, calibration]));
  const group = useStack(useMemo(() => roiReq('group'), [id, calibration]));
  const mote = useStack(useMemo(() => roiReq('mote'), [id, calibration]));
  const rois = { trail, galaxy, group, mote };
  const last = useRef<Partial<Record<RoiKey | 'full', View>>>({});
  const toView = (k: RoiKey): View | null => {
    const r = rois[k].result;
    if (r) { last.current[k] = { kind: 'raw', data: r.data, w: r.w, h: r.h, stf, rotate180: true }; return last.current[k]!; }
    return last.current[k] ?? { kind: 'img', src: roiSrc(id, k) };
  };
  if (whole.data) last.current.full = { kind: 'raw', data: whole.data, w: whole.w, h: whole.h, stf, rotate180: west };
  return {
    full: whole.data ? last.current.full! : last.current.full ?? { kind: 'img', src: fullSrc(id) },
    rois: { trail: toView('trail'), galaxy: toView('galaxy'), group: toView('group'), mote: toView('mote') },
    pending: whole.pending || trail.pending || galaxy.pending || group.pending || mote.pending,
  };
}

/** Stack the full reference grid at bin 1 and return an 8-bit PNG with the on-screen stretch (SPEC §4.6). */
export async function stackFullPng(inputs: StackInputs, onProgress: (done: number, total: number) => void, signal: AbortSignal): Promise<Blob> {
  const req: StackRequest = { grid: grid({ x: 0, y: 0, w: SENSOR.w, h: SENSOR.h }, 1), frames: inputs.frames, calibration: inputs.calibration, algorithm: { name: inputs.algorithm } };
  const result = await stack(req, { signal, onProgress });
  await statsPromise;
  const stf = displayStf(calState(inputs.calibration));
  return exportPng(result, stf, { rotate180: true });
}

export function pngFilename(inputs: StackInputs): string {
  const c = inputs.calibration;
  const calib = [c.bias && 'bias', c.dark && 'dark', c.darkFlat && 'darkflat', c.flat && `flat${c.flat}`].filter(Boolean).join('-') || 'nocal';
  return `ngc7331_stack_${inputs.frames.length}f_${inputs.algorithm}_${calib}.png`;
}
