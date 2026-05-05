// Sprint 32 Task 32.3 — port of FCCD module 97136 (gain range).
//
// Determinism: invariant trials use the seeded RNG from @vcd/shared/rng
// per CLAUDE.md §1 — never Math.random in tests.

import { describe, it, expect } from 'vitest';
import { offseason, createRng } from '@vcd/shared';

describe('lineFunc', () => {
  it('returns y1 at x1 and y2 at x2', () => {
    const f = offseason.lineFunc(40, 1.5, 100, 0.25);
    expect(f(40)).toBeCloseTo(1.5, 9);
    expect(f(100)).toBeCloseTo(0.25, 9);
  });

  it('linearly interpolates in between', () => {
    const f = offseason.lineFunc(40, 1.5, 100, 0.25);
    // Slope = (0.25 - 1.5) / (100 - 40) = -1.25 / 60.
    expect(f(70)).toBeCloseTo(1.5 + (-1.25 / 60) * 30, 9);
  });
});

describe('getFacilitiesBaseGain', () => {
  it.each([
    [1, 0],
    [2, 0],
    [3, 1],
    [4, 1],
    [5, 1],
    [6, 2],
    [7, 2],
    [8, 3],
    [9, 3],
    [10, 4],
  ])('level %i → base gain %i', (level, expected) => {
    expect(offseason.getFacilitiesBaseGain(level)).toBe(expected);
  });
});

describe('getTrainingGainAmountRange', () => {
  it('potential 90, currentRating 70, facilities 5, focused → {min:1, max:7}', () => {
    // maxScale = floor(90/10) - 1 = 8.
    // attrCurve = lineFunc(40,1.5,100,0.25)(70) = 0.875.
    // max = round(8 * 0.875) = 7. min = 1 (focused).
    const r = offseason.getTrainingGainAmountRange({
      potential: 90,
      currentRating: 70,
      facilitiesLevel: 5,
      isFocused: true,
    });
    expect(r).toEqual({ min: 1, max: 7 });
  });

  it('potential 60, currentRating 95, facilities 5, focused → max ≤ 2 (curve nearly tapped)', () => {
    const r = offseason.getTrainingGainAmountRange({
      potential: 60,
      currentRating: 95,
      facilitiesLevel: 5,
      isFocused: true,
    });
    expect(r.min).toBe(1);
    expect(r.max).toBeLessThanOrEqual(2);
  });

  it('potential 100, currentRating 30, facilities 5, focused → max in [14, 18]', () => {
    // attrCurve at rating 30 ≈ 1.708 (uncapped); maxScale = 9 → 9 * 1.708 ≈ 15.4 → 15.
    const r = offseason.getTrainingGainAmountRange({
      potential: 100,
      currentRating: 30,
      facilitiesLevel: 5,
      isFocused: true,
    });
    expect(r.min).toBe(1);
    expect(r.max).toBeGreaterThanOrEqual(14);
    expect(r.max).toBeLessThanOrEqual(18);
  });

  it('facilities 1, focused=false → min === 0 (floor from facilities)', () => {
    const r = offseason.getTrainingGainAmountRange({
      potential: 80,
      currentRating: 60,
      facilitiesLevel: 1,
      isFocused: false,
    });
    expect(r.min).toBe(0);
  });

  it('facilities 10, focused=false → min === 4 (floor from facilities)', () => {
    const r = offseason.getTrainingGainAmountRange({
      potential: 80,
      currentRating: 60,
      facilitiesLevel: 10,
      isFocused: false,
    });
    expect(r.min).toBe(4);
  });

  describe('invariants over 10K seeded random inputs', () => {
    const rng = createRng('sprint32:trainingGainRange:invariants');
    const trials: offseason.TrainingGainArgs[] = [];
    for (let i = 0; i < 10_000; i++) {
      trials.push({
        potential: rng.int(0, 100),
        currentRating: rng.int(0, 100),
        facilitiesLevel: rng.int(1, 10),
        isFocused: rng.int(0, 1) === 1,
      });
    }

    it('min ≤ max, integer, ≥ 0, ≤ 25', () => {
      for (const args of trials) {
        const r = offseason.getTrainingGainAmountRange(args);
        expect(Number.isInteger(r.min)).toBe(true);
        expect(Number.isInteger(r.max)).toBe(true);
        expect(r.min).toBeLessThanOrEqual(r.max);
        expect(r.min).toBeGreaterThanOrEqual(0);
        expect(r.max).toBeLessThanOrEqual(25);
      }
    });

    it('monotonic non-decreasing in potential (other args fixed)', () => {
      for (let i = 0; i < 200; i++) {
        const currentRating = rng.int(0, 100);
        const facilitiesLevel = rng.int(1, 10);
        const isFocused = rng.int(0, 1) === 1;
        let prevMax = -Infinity;
        for (let p = 0; p <= 100; p += 10) {
          const r = offseason.getTrainingGainAmountRange({
            potential: p,
            currentRating,
            facilitiesLevel,
            isFocused,
          });
          expect(r.max).toBeGreaterThanOrEqual(prevMax);
          prevMax = r.max;
        }
      }
    });

    it('monotonic non-increasing in currentRating ≥ 40 (other args fixed)', () => {
      for (let i = 0; i < 200; i++) {
        const potential = rng.int(40, 100);
        const facilitiesLevel = rng.int(1, 10);
        const isFocused = rng.int(0, 1) === 1;
        let prevMax = Infinity;
        for (let r = 40; r <= 100; r += 5) {
          const got = offseason.getTrainingGainAmountRange({
            potential,
            currentRating: r,
            facilitiesLevel,
            isFocused,
          });
          expect(got.max).toBeLessThanOrEqual(prevMax);
          prevMax = got.max;
        }
      }
    });
  });
});
