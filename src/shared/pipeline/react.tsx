// React bindings: useStack, useCalibratedRoi, RoiCanvas.

import { useEffect, useMemo, useRef, useState, type JSX } from 'react';
import { toImageData } from './display';
import { calibrateRoi, canonicalKey, stack } from './stack';
import type { Bin, CalibrationChoice, DisplayStf, Rect, StackRequest, StackResult } from './types';

export type UseStackState = { result: StackResult | null; pending: boolean; error?: string; progress: number };

/** Runs stack(req) in the worker pool; re-runs when the canonical JSON of the request changes; aborts stale runs. */
export function useStack(req: StackRequest | null): UseStackState {
  const key = req ? canonicalKey(req) : null;
  const [state, setState] = useState<UseStackState>({ result: null, pending: !!req, progress: 0 });
  const reqRef = useRef(req);
  reqRef.current = req;
  useEffect(() => {
    if (!key || !reqRef.current) { setState({ result: null, pending: false, progress: 0 }); return; }
    const ac = new AbortController();
    setState((s) => ({ ...s, pending: true, error: undefined, progress: 0 }));
    stack(reqRef.current, {
      signal: ac.signal,
      onProgress: (d, t) => { if (!ac.signal.aborted) setState((s) => ({ ...s, progress: t ? d / t : 1 })); },
    }).then(
      (result) => { if (!ac.signal.aborted) setState({ result, pending: false, progress: 1 }); },
      (err: Error) => { if (!ac.signal.aborted && err?.name !== 'AbortError') setState((s) => ({ ...s, pending: false, error: String(err?.message ?? err) })); },
    );
    return () => ac.abort();
  }, [key]);
  return state;
}

export type UseRoiState = { data: Float32Array | null; w: number; h: number; rect: Rect | null; pending: boolean; error?: string };

/** One calibrated single-frame crop (sensor space, no warp) for lesson tiles. */
export function useCalibratedRoi(id: string | null, rect: Rect | null, bin: Bin, calibration: CalibrationChoice): UseRoiState {
  const key = JSON.stringify({ id, rect, bin, calibration });
  const [state, setState] = useState<UseRoiState>({ data: null, w: 0, h: 0, rect: null, pending: !!id });
  useEffect(() => {
    if (!id) { setState({ data: null, w: 0, h: 0, rect: null, pending: false }); return; }
    const ac = new AbortController();
    const { rect: r, bin: b, calibration: c } = JSON.parse(key) as { rect: Rect | null; bin: Bin; calibration: CalibrationChoice };
    setState((s) => ({ ...s, pending: true, error: undefined }));
    calibrateRoi(id, r, b, c, { signal: ac.signal }).then(
      (res) => { if (!ac.signal.aborted) setState({ data: res.data, w: res.w, h: res.h, rect: res.rect, pending: false }); },
      (err: Error) => { if (!ac.signal.aborted && err?.name !== 'AbortError') setState((s) => ({ ...s, pending: false, error: String(err?.message ?? err) })); },
    );
    return () => ac.abort();
  }, [key, id]);
  return state;
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
