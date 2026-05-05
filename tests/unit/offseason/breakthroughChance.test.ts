// Sprint 32 Task 32.4 — port of FCCD module 39825 (breakthrough chance).

import { describe, it, expect } from 'vitest';
import { offseason, createRng } from '@vcd/shared';

describe('getTrainingBreakthroughChance', () => {
  it('potential=80, bonus=0, repeats=0 → 0.40', () => {
    const p = offseason.getTrainingBreakthroughChance({
      potential: 80,
      coachBreakthroughBonus: 0,
      repeatedFocusCount: 0,
    });
    expect(p).toBeCloseTo(0.40, 9);
  });

  it('potential=100, bonus=10, repeats=0 → 0.60', () => {
    const p = offseason.getTrainingBreakthroughChance({
      potential: 100,
      coachBreakthroughBonus: 10,
      repeatedFocusCount: 0,
    });
    expect(p).toBeCloseTo(0.60, 9);
  });

  it('potential=80, bonus=0, repeats=2 → 0.16 (= 0.4 × 0.4)', () => {
    const p = offseason.getTrainingBreakthroughChance({
      potential: 80,
      coachBreakthroughBonus: 0,
      repeatedFocusCount: 2,
    });
    expect(p).toBeCloseTo(0.16, 9);
  });

  it('potential=80, bonus=0, repeats=10 → 0.08 (= 0.4 × 0.2)', () => {
    const p = offseason.getTrainingBreakthroughChance({
      potential: 80,
      coachBreakthroughBonus: 0,
      repeatedFocusCount: 10,
    });
    expect(p).toBeCloseTo(0.08, 9);
  });

  it('clamped to [0, 1] across 10K seeded random inputs', () => {
    const rng = createRng('sprint32:breakthrough:invariants');
    for (let i = 0; i < 10_000; i++) {
      const p = offseason.getTrainingBreakthroughChance({
        potential: rng.int(0, 100),
        coachBreakthroughBonus: rng.int(0, 50),
        repeatedFocusCount: rng.int(0, 10),
      });
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(1);
    }
  });
});
