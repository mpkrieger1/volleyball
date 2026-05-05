// Sprint 35 Task 35.2 — playing-time level helper.

import { describe, it, expect } from 'vitest';
import { recruiting } from '@vcd/shared';

describe('computePlayingTimeLevel', () => {
  it('0 returners + cap=4 → 100 (open competition)', () => {
    expect(recruiting.computePlayingTimeLevel({ returnersAtPosition: 0, positionCap: 4 })).toBe(
      100,
    );
  });

  it('cap returners + cap=4 → 0 (no slots)', () => {
    expect(recruiting.computePlayingTimeLevel({ returnersAtPosition: 4, positionCap: 4 })).toBe(0);
  });

  it('half full → 50', () => {
    expect(recruiting.computePlayingTimeLevel({ returnersAtPosition: 2, positionCap: 4 })).toBe(50);
  });

  it('over-cap clamps to 0', () => {
    expect(recruiting.computePlayingTimeLevel({ returnersAtPosition: 6, positionCap: 4 })).toBe(0);
  });
});
