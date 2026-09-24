// Temporary local store with the shape fixed in docs/contracts.md. Swap for '../../shared/store'
// once Foundation lands it on main.
import { create } from 'zustand';

type FlatLevel = null | 10 | 50 | 85;
type AlgorithmName = 'average' | 'median' | 'kappaSigma' | 'winsorized' | 'rcr';
export type AppState = {
  calibration: { bias: boolean; dark: boolean; darkFlat: boolean; flat: FlatLevel };
  frames: string[];
  reference: string;
  algorithm: { name: AlgorithmName; params: Record<string, number> };
  set: (patch: Partial<Omit<AppState, 'set'>>) => void;
};
export const useAppStore = create<AppState>((set) => ({
  calibration: { bias: true, dark: true, darkFlat: true, flat: 50 },
  frames: Array.from({ length: 20 }, (_, i) => `f${String(i).padStart(2, '0')}`),
  reference: 'f03',
  algorithm: { name: 'median', params: {} },
  set: (patch) => set(patch),
}));
