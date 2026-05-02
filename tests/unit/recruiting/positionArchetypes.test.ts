import { describe, it, expect } from 'vitest';
import { recruiting } from '@vcd/shared';

describe('POSITION_ARCHETYPES', () => {
  it('has all 6 positions with correct shape', () => {
    const positions = ['OH', 'MB', 'OPP', 'S', 'L', 'DS'] as const;
    for (const p of positions) {
      const arch = recruiting.POSITION_ARCHETYPES[p];
      expect(arch.position).toBe(p);
      expect(arch.heightMeanCm).toBeGreaterThan(0);
      expect(arch.heightSdCm).toBeGreaterThan(0);
      expect(Object.keys(arch.ratingMultipliers)).toHaveLength(9);
    }
  });

  it('OH boosts attack + pass above 1.0', () => {
    const oh = recruiting.POSITION_ARCHETYPES.OH;
    expect(oh.ratingMultipliers.attack).toBeGreaterThan(1.0);
    expect(oh.ratingMultipliers.pass).toBeGreaterThan(1.0);
  });

  it('MB boosts block + attack, reduces set', () => {
    const mb = recruiting.POSITION_ARCHETYPES.MB;
    expect(mb.ratingMultipliers.block).toBeGreaterThan(1.0);
    expect(mb.ratingMultipliers.attack).toBeGreaterThan(1.0);
    expect(mb.ratingMultipliers.set).toBeLessThan(1.0);
  });

  it('S boosts set + iq, reduces attack', () => {
    const s = recruiting.POSITION_ARCHETYPES.S;
    expect(s.ratingMultipliers.set).toBeGreaterThan(1.0);
    expect(s.ratingMultipliers.iq).toBeGreaterThan(1.0);
    expect(s.ratingMultipliers.attack).toBeLessThan(1.0);
  });

  it('L boosts dig + pass, strongly reduces attack and block', () => {
    const l = recruiting.POSITION_ARCHETYPES.L;
    expect(l.ratingMultipliers.dig).toBeGreaterThan(1.0);
    expect(l.ratingMultipliers.pass).toBeGreaterThan(1.0);
    expect(l.ratingMultipliers.attack).toBeLessThan(0.5);
    expect(l.ratingMultipliers.block).toBeLessThan(0.5);
  });

  it('height means cover the realistic NCAA range by position', () => {
    const p = recruiting.POSITION_ARCHETYPES;
    expect(p.OH.heightMeanCm).toBeGreaterThanOrEqual(180);
    expect(p.OH.heightMeanCm).toBeLessThanOrEqual(190);
    expect(p.MB.heightMeanCm).toBeGreaterThanOrEqual(188);
    expect(p.L.heightMeanCm).toBeLessThanOrEqual(175);
  });

  it('POSITION_DISTRIBUTION weights sum to 100', () => {
    const sum = recruiting.POSITION_DISTRIBUTION.reduce((a, b) => a + b.weight, 0);
    expect(sum).toBe(100);
  });
});
