// Web Worker entry: runs FrameJob / IntegrateJob messages and posts the result back with transfer.

import { runFrameJob, runIntegrateJob, type FrameJob, type IntegrateJob } from './jobs';

type Msg = { id: number; kind: 'frame'; job: FrameJob } | { id: number; kind: 'integrate'; job: IntegrateJob };

self.onmessage = (e: MessageEvent<Msg>) => {
  const { id, kind, job } = e.data;
  try {
    const t0 = performance.now();
    const data = kind === 'frame' ? runFrameJob(job as FrameJob) : runIntegrateJob(job as IntegrateJob);
    (self as unknown as Worker).postMessage({ id, ok: true, data, ms: performance.now() - t0 }, [data.buffer]);
  } catch (err) {
    (self as unknown as Worker).postMessage({ id, ok: false, error: String((err as Error)?.message ?? err) });
  }
};
