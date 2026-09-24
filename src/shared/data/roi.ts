// GET /api/roi client (SPEC §4.3) with a byte-capped LRU keyed by (id, rect, bin). u16 bodies are promoted to f32.

import { ByteLru } from './lru';
import { dataBase } from './json';

export type Rect = { x: number; y: number; w: number; h: number };
export type RoiResult = { data: Float32Array; w: number; h: number; rect: Rect; dtype: 'u16' | 'f32' };

export const roiCache = new ByteLru<RoiResult>(768 * 1024 * 1024);

/**
 * One in-flight fetch per key, shared by every caller. The fetch runs on its own AbortController and is
 * aborted only when every waiter has aborted (refcount), so a caller's cancel never kills another caller's
 * request. Each waiter's promise rejects with its own AbortError as soon as its signal fires.
 */
type Inflight = { promise: Promise<RoiResult>; controller: AbortController; waiters: number };
const inflight = new Map<string, Inflight>();

export function roiKey(id: string, rect: Rect | null, bin: number): string {
  return rect ? `${id}|${rect.x},${rect.y},${rect.w},${rect.h}|${bin}` : `${id}|all|${bin}`;
}

export function roiUrl(id: string, rect: Rect | null, bin: number): string {
  const q = new URLSearchParams({ id, bin: String(bin) });
  if (rect) { q.set('x', String(rect.x)); q.set('y', String(rect.y)); q.set('w', String(rect.w)); q.set('h', String(rect.h)); }
  return `${dataBase}/api/roi?${q}`;
}

export function parseRoiHeaders(h: { get(name: string): string | null }): { rect: Rect; w: number; h: number; dtype: 'u16' | 'f32' } {
  const roi = (h.get('X-Roi') ?? '').split(',').map(Number);
  const w = Number(h.get('X-Width')), hh = Number(h.get('X-Height'));
  const dtype = (h.get('X-Dtype') ?? 'f32') as 'u16' | 'f32';
  if (roi.length !== 4 || roi.some((v) => !Number.isFinite(v)) || !Number.isFinite(w) || !Number.isFinite(hh)) {
    throw new Error('roi: malformed response headers');
  }
  return { rect: { x: roi[0], y: roi[1], w: roi[2], h: roi[3] }, w, h: hh, dtype };
}

export function decodeRoiBody(buf: ArrayBuffer, dtype: 'u16' | 'f32', n: number): Float32Array {
  if (dtype === 'u16') {
    const u = new Uint16Array(buf, 0, n);
    const f = new Float32Array(n);
    for (let i = 0; i < n; i++) f[i] = u[i];
    return f;
  }
  return new Float32Array(buf, 0, n);
}

function abortError(): Error {
  return typeof DOMException !== 'undefined' ? new DOMException('roi fetch aborted', 'AbortError') : Object.assign(new Error('roi fetch aborted'), { name: 'AbortError' });
}

/** Fetch a sensor-space rect (bin-1 units; multiples of bin) of one asset at the given bin. Cached, abort-safe. */
export function fetchRoi(id: string, rect: Rect | null, bin: 1 | 2 | 4 | 8, opts: { signal?: AbortSignal } = {}): Promise<RoiResult> {
  const key = roiKey(id, rect, bin);
  const hit = roiCache.get(key);
  if (hit) return Promise.resolve(hit);
  if (opts.signal?.aborted) return Promise.reject(abortError());
  let entry = inflight.get(key);
  if (!entry) {
    const controller = new AbortController();
    const promise = (async () => {
      const r = await fetch(roiUrl(id, rect, bin), { signal: controller.signal });
      if (!r.ok) throw new Error(`roi ${id}: HTTP ${r.status}`);
      const meta = parseRoiHeaders(r.headers);
      const buf = await r.arrayBuffer();
      const data = decodeRoiBody(buf, meta.dtype, meta.w * meta.h);
      const res: RoiResult = { data, w: meta.w, h: meta.h, rect: meta.rect, dtype: meta.dtype };
      roiCache.set(key, res, data.byteLength);
      return res;
    })();
    entry = { promise, controller, waiters: 0 };
    inflight.set(key, entry);
    promise.finally(() => { if (inflight.get(key) === entry) inflight.delete(key); }).catch(() => {});
  }
  const e = entry;
  e.waiters++;
  const signal = opts.signal;
  if (!signal) return e.promise;
  return new Promise<RoiResult>((resolve, reject) => {
    let settled = false;
    const onAbort = () => {
      if (settled) return;
      settled = true;
      if (--e.waiters === 0) e.controller.abort();
      reject(abortError());
    };
    signal.addEventListener('abort', onAbort, { once: true });
    e.promise.then(
      (v) => { if (!settled) { settled = true; signal.removeEventListener('abort', onAbort); resolve(v); } },
      (err) => { if (!settled) { settled = true; signal.removeEventListener('abort', onAbort); reject(err); } },
    );
  });
}

/** Number of shared fetches currently in flight (tests). */
export function inflightCount(): number { return inflight.size; }
