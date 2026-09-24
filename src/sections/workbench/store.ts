/**
 * Store access for the workbench pages. Re-exports the shared store (docs/contracts.md) once the
 * foundation lands it on main; until then a local zustand store with the identical shape.
 */
import { create } from 'zustand';

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

export const useAppStore = create<AppState>((set) => ({
  calibration: { bias: true, dark: true, darkFlat: true, flat: 50 },
  frames: Array.from({ length: 20 }, (_, i) => `f${String(i).padStart(2, '0')}`),
  reference: 'f03',
  algorithm: { name: 'median', params: {} },
  set: (patch) => set(patch),
}));

/** SPEC §6.1: how WBPP turns the four choices into masters. */
export function calState(c: CalibrationChoice): string {
  const lightSub = c.dark ? 'dark' : c.bias ? 'bias' : 'none';
  const flatCal = c.darkFlat ? 'darkflat' : c.bias ? 'bias' : 'none';
  return `${lightSub}|${c.flat ? `flat_${c.flat}_${flatCal}` : 'none'}`;
}
