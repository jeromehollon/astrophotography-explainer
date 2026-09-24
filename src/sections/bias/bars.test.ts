import { describe, expect, it } from 'vitest';
import { barPx, restPx } from './bars';
import stats from './assets/stats.json';

describe('bias average-brightness bars', () => {
  const raw = Math.round(stats.experiment_1.roi_mean_raw_dn);
  it('draws the raw bar at 640 px and the bias share at 84 px, as in Figma', () => {
    expect(barPx(raw, raw)).toBe(640);
    expect(barPx(Math.round(stats.experiment_1.roi_mean_bias_dn), raw)).toBe(84);
  });
  it('shortens the computed bar by the bias share', () => {
    expect(restPx(Math.round(stats.experiment_1.roi_mean_bias_dn), raw)).toBe(556);
  });
});
