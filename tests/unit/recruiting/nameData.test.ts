import { describe, it, expect } from 'vitest';
import { recruiting } from '@vcd/shared';

describe('name + hometown data', () => {
  it('FIRST_NAMES has at least 400 non-empty entries', () => {
    expect(recruiting.FIRST_NAMES.length).toBeGreaterThanOrEqual(400);
    for (const e of recruiting.FIRST_NAMES) {
      expect(e.name.length).toBeGreaterThan(0);
      expect(e.weight).toBeGreaterThan(0);
    }
  });

  it('LAST_NAMES has at least 400 entries', () => {
    expect(recruiting.LAST_NAMES.length).toBeGreaterThanOrEqual(400);
  });

  it('HOMETOWNS has at least 300 entries and valid state/region formats', () => {
    expect(recruiting.HOMETOWNS.length).toBeGreaterThanOrEqual(300);
    const VALID_REGIONS = new Set(['EAST', 'CENTRAL', 'MOUNTAIN', 'PACIFIC']);
    for (const h of recruiting.HOMETOWNS) {
      expect(h.city.length).toBeGreaterThan(0);
      expect(h.state).toMatch(/^[A-Z]{2}$/);
      expect(VALID_REGIONS.has(h.region)).toBe(true);
      expect(h.weight).toBeGreaterThan(0);
    }
  });

  it('every ethnicity tag appears at least once in both first and last names', () => {
    for (const tag of recruiting.ETHNICITY_TAGS) {
      const inFirst = recruiting.FIRST_NAMES.some((e) => e.tag === tag);
      const inLast = recruiting.LAST_NAMES.some((e) => e.tag === tag);
      expect(inFirst, `no first names tagged ${tag}`).toBe(true);
      expect(inLast, `no last names tagged ${tag}`).toBe(true);
    }
  });

  it('every region has at least 10 hometowns (diversity)', () => {
    const regions = ['EAST', 'CENTRAL', 'MOUNTAIN', 'PACIFIC'] as const;
    for (const r of regions) {
      const inRegion = recruiting.HOMETOWNS.filter((h) => h.region === r);
      expect(inRegion.length).toBeGreaterThanOrEqual(10);
    }
  });
});
