// Worker pool: hardwareConcurrency − 1 module workers, a FIFO queue, one in-flight job per worker.

import type { Executor, FrameJob, IntegrateJob } from './jobs';
import { inlineExecutor } from './jobs';

type Pending = { resolve: (v: Float32Array) => void; reject: (e: Error) => void; kind: 'frame' | 'integrate'; t0: number };

/** Timing counters (debug/benchmarks): in-worker compute ms and wall ms per job kind. */
export const poolStats = { frameJobs: 0, frameComputeMs: 0, frameWallMs: 0, integrateJobs: 0, integrateComputeMs: 0, integrateWallMs: 0, reset() { this.frameJobs = this.frameComputeMs = this.frameWallMs = this.integrateJobs = this.integrateComputeMs = this.integrateWallMs = 0; } };
type Queued = { kind: 'frame' | 'integrate'; job: FrameJob | IntegrateJob; transfer: ArrayBufferLike[] } & Pending;

class WorkerPool implements Executor {
  private workers: Worker[] = [];
  private idle: Worker[] = [];
  private queue: Queued[] = [];
  private pending = new Map<number, Pending>();
  private byWorker = new Map<Worker, number>();
  private nextId = 1;
  readonly lanes: number;

  constructor(n: number) {
    this.lanes = n;
    for (let i = 0; i < n; i++) {
      const w = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
      w.onmessage = (e: MessageEvent<{ id: number; ok: boolean; data?: Float32Array; error?: string; ms?: number }>) => {
        const p = this.pending.get(e.data.id);
        this.pending.delete(e.data.id);
        this.byWorker.delete(w);
        this.idle.push(w);
        if (p) {
          if (p.kind === 'frame') { poolStats.frameJobs++; poolStats.frameComputeMs += e.data.ms ?? 0; poolStats.frameWallMs += performance.now() - p.t0; }
          else { poolStats.integrateJobs++; poolStats.integrateComputeMs += e.data.ms ?? 0; poolStats.integrateWallMs += performance.now() - p.t0; }
          e.data.ok ? p.resolve(e.data.data!) : p.reject(new Error(e.data.error));
        }
        this.pump();
      };
      w.onerror = (ev) => {
        const id = this.byWorker.get(w);
        if (id !== undefined) { this.pending.get(id)?.reject(new Error(ev.message)); this.pending.delete(id); }
        this.byWorker.delete(w);
        this.idle.push(w);
        this.pump();
      };
      this.workers.push(w);
      this.idle.push(w);
    }
    this.warmUp();
  }

  /** Run one small job per worker so each isolate JIT-compiles the warp before the first real request. */
  private warmUp() {
    const n = 96;
    const src = new Float32Array(n * n).fill(500);
    for (let i = 0; i < this.lanes; i++) {
      const job: FrameJob = { light: src, dark: src, flat: src, fV: 1, src: { x: 0, y: 0, w: n, h: n }, imageW: n, imageH: n,
        M: [1, 0, 0.37, 0, 1, 0.61, 0, 0, 1], ox: 0, oy: 0, outW: n - 8, outH: n - 8, norm: { scale: 1, offset: 0 } };
      this.frame(job).catch(() => {});
    }
  }

  private pump() {
    while (this.idle.length && this.queue.length) {
      const w = this.idle.pop()!;
      const q = this.queue.shift()!;
      const id = this.nextId++;
      this.pending.set(id, { ...q, t0: performance.now() });
      this.byWorker.set(w, id);
      w.postMessage({ id, kind: q.kind, job: q.job }, q.transfer as ArrayBuffer[]);
    }
  }

  private submit(kind: 'frame' | 'integrate', job: FrameJob | IntegrateJob, transfer: ArrayBufferLike[]): Promise<Float32Array> {
    return new Promise((resolve, reject) => {
      this.queue.push({ kind, job, transfer, resolve, reject, t0: 0 });
      this.pump();
    });
  }

  frame(job: FrameJob): Promise<Float32Array> {
    // The light/master buffers belong to the fetch cache; copy so the transfer does not detach them.
    const j: FrameJob = { ...job, light: job.light.slice(), dark: job.dark ? job.dark.slice() : null, flat: job.flat ? job.flat.slice() : null };
    const transfer = [j.light.buffer, ...(j.dark ? [j.dark.buffer] : []), ...(j.flat ? [j.flat.buffer] : [])];
    return this.submit('frame', j, transfer);
  }

  integrate(job: IntegrateJob): Promise<Float32Array> {
    // Only the needed rows travel; each band copy is transferred.
    const w = job.w;
    const frames = job.frames.map((f) => f.slice(job.row0 * w, job.row1 * w));
    const j: IntegrateJob = { ...job, frames, h: job.row1 - job.row0, row0: 0, row1: job.row1 - job.row0 };
    return this.submit('integrate', j, frames.map((f) => f.buffer));
  }
}

let shared: Executor | null = null;

/** The process-wide executor: a worker pool in the browser, inline in node/tests. */
export function getExecutor(): Executor {
  if (shared) return shared;
  if (typeof Worker !== 'undefined' && typeof window !== 'undefined') {
    const n = Math.max(1, (navigator.hardwareConcurrency || 4) - 1);
    shared = new WorkerPool(n);
  } else {
    shared = inlineExecutor;
  }
  return shared;
}

export function setExecutor(e: Executor | null): void { shared = e; }
