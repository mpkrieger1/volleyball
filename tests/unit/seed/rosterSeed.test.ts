import { describe, it, expect } from 'vitest';
import { generateRosterForTeam } from '@vcd/shared/roster/playerGenerator';

describe('generateRosterForTeam', () => {
  it('produces exactly 12 players', () => {
    expect(generateRosterForTeam('NEB', 90)).toHaveLength(12);
  });

  it('position mix is 4 OH / 3 MB / 2 OPP / 1 S / 1 L / 1 DS', () => {
    const roster = generateRosterForTeam('NEB', 90);
    const counts: Record<string, number> = {};
    for (const p of roster) counts[p.position] = (counts[p.position] ?? 0) + 1;
    expect(counts.OH).toBe(4);
    expect(counts.MB).toBe(3);
    expect(counts.OPP).toBe(2);
    expect(counts.S).toBe(1);
    expect(counts.L).toBe(1);
    expect(counts.DS).toBe(1);
  });

  it('class-year mix is 3 FR / 3 SO / 3 JR / 3 SR', () => {
    const roster = generateRosterForTeam('NEB', 90);
    const counts: Record<string, number> = {};
    for (const p of roster) counts[p.classYear] = (counts[p.classYear] ?? 0) + 1;
    expect(counts.FR).toBe(3);
    expect(counts.SO).toBe(3);
    expect(counts.JR).toBe(3);
    expect(counts.SR).toBe(3);
  });

  it('jersey numbers are unique within a team and in [1, 99]', () => {
    const roster = generateRosterForTeam('NEB', 90);
    const jerseys = new Set(roster.map((p) => p.jersey));
    expect(jerseys.size).toBe(12);
    for (const j of jerseys) {
      expect(j).toBeGreaterThanOrEqual(1);
      expect(j).toBeLessThanOrEqual(99);
    }
  });

  it('deterministic — same team input produces byte-identical output', () => {
    const a = generateRosterForTeam('NEB', 90);
    const b = generateRosterForTeam('NEB', 90);
    expect(a).toEqual(b);
  });

  it('higher prestige yields higher average rating than lower prestige', () => {
    const top = generateRosterForTeam('TOP', 92);
    const bot = generateRosterForTeam('BOT', 38);
    const meanTop =
      top.reduce((a, p) => a + Object.values(p.ratings).reduce((x, y) => x + y, 0), 0) /
      (top.length * 9);
    const meanBot =
      bot.reduce((a, p) => a + Object.values(p.ratings).reduce((x, y) => x + y, 0), 0) /
      (bot.length * 9);
    expect(meanTop).toBeGreaterThan(meanBot + 10);
  });

  it('L position is marked isLibero', () => {
    const roster = generateRosterForTeam('NEB', 90);
    const libs = roster.filter((p) => p.isLibero);
    expect(libs).toHaveLength(1);
    expect(libs[0]!.position).toBe('L');
  });
});
