import { describe, it, expect } from 'vitest';
import { generateRosterForTeam } from '@vcd/shared/roster/playerGenerator';
import { stats } from '@vcd/shared';

describe('generateRosterForTeam — potential ≥ overall invariant (retro fix)', () => {
  // Invariant: every generated player must have potential ≥ derived OVR.
  // The previous bug let samplePotential land below sampleBaseRating's
  // upper end on left-tail Gaussian draws, producing OVR > POT in ~5%
  // of high-star players. Fix: pass OVR + 5 headroom as the floor.
  it('holds across all prestige tiers and 100 deterministic team seeds', () => {
    const prestiges = [10, 25, 45, 60, 80, 95];
    for (const prestige of prestiges) {
      for (let i = 0; i < 100; i++) {
        const roster = generateRosterForTeam(`T${prestige}-${i}`, prestige);
        for (const p of roster) {
          const ovr = stats.deriveOverall(p.position, p.ratings);
          expect(p.potential).toBeGreaterThanOrEqual(ovr);
        }
      }
    }
  });
});

describe('generateRosterForTeam', () => {
  // Sprint 28: roster expanded from 12 → 17 players to match
  // MAX_ROSTER_SIZE. Position mix shifted accordingly.
  it('produces exactly 17 players (Sprint 28 MAX_ROSTER_SIZE)', () => {
    expect(generateRosterForTeam('NEB', 90)).toHaveLength(17);
  });

  it('position mix is 4 OH / 4 MB / 3 OPP / 2 S / 2 L / 2 DS (Sprint 28)', () => {
    const roster = generateRosterForTeam('NEB', 90);
    const counts: Record<string, number> = {};
    for (const p of roster) counts[p.position] = (counts[p.position] ?? 0) + 1;
    expect(counts.OH).toBe(4);
    expect(counts.MB).toBe(4);
    expect(counts.OPP).toBe(3);
    expect(counts.S).toBe(2);
    expect(counts.L).toBe(2);
    expect(counts.DS).toBe(2);
  });

  it('class-year mix is 4-5 per class across 17 slots (round-robin assignment)', () => {
    // 17 slots round-robin'd over 4 class years → 5/4/4/4 distribution
    // (FR gets the extra slot when slotIdx 0, 4, 8, 12, 16 land on FR).
    const roster = generateRosterForTeam('NEB', 90);
    const counts: Record<string, number> = {};
    for (const p of roster) counts[p.classYear] = (counts[p.classYear] ?? 0) + 1;
    // Each class should have 4 or 5 players.
    for (const cls of ['FR', 'SO', 'JR', 'SR']) {
      expect(counts[cls]).toBeGreaterThanOrEqual(4);
      expect(counts[cls]).toBeLessThanOrEqual(5);
    }
    // Total = 17.
    expect(Object.values(counts).reduce((a, b) => a + b, 0)).toBe(17);
  });

  it('jersey numbers are unique within a team and in [1, 99]', () => {
    const roster = generateRosterForTeam('NEB', 90);
    const jerseys = new Set(roster.map((p) => p.jersey));
    expect(jerseys.size).toBe(17);
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

  it('L position is marked isLibero (Sprint 28: 2 liberos per roster)', () => {
    const roster = generateRosterForTeam('NEB', 90);
    const libs = roster.filter((p) => p.isLibero);
    expect(libs).toHaveLength(2);
    for (const l of libs) expect(l.position).toBe('L');
  });
});
