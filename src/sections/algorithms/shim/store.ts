// Temporary stand-in for src/shared/store.ts (owner: foundation). Same shape as
// docs/contracts.md so the page can switch to the shared store with an import change.
import { create } from 'zustand';

type FlatLevel = null | 10 | 50 | 85;
export type AlgorithmName = 'average' | 'median' | 'kappaSigma' | 'winsorized' | 'rcr';
export type AppState = {
  calibration: { bias: boolean; dark: boolean; darkFlat: boolean; flat: FlatLevel };
  frames: string[];
  reference: string;
  algorithm: { name: AlgorithmName; params: Record<string, number> };
  set: (patch: Partial<Omit<AppState, 'set'>>) => void;
};

const rawIds = Array.from({ length: 20 }, (_, i) => `f${String(i).padStart(2, '0')}`);

export const useAppStore = create<AppState>((set) => ({
  calibration: { bias: true, dark: true, darkFlat: true, flat: 50 },
  frames: rawIds,
  reference: 'f03',
  algorithm: { name: 'median', params: {} },
  set: (patch) => set(patch),
}));
