// Public API of the browser pipeline (docs/contracts.md "Pipeline"; SPEC §4.4, §4.5, §6).

export type { StackRequest, StackResult, CalibrationChoice, AlgorithmName, Bin, Rect, StfParams, DisplayStf, LinearRange, Mat3, FlatLevel } from './types';
export { stack, calibrateRoi, stackWith, canonicalKey, resultCache, backgroundNoise, gridToSensor, getLiveSources, frameTransform } from './stack';
export type { Sources, FrameInfo } from './stack';
export { fetchRoi, roiCache } from '../data/roi';
export { fetchManifest, fetchNormalization, fetchMasters, fetchJson, setDataBase } from '../data/json';
export { autoStf, mtf, stfLut, stfTable, displayLut, medianMadn, percentiles, DN_MAX } from './stf';
export { toImageData, toRgba, difference, differenceRange, rotate180, NAN_RGB } from './display';
export { calState, lightSub, flatCal, flatId, subtractId, calibrate } from './calibrate';
export { footprint, outputToFrame, scaleMatrix, flipMatrix, applyH, mat3Mul, mat3Inv, LANCZOS_RADIUS } from './geometry';
export { warpLanczos3, lanczos3, binMean } from './warp';
export { normCoeff, normalizeInPlace } from './normalize';
export type { NormStats, NormCoeff } from './normalize';
export { integrateFrames, integrate1d, DEFAULT_PARAMS, erf, erfinv } from './integrate';
export { useStack, useCalibratedRoi, RoiCanvas } from './react';
export type { RoiCanvasProps, UseStackState, UseRoiState } from './react';
export { exportPng, exportFits, exportFilename, fitsHeaderFor, calibTag } from './export';
export { getExecutor, setExecutor, poolStats } from './pool';
export { inlineExecutor } from './jobs';

import { fetchNormalization } from '../data/json';
import { autoStf } from './stf';
import type { StfParams } from './types';

const normCache = new Map<string, StfParams>();
let normJson: Awaited<ReturnType<typeof fetchNormalization>> | null = null;

/** Preload normalization.json so referenceStf() can be synchronous (SPEC §4.5). Call once at app start. */
export async function loadReferenceStats(): Promise<void> {
  normJson = await fetchNormalization();
  normCache.clear();
}

/** Inject stats directly (tests). */
export function setReferenceStats(json: Awaited<ReturnType<typeof fetchNormalization>>): void { normJson = json; normCache.clear(); }

/**
 * AutoSTF for the reference frame's precomputed median and MADN in the given calState (SPEC §4.5), so every view
 * in that state shares one stretch. Requires loadReferenceStats() to have resolved; throws otherwise.
 */
export function referenceStf(reference: string, calState: string, opts: { targetBg?: number; clip?: number } = {}): StfParams {
  const key = `${reference}|${calState}|${opts.targetBg ?? 0.25}|${opts.clip ?? -2.8}`;
  const hit = normCache.get(key);
  if (hit) return hit;
  if (!normJson) throw new Error('referenceStf: call loadReferenceStats() first');
  const s = normJson.frames[reference]?.states[calState];
  if (!s) throw new Error(`referenceStf: no stats for ${reference} ${calState}`);
  const p = autoStf(s.median_dn, s.madn_dn, opts);
  normCache.set(key, p);
  return p;
}

/** The reference frame's own background noise (MADN, DN) in a calState, for the "N× less noise" ratio. */
export function referenceNoise(reference: string, calState: string): number {
  if (!normJson) throw new Error('referenceNoise: call loadReferenceStats() first');
  const s = normJson.frames[reference]?.states[calState];
  if (!s) throw new Error(`referenceNoise: no stats for ${reference} ${calState}`);
  return s.madn_dn;
}
