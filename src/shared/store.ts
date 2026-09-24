import { create } from 'zustand';

/** Shared app state (docs/contracts.md). One store, read by lesson pages and the workbench. */
export type FlatLevel = null | 10 | 50 | 85;
export type AlgorithmName = 'average' | 'median' | 'kappaSigma' | 'winsorized' | 'rcr';
export type CalibrationChoice = { bias: boolean; dark: boolean; darkFlat: boolean; flat: FlatLevel };

export type AppState = {
  calibration: CalibrationChoice;
  frames: string[];
  reference: string;
  algorithm: { name: AlgorithmName; params: Record<string, number> };
  set: (patch: Partial<Omit<AppState, 'set'>>) => void;
};

/** The 20 raw light ids, f00..f19 (synthetic variants are not selected by default). */
export const RAW_FRAME_IDS: string[] = Array.from({ length: 20 }, (_, i) => `f${String(i).padStart(2, '0')}`);

export const useAppStore = create<AppState>((set) => ({
  calibration: { bias: true, dark: true, darkFlat: true, flat: 50 },
  frames: [...RAW_FRAME_IDS],
  reference: 'f03',
  algorithm: { name: 'median', params: {} },
  set: (patch) => set(patch),
}));
