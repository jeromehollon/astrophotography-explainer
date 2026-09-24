import { describe, expect, it } from 'vitest';
import { ALL_FRAMES, RAW_FRAMES, SCENARIOS, matchScenario } from './scenarios';
import { ROIS, WIDE_RECT } from './data';

const FULL = { bias: true, dark: true, darkFlat: true, flat: 50 as const };

describe('scenarios (SPEC §7 P9 table)', () => {
  it('defines the five scenarios with the frames and methods from the table', () => {
    const byId = Object.fromEntries(SCENARIOS.map((s) => [s.id, s]));
    expect(byId.default.frames).toEqual(RAW_FRAMES);
    expect(byId.default.algorithm).toBe('median');
    expect(byId.naive.frames).toEqual(ALL_FRAMES);
    expect(byId.naive.algorithm).toBe('average');
    expect(byId.satellite.frames).toEqual(['f03', 'f02', 'f04', 'f05', 'f07']);
    expect(byId.cloud.frames).toEqual(['f14_cloud', 'f15_cloud', 'f16_cloud', 'f09', 'f13']);
    expect(byId.tracking.frames).toEqual(['f11_tracking', 'f09', 'f13']);
    for (const s of SCENARIOS) expect(s.calibration).toEqual(FULL);
  });
  it('matches the store state back to a scenario regardless of frame order', () => {
    expect(matchScenario(['f13', 'f09', 'f11_tracking'], 'average', FULL)?.id).toBe('tracking');
    expect(matchScenario(RAW_FRAMES, 'median', { ...FULL, flat: 10 })).toBeUndefined();
    expect(matchScenario(RAW_FRAMES, 'average', FULL)).toBeUndefined();
  });
});

describe('ROI rectangles (design-notes item 29)', () => {
  it('are 1440×960 in f03 sensor space, aligned to bin 2', () => {
    for (const r of Object.values(ROIS)) {
      expect([r.rect.w, r.rect.h]).toEqual([1440, 960]);
      expect(r.rect.x % 2).toBe(0);
      expect(r.rect.y % 2).toBe(0);
    }
    expect(ROIS.trail.rect).toEqual({ x: 4040, y: 2370, w: 1440, h: 960 });
    expect(WIDE_RECT).toEqual({ x: 2046, y: 1200, w: 2400, h: 1800 });
  });
});
