// Bar geometry for the "Average pixel brightness in this region" chart (Figma 61:771).
// The raw bar is 640 px (84 px cobalt bias share + 556 px cream rest); other values scale by the raw mean.
export const BAR_FULL = 640;
export function barPx(value: number, raw: number): number {
  return Math.round((value / raw) * BAR_FULL);
}
/** Cream "rest" segment: what remains of the raw bar once the bias share is taken away (556 px). */
export function restPx(bias: number, raw: number): number {
  return BAR_FULL - barPx(bias, raw);
}
