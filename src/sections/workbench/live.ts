/**
 * Adapter between the two pages and the stacking pipeline (docs/contracts.md, src/shared/pipeline).
 * While the pipeline is not on main, every view falls back to the bundled PNGs from assets/ so the
 * pages render exactly as Figma shows them. LIVE flips to true when the real pipeline is wired in.
 */
import { useEffect, useMemo, useState } from 'react';
import type { AlgorithmName, CalibrationChoice } from './store';
import { fullSrc, roiSrc, stackSrc, type RoiKey } from './data';

export const LIVE = false;

export type View = { kind: 'img'; src: string; rotate180?: boolean };

export type StackInputs = { frames: string[]; calibration: CalibrationChoice; algorithm: AlgorithmName };

/** Live stack of one region (ROI at bin 2, or the wide galaxy view at bin 2), rotated 180° for display (item 27). */
export function useRegionStack(region: RoiKey | 'wide', inputs: StackInputs): { view: View | null; pending: boolean; empty: boolean } {
  const key = `${region}|${inputs.algorithm}|${[...inputs.frames].sort().join(',')}|${JSON.stringify(inputs.calibration)}`;
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  useEffect(() => {
    // Fallback: a short pending state so the tiles behave like the live ones.
    setPendingKey(key);
    const t = setTimeout(() => setPendingKey(null), 120);
    return () => clearTimeout(t);
  }, [key]);
  const view = useMemo<View | null>(() => {
    if (inputs.frames.length === 0) return null;
    const method = inputs.algorithm === 'average' ? 'average' : 'median';
    return { kind: 'img', src: stackSrc(region, method) };
  }, [region, inputs.algorithm, inputs.frames.length]);
  return { view, pending: pendingKey !== null, empty: inputs.frames.length === 0 };
}

/** The selected frame in the viewer: the whole frame at bin 4 and its four ROIs at bin 2. */
export function useFrameView(id: string, _calibration: CalibrationChoice): { full: View | null; rois: Record<RoiKey, View | null>; pending: boolean } {
  return useMemo(() => ({
    full: { kind: 'img' as const, src: fullSrc(id) },
    rois: { trail: { kind: 'img' as const, src: roiSrc(id, 'trail') }, galaxy: { kind: 'img' as const, src: roiSrc(id, 'galaxy') }, group: { kind: 'img' as const, src: roiSrc(id, 'group') }, mote: { kind: 'img' as const, src: roiSrc(id, 'mote') } },
    pending: false,
  }), [id]);
}

/** Stack the full reference grid at bin 1 and return an 8-bit PNG with the on-screen stretch. */
export async function stackFullPng(inputs: StackInputs, onProgress: (done: number, total: number) => void, signal: AbortSignal): Promise<Blob> {
  const total = inputs.frames.length;
  for (let i = 1; i <= total; i++) {
    await new Promise((r) => setTimeout(r, 150));
    if (signal.aborted) throw new DOMException('cancelled', 'AbortError');
    onProgress(i, total);
  }
  const method = inputs.algorithm === 'average' ? 'average' : 'median';
  const res = await fetch(stackSrc('wide', method), { signal });
  return await res.blob();
}

export function pngFilename(inputs: StackInputs): string {
  const c = inputs.calibration;
  const calib = [c.bias && 'bias', c.dark && 'dark', c.darkFlat && 'darkflat', c.flat && `flat${c.flat}`].filter(Boolean).join('-') || 'nocal';
  return `ngc7331_stack_${inputs.frames.length}f_${inputs.algorithm}_${calib}.png`;
}
