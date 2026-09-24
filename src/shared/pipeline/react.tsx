// React bindings: useStack, useCalibratedRoi, RoiCanvas.

import { useEffect, useMemo, useRef, useState, type JSX } from 'react';
import { toImageData } from './display';
import { calibrateRoi, canonicalKey, stack } from './stack';
import type { Bin, CalibrationChoice, DisplayStf, Rect, StackRequest, StackResult } from './types';

export type UseStackState = { result: StackResult | null; pending: boolean; error?: string; progress: number };

/**
 * Runs stack(req) in the worker pool and re-runs when the canonical JSON of the request changes. Stale results
 * are dropped by key rather than by aborting: fetches are shared between callers (fetchRoi), the result cache
 * makes a repeated request free, and React StrictMode's double effect must not cancel the run it then reuses.
 */
export function useStack(req: StackRequest | null): UseStackState {
  const key = req ? canonicalKey(req) : null;
  const [state, setState] = useState<{ key: string | null; result: StackResult | null; error?: string; progress: number }>({ key: null, result: null, progress: 0 });
  const latest = useRef(key);
  latest.current = key;
  const reqRef = useRef(req);
  reqRef.current = req;
  useEffect(() => {
    if (!key || !reqRef.current) return;
    let on = true;
    stack(reqRef.current, {
      onProgress: (d, t) => { if (on && latest.current === key) setState((s) => (s.key === key ? s : { key, result: null, progress: t ? d / t : 1 })); },
    }).then(
      (result) => { if (on && latest.current === key) setState({ key, result, progress: 1 }); },
      (err: Error) => { if (on && latest.current === key) setState({ key, result: null, progress: 0, error: String(err?.message ?? err) }); },
    );
    return () => { on = false; };
  }, [key]);
  const fresh = key !== null && state.key === key;
  const done = fresh && (state.result !== null || state.error !== undefined);
  return { result: fresh ? state.result : null, pending: key !== null && !done, error: fresh ? state.error : undefined, progress: fresh ? state.progress : 0 };
}

export type UseRoiState = { data: Float32Array | null; w: number; h: number; rect: Rect | null; pending: boolean; error?: string };

/** One calibrated single-frame crop (sensor space, no warp) for lesson tiles. Stale results are dropped by key. */
export function useCalibratedRoi(id: string | null, rect: Rect | null, bin: Bin, calibration: CalibrationChoice): UseRoiState {
  const key = id ? JSON.stringify({ id, rect, bin, calibration }) : null;
  const [state, setState] = useState<{ key: string | null; data: Float32Array | null; w: number; h: number; rect: Rect | null; error?: string }>({ key: null, data: null, w: 0, h: 0, rect: null });
  const latest = useRef(key);
  latest.current = key;
  useEffect(() => {
    if (!key || !id) return;
    let on = true;
    const { rect: r, bin: b, calibration: c } = JSON.parse(key) as { rect: Rect | null; bin: Bin; calibration: CalibrationChoice };
    calibrateRoi(id, r, b, c).then(
      (res) => { if (on && latest.current === key) setState({ key, data: res.data, w: res.w, h: res.h, rect: res.rect }); },
      (err: Error) => { if (on && latest.current === key) setState({ key, data: null, w: 0, h: 0, rect: null, error: String(err?.message ?? err) }); },
    );
    return () => { on = false; };
  }, [key, id]);
  const fresh = key !== null && state.key === key;
  const done = fresh && (state.data !== null || state.error !== undefined);
  return { data: fresh ? state.data : null, w: fresh ? state.w : 0, h: fresh ? state.h : 0, rect: fresh ? state.rect : null, pending: key !== null && !done, error: fresh ? state.error : undefined };
}

export type RoiCanvasProps = {
  data: Float32Array | null;
  w: number; h: number;
  stf: DisplayStf;
  rotate180?: boolean;
  /** nearest-neighbour enlargement (image-rendering: pixelated) */
  pixelated?: boolean;
  /** CSS size of the canvas */
  width: number; height: number;
  className?: string;
  style?: React.CSSProperties;
};

/** Draws Float32 DN data through the display transfer onto a canvas at the given CSS size. */
export function RoiCanvas({ data, w, h, stf, rotate180, pixelated, width, height, className, style }: RoiCanvasProps): JSX.Element {
  const ref = useRef<HTMLCanvasElement>(null);
  const stfKey = JSON.stringify(stf);
  const dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1;
  const image = useMemo(() => (data && w > 0 && h > 0 ? toImageData(data, w, h, stf, { rotate180, nan: 'stage' }) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, w, h, stfKey, rotate180]);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = !pixelated;
    ctx.imageSmoothingQuality = 'high';
    if (!image) { ctx.fillStyle = '#0F1220'; ctx.fillRect(0, 0, canvas.width, canvas.height); return; }
    const off = document.createElement('canvas');
    off.width = w; off.height = h;
    off.getContext('2d')!.putImageData(image, 0, 0);
    ctx.fillStyle = '#0F1220';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(off, 0, 0, w, h, 0, 0, canvas.width, canvas.height);
  }, [image, w, h, pixelated, width, height, dpr]);
  return (
    <canvas
      ref={ref}
      width={Math.round(width * dpr)}
      height={Math.round(height * dpr)}
      className={className}
      style={{ width, height, imageRendering: pixelated ? 'pixelated' : 'auto', display: 'block', ...style }}
    />
  );
}
