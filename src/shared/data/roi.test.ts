import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchRoi, inflightCount, roiCache } from './roi';

/** A fetch stub that resolves on demand and reports whether its signal was aborted. */
function stubFetch() {
  const calls: { url: string; signal: AbortSignal; resolve: () => void }[] = [];
  const body = () => {
    const u = new Uint16Array([1, 2, 3, 4]);
    return {
      ok: true,
      headers: { get: (k: string) => ({ 'X-Roi': '0,0,2,2', 'X-Width': '2', 'X-Height': '2', 'X-Dtype': 'u16' })[k] ?? null },
      arrayBuffer: async () => u.buffer,
    } as unknown as Response;
  };
  const f = vi.fn((url: string, init?: RequestInit) => new Promise<Response>((resolve, reject) => {
    const signal = init!.signal!;
    signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
    calls.push({ url, signal, resolve: () => resolve(body()) });
  }));
  return { f, calls };
}

describe('fetchRoi in-flight sharing is abort-safe', () => {
  let stub: ReturnType<typeof stubFetch>;
  beforeEach(() => { stub = stubFetch(); vi.stubGlobal('fetch', stub.f); roiCache.clear(); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('the first caller aborting does not abort the shared fetch; the second caller still resolves', async () => {
    const a = new AbortController();
    const p1 = fetchRoi('f03', { x: 0, y: 0, w: 2, h: 2 }, 1, { signal: a.signal });
    const p2 = fetchRoi('f03', { x: 0, y: 0, w: 2, h: 2 }, 1, { signal: new AbortController().signal });
    expect(stub.f).toHaveBeenCalledTimes(1);
    a.abort();
    await expect(p1).rejects.toMatchObject({ name: 'AbortError' });
    expect(stub.calls[0].signal.aborted).toBe(false);
    stub.calls[0].resolve();
    const r = await p2;
    expect(Array.from(r.data)).toEqual([1, 2, 3, 4]);
    expect(r.dtype).toBe('u16');
    expect(inflightCount()).toBe(0);
    // now cached: no new fetch
    await fetchRoi('f03', { x: 0, y: 0, w: 2, h: 2 }, 1);
    expect(stub.f).toHaveBeenCalledTimes(1);
  });

  it('the shared fetch is aborted only when every waiter has aborted', async () => {
    const a = new AbortController(), b = new AbortController();
    const p1 = fetchRoi('f02', null, 2, { signal: a.signal });
    const p2 = fetchRoi('f02', null, 2, { signal: b.signal });
    a.abort();
    await expect(p1).rejects.toMatchObject({ name: 'AbortError' });
    expect(stub.calls[0].signal.aborted).toBe(false);
    b.abort();
    await expect(p2).rejects.toMatchObject({ name: 'AbortError' });
    expect(stub.calls[0].signal.aborted).toBe(true);
    await new Promise((r) => setTimeout(r, 0));
    expect(inflightCount()).toBe(0);
    // a fresh caller after the abort starts a new fetch (StrictMode's second effect)
    const p3 = fetchRoi('f02', null, 2);
    expect(stub.f).toHaveBeenCalledTimes(2);
    stub.calls[1].resolve();
    expect((await p3).w).toBe(2);
  });

  it('a caller without a signal keeps the fetch alive when the signalled caller aborts', async () => {
    const a = new AbortController();
    const p1 = fetchRoi('f05', null, 4, { signal: a.signal });
    const p2 = fetchRoi('f05', null, 4);
    a.abort();
    await expect(p1).rejects.toMatchObject({ name: 'AbortError' });
    expect(stub.calls[0].signal.aborted).toBe(false);
    stub.calls[0].resolve();
    expect((await p2).h).toBe(2);
  });

  it('an already-aborted signal rejects without fetching', async () => {
    const a = new AbortController(); a.abort();
    await expect(fetchRoi('f06', null, 1, { signal: a.signal })).rejects.toMatchObject({ name: 'AbortError' });
    expect(stub.f).not.toHaveBeenCalled();
  });
});
