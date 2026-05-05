// Sprint 35 Task 35.5 — commitmentStatus state machine.

import { describe, it, expect } from 'vitest';
import { recruiting } from '@vcd/shared';

describe('deriveCommitmentStatus', () => {
  it('COMMITTED state delegates regardless of interest distribution', () => {
    expect(
      recruiting.deriveCommitmentStatus({
        topThreeInterest: [10, 10, 10],
        weekInCycle: 1,
        stars: 5,
        commitState: 'COMMITTED',
      }),
    ).toBe('COMMITTED');
  });

  it('top interest ≥ 80 with lead ≥ 15 → WILL_COMMIT_SOON', () => {
    expect(
      recruiting.deriveCommitmentStatus({
        topThreeInterest: [85, 65, 60],
        weekInCycle: 6,
        stars: 4,
        commitState: 'PENDING',
      }),
    ).toBe('WILL_COMMIT_SOON');
  });

  it('top interest ≥ 80 but small lead → FAVORITES (not WILL_COMMIT_SOON)', () => {
    expect(
      recruiting.deriveCommitmentStatus({
        topThreeInterest: [85, 78, 75],
        weekInCycle: 6,
        stars: 4,
        commitState: 'PENDING',
      }),
    ).toBe('FAVORITES');
  });

  it('top-3 all ≥ 60 → FAVORITES', () => {
    expect(
      recruiting.deriveCommitmentStatus({
        topThreeInterest: [70, 65, 62],
        weekInCycle: 5,
        stars: 3,
        commitState: 'PENDING',
      }),
    ).toBe('FAVORITES');
  });

  it('top-3 all ≥ 40 (but not ≥ 60) → NARROWING', () => {
    expect(
      recruiting.deriveCommitmentStatus({
        topThreeInterest: [50, 45, 42],
        weekInCycle: 4,
        stars: 3,
        commitState: 'PENDING',
      }),
    ).toBe('NARROWING');
  });

  it('top-3 below 40 → EXPLORING', () => {
    expect(
      recruiting.deriveCommitmentStatus({
        topThreeInterest: [30, 25, 20],
        weekInCycle: 2,
        stars: 3,
        commitState: 'PENDING',
      }),
    ).toBe('EXPLORING');
  });

  it('determinism — identical input → identical output', () => {
    const args = {
      topThreeInterest: [55, 50, 45],
      weekInCycle: 5,
      stars: 4 as const,
      commitState: 'PENDING' as const,
    };
    expect(recruiting.deriveCommitmentStatus(args)).toBe(
      recruiting.deriveCommitmentStatus(args),
    );
  });

  it('handles fewer than 3 entries gracefully (pads with 0)', () => {
    expect(
      recruiting.deriveCommitmentStatus({
        topThreeInterest: [60],
        weekInCycle: 5,
        stars: 4,
        commitState: 'PENDING',
      }),
    ).toBe('EXPLORING'); // top-3 = [60, 0, 0]; only top-1 ≥ 60 → not FAVORITES
  });
});
