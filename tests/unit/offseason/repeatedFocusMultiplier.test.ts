// Sprint 32 Task 32.2 — direct port of FCCD `getRepeatedTrainingsMultiplier`
// (module 935275 in coreWorker.js). Pure switch table.

import { describe, it, expect } from 'vitest';
import { offseason } from '@vcd/shared';

describe('getRepeatedFocusMultiplier', () => {
  it.each([
    [0, 1.0],
    [1, 0.6],
    [2, 0.4],
    [3, 0.2],
    [10, 0.2],
  ])('n=%i → %f', (n, expected) => {
    expect(offseason.getRepeatedFocusMultiplier(n)).toBe(expected);
  });

  it('treats negative inputs as the default branch (0.2)', () => {
    // Defensive: caller bug shouldn't crash the offseason event.
    expect(offseason.getRepeatedFocusMultiplier(-1)).toBe(0.2);
  });
});
