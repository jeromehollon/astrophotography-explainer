// Pure, transferable work units that run either inline or in a worker (worker.ts).

import { calibrate } from './calibrate';
import { integrateFrames } from './integrate';
import { normalizeInPlace, type NormCoeff } from './normalize';
import { warpLanczos3 } from './warp';
import type { AlgorithmName, Mat3 } from './types';

export type FrameJob = {
  light: Float32Array;
  dark: Float32Array | null;
  flat: Float32Array | null;
  fV: number;
  /** crop rect in the frame's bin-b sample grid */
  src: { x: number; y: number; w: number; h: number };
  imageW: number; imageH: number;
  /** output bin-b grid → frame bin-b grid */
  M: Mat3;
  ox: number; oy: number; outW: number; outH: number;
  norm: NormCoeff;
};

export type IntegrateJob = {
  frames: Float32Array[];
  w: number; h: number;
  name: AlgorithmName;
  params: Record<string, number>;
  row0: number; row1: number;
};

export function runFrameJob(j: FrameJob): Float32Array {
  const cal = calibrate(j.light, j.dark, j.flat, j.fV);
  const warped = warpLanczos3({ data: cal, x: j.src.x, y: j.src.y, w: j.src.w, h: j.src.h, imageW: j.imageW, imageH: j.imageH }, j.M, j.ox, j.oy, j.outW, j.outH);
  return normalizeInPlace(warped, j.norm);
}

/** Returns only rows [row0,row1) of the integration, packed. */
export function runIntegrateJob(j: IntegrateJob): Float32Array {
  const rows = j.row1 - j.row0;
  const full = integrateFrames(j.frames, j.w, j.h, j.name, j.params, new Float32Array(j.w * j.h), j.row0, j.row1);
  return rows === j.h ? full : full.slice(j.row0 * j.w, j.row1 * j.w);
}

export type Executor = {
  frame(job: FrameJob): Promise<Float32Array>;
  integrate(job: IntegrateJob): Promise<Float32Array>;
  /** number of parallel lanes (1 for inline) */
  lanes: number;
};

export const inlineExecutor: Executor = {
  lanes: 1,
  frame: async (j) => runFrameJob(j),
  integrate: async (j) => runIntegrateJob(j),
};
