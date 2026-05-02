import { describe, it, expect } from 'vitest';
import { buildStaffForTeams, deriveOperatingBudgetCents } from '@vcd/shared/seed/leagueSeed';

describe('staff seeding (Sprint 17)', () => {
  const teams = [
    { id: 't-neb', abbr: 'NEB', prestige: 92 },
    { id: 't-ill', abbr: 'ILL', prestige: 78 },
    { id: 't-xyz', abbr: 'XYZ', prestige: 45 },
  ];

  it('emits exactly one HC + one AHC + one AC per team', () => {
    const staff = buildStaffForTeams(teams);
    expect(staff).toHaveLength(teams.length * 3);
    for (const t of teams) {
      const forTeam = staff.filter((s) => s.teamId === t.id);
      const roles = forTeam.map((s) => s.role).sort();
      expect(roles).toEqual(['AC', 'AHC', 'HC']);
    }
  });

  it('all ratings fall within the clamped range', () => {
    const staff = buildStaffForTeams(teams);
    for (const c of staff) {
      expect(c.ratingRecruit).toBeGreaterThanOrEqual(25);
      expect(c.ratingRecruit).toBeLessThanOrEqual(95);
      expect(c.ratingDevelop).toBeGreaterThanOrEqual(25);
      expect(c.ratingDevelop).toBeLessThanOrEqual(95);
      expect(c.ratingStrategy).toBeGreaterThanOrEqual(25);
      expect(c.ratingStrategy).toBeLessThanOrEqual(95);
    }
  });

  it('is deterministic across runs', () => {
    const a = buildStaffForTeams(teams);
    const b = buildStaffForTeams(teams);
    expect(a).toEqual(b);
  });

  it('derives a larger operating budget for higher prestige', () => {
    const low = deriveOperatingBudgetCents(30);
    const mid = deriveOperatingBudgetCents(55);
    const high = deriveOperatingBudgetCents(92);
    expect(low).toBeLessThan(mid);
    expect(mid).toBeLessThan(high);
    // prestige 92 → $560k → 56_000_000 cents
    expect(high).toBe(56_000_000);
  });
});
