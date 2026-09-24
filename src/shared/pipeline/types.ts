// Shared pipeline types (docs/contracts.md "Pipeline", SPEC §4.4, §6.1).

export type Bin = 1 | 2 | 4 | 8;
export type Rect = { x: number; y: number; w: number; h: number };
export type AlgorithmName = 'average' | 'median' | 'kappaSigma' | 'winsorized' | 'rcr';
export type FlatLevel = null | 10 | 50 | 85;
export type CalibrationChoice = { bias: boolean; dark: boolean; darkFlat: boolean; flat: FlatLevel };

export type StackRequest = {
  /** Output rect in the reference frame's oriented sensor grid at bin 1 (SPEC §4.1); x,y,w,h multiples of bin. */
  grid: { ref: string; x: number; y: number; w: number; h: number; bin: Bin };
  frames: string[];
  calibration: CalibrationChoice;
  algorithm: { name: AlgorithmName; params?: Record<string, number> };
  /** default true; false = naive stack: every frame is read on the reference's own grid, no warp (Alignment lesson). */
  align?: boolean;
};

export type StackResult = { data: Float32Array; w: number; h: number; noise: number; ms: number };

export type StfParams = { c0: number; m: number };
export type LinearRange = { linearLo: number; linearHi: number };
export type DisplayStf = StfParams | LinearRange;

/** 3×3 row-major homography. */
export type Mat3 = [number, number, number, number, number, number, number, number, number];
