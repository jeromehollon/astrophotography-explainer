// The thank-you after the first PNG download shows once per page load (owner request): module state, not storage.
import { beforeEach, describe, expect, it } from 'vitest';
import { claimThanks, resetThanks } from './ThanksModal';

describe('claimThanks', () => {
  beforeEach(() => resetThanks());
  it('is true once per page load, then false', () => {
    expect(claimThanks()).toBe(true);
    expect(claimThanks()).toBe(false);
    expect(claimThanks()).toBe(false);
  });
  it('does not touch web storage', () => {
    claimThanks();
    expect(typeof sessionStorage === 'undefined' ? 0 : sessionStorage.length).toBe(0);
    expect(typeof localStorage === 'undefined' ? 0 : localStorage.length).toBe(0);
  });
});
