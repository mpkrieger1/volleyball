import { describe, it, expect } from 'vitest';
import { buildBoostersForTeams, deriveBoosterBudgetCents } from '@vcd/shared/seed/leagueSeed';

describe('booster seeding (Sprint 15)', () => {
  const teams = [
    { id: 't-neb', prestige: 92 },
    { id: 't-mid', prestige: 55 },
    { id: 't-low', prestige: 35 },
  ];

  it('creates one booster per team', () => {
    const bs = buildBoostersForTeams(teams);
    expect(bs).toHaveLength(3);
    const ids = new Set(bs.map((b) => b.teamId));
    expect(ids.size).toBe(3);
  });

  it('collectiveBudget scales with prestige', () => {
    const bs = buildBoostersForTeams(teams);
    const neb = bs.find((b) => b.teamId === 't-neb')!;
    const mid = bs.find((b) => b.teamId === 't-mid')!;
    const low = bs.find((b) => b.teamId === 't-low')!;
    expect(neb.collectiveBudget).toBeGreaterThan(mid.collectiveBudget);
    expect(mid.collectiveBudget).toBeGreaterThan(low.collectiveBudget);
  });

  it('collectiveBudget clamped to $20k floor, $550k ceiling', () => {
    expect(deriveBoosterBudgetCents(10)).toBe(20_000 * 100);
    expect(deriveBoosterBudgetCents(100)).toBe(550_000 * 100);
  });

  it('enthusiasm seeded to 50', () => {
    const bs = buildBoostersForTeams(teams);
    for (const b of bs) expect(b.enthusiasm).toBe(50);
  });

  it('deterministic — same teams produce same output', () => {
    const a = buildBoostersForTeams(teams);
    const b = buildBoostersForTeams(teams);
    expect(a).toEqual(b);
  });
});
