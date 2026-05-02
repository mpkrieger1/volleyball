import { describe, it, expect } from 'vitest';
import { recruiting } from '@vcd/shared';

describe('generateRecruit', () => {
  it('is deterministic: same (seed, index) produces byte-identical output', () => {
    const a = recruiting.generateRecruit('test-seed', 0);
    const b = recruiting.generateRecruit('test-seed', 0);
    expect(a).toEqual(b);
  });

  it('different indices produce different recruits', () => {
    const r0 = recruiting.generateRecruit('test-seed', 0);
    const r1 = recruiting.generateRecruit('test-seed', 1);
    // Not guaranteed in every field but at least some field should differ.
    const changed =
      r0.firstName !== r1.firstName ||
      r0.lastName !== r1.lastName ||
      r0.hometownCity !== r1.hometownCity ||
      r0.position !== r1.position;
    expect(changed).toBe(true);
  });

  it('has all required fields populated', () => {
    const r = recruiting.generateRecruit('shape-check', 42);
    expect(r.firstName.length).toBeGreaterThan(0);
    expect(r.lastName.length).toBeGreaterThan(0);
    expect(['OH', 'MB', 'OPP', 'S', 'L', 'DS']).toContain(r.position);
    expect(r.stars).toBeGreaterThanOrEqual(1);
    expect(r.stars).toBeLessThanOrEqual(5);
    expect(r.height).toBeGreaterThanOrEqual(150);
    expect(r.height).toBeLessThanOrEqual(220);
    expect(r.hometownCity.length).toBeGreaterThan(0);
    expect(r.hometownState).toMatch(/^[A-Z]{2}$/);
    expect(['EAST', 'CENTRAL', 'MOUNTAIN', 'PACIFIC']).toContain(r.hometownRegion);
    expect(r.potential).toBeGreaterThanOrEqual(30);
    expect(r.potential).toBeLessThanOrEqual(100);
    // Ratings are all clamped.
    for (const key of ['attack', 'block', 'serve', 'pass', 'set', 'dig', 'athleticism', 'iq', 'stamina'] as const) {
      expect(r.ratings[key]).toBeGreaterThanOrEqual(1);
      expect(r.ratings[key]).toBeLessThanOrEqual(99);
    }
  });
});

describe('generateRecruitClass', () => {
  it('returns exactly `size` recruits', () => {
    expect(recruiting.generateRecruitClass('cls', 50).length).toBe(50);
    expect(recruiting.generateRecruitClass('cls', 100).length).toBe(100);
  });

  it('no duplicate (first, last, city) triples in a 50-class', () => {
    const cls = recruiting.generateRecruitClass('dup-check', 50);
    const seen = new Set(cls.map((r) => `${r.firstName}|${r.lastName}|${r.hometownCity}`));
    expect(seen.size).toBe(50);
  });

  it('a class of 50 covers at least 3 different positions', () => {
    const cls = recruiting.generateRecruitClass('diversity', 50);
    const positions = new Set(cls.map((r) => r.position));
    expect(positions.size).toBeGreaterThanOrEqual(3);
  });

  it('same seed produces identical classes', () => {
    const a = recruiting.generateRecruitClass('repeat', 25);
    const b = recruiting.generateRecruitClass('repeat', 25);
    expect(a).toEqual(b);
  });
});
