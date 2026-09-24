/**
 * Adapter between the two pages and the stacking pipeline (docs/contracts.md, src/shared/pipeline).
 * Every image on these pages is a live result: the ROI strip and the wide galaxy view are stack()
 * results on the reference (f03) grid at bin 2, the viewer shows one calibrated frame at bin 4 and its
 * four ROIs as single-frame stacks, and Download PNG runs the full grid at bin 1. West-side output is
 * rotated 180° for display (design-notes item 27). The bundled PNGs remain only as a first paint
 * while normalization.json loads.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  calState, calibrateRoi, canonicalKey, exportPng, loadReferenceStats, referenceStf, stack,
  type StackRequest, type StackResult, type StfParams,
} from '../../shared/pipeline';
import type { AlgorithmName, CalibrationChoice } from './store';
import { FALLBACK_STF, FRAME_BY_ID, REFERENCE, ROIS, SENSOR, WIDE_RECT, fullSrc, roiSrc, stackSrc, type Rect, type RoiKey } from './data';

export const LIVE = true;

export type View =
  | { kind: 'img'; src: string; rotate180?: boolean }
  | { kind: 'raw'; data: Float32Array; w: number; h: number; stf: StfParams; rotate180: boolean };

export type StackInputs = { frames: string[]; calibration: CalibrationChoice; algorithm: AlgorithmName };

/* normalization.json → reference STF per calibration state (SPEC §4.5) */
let statsReady = false;
const statsPromise = loadReferenceStats().then(() => { statsReady = true; }, (e) => console.error('normalization.json', e));
function useStatsReady(): boolean {
  const [ready, setReady] = useState(statsReady);
  useEffect(() => { let on = true; statsPromise.then(() => { if (on) setReady(true); }); return () => { on = false; }; }, []);
  return ready;
}
/** Design-time stretch from stats.json is in [0,1] units; the pipeline works in DN. */
const FALLBACK: StfParams = { c0: FALLBACK_STF.c0 * 65535, m: FALLBACK_STF.m };
export function useReferenceStf(calibration: CalibrationChoice): StfParams {
  const ready = useStatsReady();
  const state = calState(calibration);
  return useMemo(() => {
    if (!ready) return FALLBACK;
    try { return referenceStf(REFERENCE, state); } catch { return FALLBACK; }
  }, [ready, state]);
}


/*
 * Local hooks instead of the pipeline's useStack/useCalibratedRoi: those abort stale runs, and fetchRoi shares one
 * in-flight fetch (carrying the first caller's AbortSignal) between callers, so under StrictMode's double effect the
 * second run receives an already-aborted fetch and never settles (TODO.md). These run without a signal and simply
 * drop results that no longer match the latest request; the pipeline's result cache makes repeats free.
 */
function useLiveStack(req: StackRequest | null): { result: StackResult | null; pending: boolean } {
  const key = req ? canonicalKey(req) : null;
  const [state, setState] = useState<{ key: string | null; result: StackResult | null }>({ key: null, result: null });
  const latest = useRef(key);
  latest.current = key;
  const reqRef = useRef(req);
  reqRef.current = req;
  useEffect(() => {
    if (!key || !reqRef.current) return;
    let on = true;
    stack(reqRef.current).then(
      (result) => { if (on && latest.current === key) setState({ key, result }); },
      (err: Error) => { if (on) console.error('stack', err?.message ?? err); },
    );
    return () => { on = false; };
  }, [key]);
  const fresh = key !== null && state.key === key;
  return { result: fresh ? state.result : null, pending: key !== null && !fresh };
}

function useWholeFrame(id: string, bin: 1 | 2 | 4 | 8, calibration: CalibrationChoice): { data: Float32Array | null; w: number; h: number; pending: boolean } {
  const key = JSON.stringify({ id, bin, calibration });
  const [state, setState] = useState<{ key: string | null; data: Float32Array | null; w: number; h: number }>({ key: null, data: null, w: 0, h: 0 });
  const latest = useRef(key);
  latest.current = key;
  useEffect(() => {
    let on = true;
    calibrateRoi(id, null, bin, calibration).then(
      (r) => { if (on && latest.current === key) setState({ key, data: r.data, w: r.w, h: r.h }); },
      (err: Error) => { if (on) console.error('calibrateRoi', err?.message ?? err); },
    );
    return () => { on = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const fresh = state.key === key;
  return { data: fresh ? state.data : null, w: state.w, h: state.h, pending: !fresh };
}

const grid = (r: Rect, bin: 1 | 2 | 4 | 8): StackRequest['grid'] => ({ ref: REFERENCE, x: r.x, y: r.y, w: r.w, h: r.h, bin });
const regionRect = (region: RoiKey | 'wide'): Rect => (region === 'wide' ? WIDE_RECT : ROIS[region].rect);

/** Live stack of one region (ROI at bin 2, or the wide galaxy view at bin 2). */
export function useRegionStack(region: RoiKey | 'wide', inputs: StackInputs): { view: View | null; pending: boolean; empty: boolean } {
  const stf = useReferenceStf(inputs.calibration);
  const req = useMemo<StackRequest | null>(() => (inputs.frames.length === 0 ? null : {
    grid: grid(regionRect(region), 2), frames: inputs.frames, calibration: inputs.calibration, algorithm: { name: inputs.algorithm },
  }), [region, inputs.frames, inputs.calibration, inputs.algorithm]);
  const { result, pending } = useLiveStack(req);
  const view = useMemo<View | null>(() => {
    if (result) return { kind: 'raw', data: result.data, w: result.w, h: result.h, stf, rotate180: true };
    if (inputs.frames.length === 0) return null;
    // first paint before the first result: the bundled average/median of the default stack
    return { kind: 'img', src: stackSrc(region, inputs.algorithm === 'average' ? 'average' : 'median') };
  }, [result, stf, region, inputs.algorithm, inputs.frames.length]);
  return { view, pending, empty: inputs.frames.length === 0 };
}

/** The selected frame in the viewer: the whole calibrated frame at bin 4 (no warp) and its four ROIs at bin 2 on the reference grid. */
export function useFrameView(id: string, calibration: CalibrationChoice): { full: View | null; rois: Record<RoiKey, View | null>; pending: boolean } {
  const stf = useReferenceStf(calibration);
  const west = FRAME_BY_ID[id]?.pierSide === 'West';
  const whole = useWholeFrame(id, 4, calibration);
  const roiReq = (k: RoiKey): StackRequest => ({ grid: grid(ROIS[k].rect, 2), frames: [id], calibration, algorithm: { name: 'average' } });
  const trail = useLiveStack(useMemo(() => roiReq('trail'), [id, calibration]));
  const galaxy = useLiveStack(useMemo(() => roiReq('galaxy'), [id, calibration]));
  const group = useLiveStack(useMemo(() => roiReq('group'), [id, calibration]));
  const mote = useLiveStack(useMemo(() => roiReq('mote'), [id, calibration]));
  const rois = { trail, galaxy, group, mote };
  const toView = (k: RoiKey): View | null => {
    const r = rois[k].result;
    return r ? { kind: 'raw', data: r.data, w: r.w, h: r.h, stf, rotate180: true } : { kind: 'img', src: roiSrc(id, k) };
  };
  return {
    full: whole.data ? { kind: 'raw', data: whole.data, w: whole.w, h: whole.h, stf, rotate180: west } : { kind: 'img', src: fullSrc(id) },
    rois: { trail: toView('trail'), galaxy: toView('galaxy'), group: toView('group'), mote: toView('mote') },
    pending: whole.pending || trail.pending || galaxy.pending || group.pending || mote.pending,
  };
}

/** Stack the full reference grid at bin 1 and return an 8-bit PNG with the on-screen stretch (SPEC §4.6). */
export async function stackFullPng(inputs: StackInputs, onProgress: (done: number, total: number) => void, signal: AbortSignal): Promise<Blob> {
  const req: StackRequest = { grid: grid({ x: 0, y: 0, w: SENSOR.w, h: SENSOR.h }, 1), frames: inputs.frames, calibration: inputs.calibration, algorithm: { name: inputs.algorithm } };
  const result = await stack(req, { signal, onProgress });
  await statsPromise;
  const stf = referenceStf(REFERENCE, calState(inputs.calibration));
  return exportPng(result, stf, { rotate180: true });
}

export function pngFilename(inputs: StackInputs): string {
  const c = inputs.calibration;
  const calib = [c.bias && 'bias', c.dark && 'dark', c.darkFlat && 'darkflat', c.flat && `flat${c.flat}`].filter(Boolean).join('-') || 'nocal';
  return `ngc7331_stack_${inputs.frames.length}f_${inputs.algorithm}_${calib}.png`;
}
