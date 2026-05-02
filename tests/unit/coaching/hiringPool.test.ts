import { describe, it, expect } from 'vitest';
import { coaching } from '@vcd/shared';

const { generateHiringPool } = coaching;

describe('generateHiringPool (Sprint 17)', () => {
  it('produces deterministic output for a given seed', () => {
    const a = generateHiringPool({ seed: 'pool:2026', seasonYear: 2026, size: 50 });
    const b = generateHiringPool({ seed: 'pool:2026', seasonYear: 2026, size: 50 });
    expect(a).toEqual(b);
  });

  it('respects size', () => {
    const pool = generateHiringPool({ seed: 'pool:x', seasonYear: 2026, size: 100 });
    expect(pool).toHaveLength(100);
  });

  it('clamps ratings to [25, 92]', () => {
    const pool = generateHiringPool({ seed: 'pool:y', seasonYear: 2026, size: 500 });
    for (const c of pool) {
      for (const r of [c.ratingRecruit, c.ratingDevelop, c.ratingStrategy]) {
        expect(r).toBeGreaterThanOrEqual(25);
        expect(r).toBeLessThanOrEqual(92);
      }
    }
  });

  it('top-decile max rating has higher mean asking salary than bottom-decile', () => {
    const pool = generateHiringPool({ seed: 'pool:z', seasonYear: 2026, size: 500 });
    const sorted = pool
      .map((c) => ({
        max: Math.max(c.ratingRecruit, c.ratingDevelop, c.ratingStrategy),
        salary: c.askingSalaryCents,
      }))
      .sort((a, b) => a.max - b.max);
    const k = Math.floor(sorted.length / 10);
    const bottom = sorted.slice(0, k);
    const top = sorted.slice(-k);
    const meanBottom = bottom.reduce((s, r) => s + r.salary, 0) / bottom.length;
    const meanTop = top.reduce((s, r) => s + r.salary, 0) / top.length;
    expect(meanTop).toBeGreaterThan(meanBottom);
  });

  it('emits HC/AHC/AC preferred roles', () => {
    const pool = generateHiringPool({ seed: 'pool:r', seasonYear: 2026, size: 500 });
    const roles = new Set(pool.map((c) => c.preferredRole));
    expect(roles.has('HC')).toBe(true);
    expect(roles.has('AHC')).toBe(true);
    expect(roles.has('AC')).toBe(true);
  });

  it('ages fall in [28, 57]', () => {
    const pool = generateHiringPool({ seed: 'pool:a', seasonYear: 2026, size: 200 });
    for (const c of pool) {
      expect(c.ageYears).toBeGreaterThanOrEqual(28);
      expect(c.ageYears).toBeLessThanOrEqual(57);
    }
  });
});
