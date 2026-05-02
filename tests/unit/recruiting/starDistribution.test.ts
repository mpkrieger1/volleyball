import { describe, it, expect } from 'vitest';
import { recruiting, createRng } from '@vcd/shared';

describe('STAR_DISTRIBUTION', () => {
  it('probabilities sum to 1.0 (±1e-9)', () => {
    const sum = recruiting.STAR_DISTRIBUTION.reduce((a, b) => a + b.prob, 0);
    expect(Math.abs(sum - 1.0)).toBeLessThan(1e-9);
  });

  it('sampleStars over 10,000 draws matches distribution within ±1.5 points', () => {
    const rng = createRng('stars-calibration');
    const counts = new Map<number, number>([[1, 0], [2, 0], [3, 0], [4, 0], [5, 0]]);
    for (let i = 0; i < 10_000; i++) {
      const s = recruiting.sampleStars(rng);
      counts.set(s, (counts.get(s) ?? 0) + 1);
    }
    for (const entry of recruiting.STAR_DISTRIBUTION) {
      const observed = (counts.get(entry.stars) ?? 0) / 10_000;
      expect(Math.abs(observed - entry.prob)).toBeLessThan(0.015);
    }
  });

  it('sampleBaseRating per-tier falls in the expected band', () => {
    const rng = createRng('br');
    for (let i = 0; i < 100; i++) {
      const r5 = recruiting.sampleBaseRating(rng, 5);
      expect(r5).toBeGreaterThanOrEqual(85);
      expect(r5).toBeLessThanOrEqual(95);
      const r1 = recruiting.sampleBaseRating(rng, 1);
      expect(r1).toBeGreaterThanOrEqual(40);
      expect(r1).toBeLessThanOrEqual(58);
    }
  });

  it('samplePotential is clamped to [30, 100]', () => {
    const rng = createRng('pot');
    for (let i = 0; i < 1000; i++) {
      const p = recruiting.samplePotential(rng, 3);
      expect(p).toBeGreaterThanOrEqual(30);
      expect(p).toBeLessThanOrEqual(100);
    }
  });
});
