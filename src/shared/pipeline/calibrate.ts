// Calibration choice → WBPP master selection (SPEC §6.1) and the calibration formula (SPEC §6.2).
// Everything in sensor space, float32, DN. No pedestal, no truncation, no cosmetic correction.

import type { CalibrationChoice } from './types';

export type LightSub = 'dark' | 'bias' | 'none';
export type FlatCal = 'darkflat' | 'bias' | 'none';

/** D = MD | MB | 0. The bias is not applied to lights when a dark is selected (the dark carries the pedestal). */
export function lightSub(c: CalibrationChoice): LightSub {
  return c.dark ? 'dark' : c.bias ? 'bias' : 'none';
}

/** How the chosen master flat was calibrated: selects flat_<level>_<flatCal>. */
export function flatCal(c: CalibrationChoice): FlatCal {
  return c.darkFlat ? 'darkflat' : c.bias ? 'bias' : 'none';
}

/** Master flat asset id, or null when no flat is selected. */
export function flatId(c: CalibrationChoice): string | null {
  return c.flat ? `flat_${c.flat}_${flatCal(c)}` : null;
}

/** Master asset id subtracted from the light, or null. */
export function subtractId(c: CalibrationChoice): string | null {
  const s = lightSub(c);
  return s === 'none' ? null : s;
}

/** Key into normalization.json (30 states): `${lightSub}|${flatId ?? 'none'}`. */
export function calState(c: CalibrationChoice): string {
  return `${lightSub(c)}|${flatId(c) ?? 'none'}`;
}

/**
 * C = (L − D) / (MF / f_v) when a flat is given, otherwise C = L − D. `f_v` is the master flat's 5% two-sided
 * trimmed mean in DN (masters.json `scale_f_v.dn`), so the light's overall level does not change.
 * `dark` and `flat` are crops of the same sensor rectangle as `light` at the same bin. Returns a new Float32Array.
 */
export function calibrate(light: Float32Array, dark: Float32Array | null, flat: Float32Array | null, fV = 1): Float32Array {
  const n = light.length;
  const out = new Float32Array(n);
  if (dark && dark.length !== n) throw new Error('calibrate: dark size mismatch');
  if (flat && flat.length !== n) throw new Error('calibrate: flat size mismatch');
  if (dark && flat) for (let i = 0; i < n; i++) out[i] = ((light[i] - dark[i]) * fV) / flat[i];
  else if (dark) for (let i = 0; i < n; i++) out[i] = light[i] - dark[i];
  else if (flat) for (let i = 0; i < n; i++) out[i] = (light[i] * fV) / flat[i];
  else out.set(light);
  return out;
}
