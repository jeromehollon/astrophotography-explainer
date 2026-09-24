import { describe, expect, it } from 'vitest';
import { useAppStore } from '../../shared/store';
import { recordMethod } from './methods';

describe('Algorithms page: recording the method', () => {
  it('writes algorithm.name and leaves every other field alone', () => {
    const before = useAppStore.getState();
    useAppStore.setState({ algorithm: { name: 'kappaSigma', params: { kappa: 3 } } });
    recordMethod('average');
    const after = useAppStore.getState();
    expect(after.algorithm).toEqual({ name: 'average', params: { kappa: 3 } });
    expect(after.calibration).toEqual(before.calibration);
    expect(after.frames).toEqual(before.frames);
    expect(after.reference).toBe(before.reference);
    recordMethod('median');
    expect(useAppStore.getState().algorithm.name).toBe('median');
  });
});
