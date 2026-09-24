/** Store access for the workbench pages: the shared store (docs/contracts.md) plus the WBPP calibration rule. */
export { useAppStore, RAW_FRAME_IDS } from '../../shared/store';
export type { AppState, FlatLevel, AlgorithmName, CalibrationChoice } from '../../shared/store';
import type { CalibrationChoice } from '../../shared/store';

/** SPEC §6.1: how WBPP turns the four choices into masters. */
export function calState(c: CalibrationChoice): string {
  const lightSub = c.dark ? 'dark' : c.bias ? 'bias' : 'none';
  const flatCal = c.darkFlat ? 'darkflat' : c.bias ? 'bias' : 'none';
  return `${lightSub}|${c.flat ? `flat_${c.flat}_${flatCal}` : 'none'}`;
}
