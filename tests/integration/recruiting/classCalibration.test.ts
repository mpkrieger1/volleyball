// PRD Sprint 12 exit tests: generate 1,000 recruits and verify the
// distribution matches the target curve. Fast (<2s); stays in default suite.

import { describe, it, expect } from 'vitest';
import { recruiting } from '@vcd/shared';

const CLASS_SIZE = 1_000;
const CLASS = recruiting.generateRecruitClass('calibration-2026', CLASS_SIZE);

describe('PRD Sprint 12 invariants', () => {
  it('exit test 1: star distribution within ±5 percentage points of target', () => {
    const counts = new Map<number, number>([[1, 0], [2, 0], [3, 0], [4, 0], [5, 0]]);
    for (const r of CLASS) counts.set(r.stars, (counts.get(r.stars) ?? 0) + 1);
    for (const entry of recruiting.STAR_DISTRIBUTION) {
      const observed = (counts.get(entry.stars) ?? 0) / CLASS_SIZE;
      const diff = Math.abs(observed - entry.prob);
      expect(
        diff,
        `${entry.stars}-star observed=${(observed * 100).toFixed(1)}% target=${(entry.prob * 100).toFixed(1)}%`,
      ).toBeLessThan(0.05);
    }
  });

  it('exit test 2: per-position mean height within 1 inch (2.54 cm) of target', () => {
    const TOLERANCE_CM = 2.54;
    const positions: recruiting.Position[] = ['OH', 'MB', 'OPP', 'S', 'L', 'DS'];
    for (const pos of positions) {
      const recruits = CLASS.filter((r) => r.position === pos);
      if (recruits.length === 0) continue;
      const mean = recruits.reduce((a, r) => a + r.height, 0) / recruits.length;
      const target = recruiting.POSITION_ARCHETYPES[pos].heightMeanCm;
      expect(
        Math.abs(mean - target),
        `${pos} mean=${mean.toFixed(1)}cm target=${target}cm (n=${recruits.length})`,
      ).toBeLessThan(TOLERANCE_CM);
    }
  });

  it('exit test 3: no duplicate (firstName, lastName, hometownCity) triples', () => {
    const triples = new Set(
      CLASS.map((r) => `${r.firstName}|${r.lastName}|${r.hometownCity}`),
    );
    expect(triples.size).toBe(CLASS_SIZE);
  });

  it('class covers all 6 positions and all 4 regions', () => {
    const positions = new Set(CLASS.map((r) => r.position));
    const regions = new Set(CLASS.map((r) => r.hometownRegion));
    expect(positions.size).toBe(6);
    expect(regions.size).toBe(4);
  });

  it('class has at least one 5-star and one 1-star recruit', () => {
    const stars = new Set(CLASS.map((r) => r.stars));
    expect(stars.has(5)).toBe(true);
    expect(stars.has(1)).toBe(true);
  });
});
