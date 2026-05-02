import { describe, it, expect } from 'vitest';
import { buildHeadCoachesForTeams, deriveCoachRecruitRating } from '@vcd/shared/seed/leagueSeed';

describe('coach seeding (Sprint 13)', () => {
  const teams = [
    { id: 't-neb', abbr: 'NEB', prestige: 92 },
    { id: 't-ill', abbr: 'ILL', prestige: 78 },
    { id: 't-xyz', abbr: 'XYZ', prestige: 45 },
  ];

  it('generates exactly one HC per team', () => {
    const hcs = buildHeadCoachesForTeams(teams);
    expect(hcs).toHaveLength(teams.length);
    const teamIds = new Set(hcs.map((h) => h.teamId));
    expect(teamIds.size).toBe(teams.length);
  });

  it('every HC has ratingRecruit in [30, 95]', () => {
    const hcs = buildHeadCoachesForTeams(teams);
    for (const h of hcs) {
      expect(h.ratingRecruit).toBeGreaterThanOrEqual(30);
      expect(h.ratingRecruit).toBeLessThanOrEqual(95);
    }
  });

  it('higher prestige → generally higher ratingRecruit', () => {
    const hcs = buildHeadCoachesForTeams(teams);
    const neb = hcs.find((h) => h.teamId === 't-neb')!;
    const xyz = hcs.find((h) => h.teamId === 't-xyz')!;
    expect(neb.ratingRecruit).toBeGreaterThan(xyz.ratingRecruit);
  });

  it('deriveCoachRecruitRating is deterministic given team abbr + prestige', () => {
    const a = deriveCoachRecruitRating('NEB', 92);
    const b = deriveCoachRecruitRating('NEB', 92);
    expect(a).toBe(b);
  });

  it('coach names come from the Sprint 12 name pool (non-empty strings)', () => {
    const hcs = buildHeadCoachesForTeams(teams);
    for (const h of hcs) {
      expect(h.firstName.length).toBeGreaterThan(0);
      expect(h.lastName.length).toBeGreaterThan(0);
    }
  });

  it('same input produces same output across runs (determinism)', () => {
    const a = buildHeadCoachesForTeams(teams);
    const b = buildHeadCoachesForTeams(teams);
    expect(a).toEqual(b);
  });
});
