import { describe, expect, it } from 'vitest';
import { sim } from '@vcd/shared';

function emptyRow(slotIndex: number): sim.PlayerBoxScore {
  return {
    slotIndex,
    kills: 0,
    errors: 0,
    totalAttacks: 0,
    hittingPctMilli: 0,
    assists: 0,
    serviceAces: 0,
    serviceErrors: 0,
    receptionErrors: 0,
    digs: 0,
    blockSolos: 0,
    blockAssists: 0,
    rotationMinutes: 0,
  };
}

function makeBoxScore(homeStats: Partial<sim.PlayerBoxScore>[], awayStats: Partial<sim.PlayerBoxScore>[]): sim.MatchBoxScore {
  const home = Array.from({ length: 6 }, (_, i) => ({ ...emptyRow(i), ...(homeStats[i] ?? {}) }));
  const away = Array.from({ length: 6 }, (_, i) => ({ ...emptyRow(i), ...(awayStats[i] ?? {}) }));
  return {
    home: { team: 'home', players: home, totals: sim.computeTotals(home) },
    away: { team: 'away', players: away, totals: sim.computeTotals(away) },
    homeSetsWon: 3,
    awaySetsWon: 1,
    winner: 'home',
  };
}

const HOME_IDS = ['h0', 'h1', 'h2', 'h3', 'h4', 'h5'] as const;
const AWAY_IDS = ['a0', 'a1', 'a2', 'a3', 'a4', 'a5'] as const;

describe('buildPlayerMatchStatRows', () => {
  it('produces exactly 12 rows (6 home + 6 away)', () => {
    const rows = sim.buildPlayerMatchStatRows({
      matchId: 'M1',
      homePlayerIds: HOME_IDS,
      awayPlayerIds: AWAY_IDS,
      boxScore: makeBoxScore([], []),
    });
    expect(rows).toHaveLength(12);
  });

  it('preserves slot order: home rows precede away rows', () => {
    const rows = sim.buildPlayerMatchStatRows({
      matchId: 'M1',
      homePlayerIds: HOME_IDS,
      awayPlayerIds: AWAY_IDS,
      boxScore: makeBoxScore([], []),
    });
    expect(rows.slice(0, 6).map((r) => r.playerId)).toEqual([...HOME_IDS]);
    expect(rows.slice(6, 12).map((r) => r.playerId)).toEqual([...AWAY_IDS]);
  });

  it('Σ home rows kills equals box-score home team kills', () => {
    const homeStats = [
      { kills: 10 },
      { kills: 5 },
      { kills: 8 },
      { kills: 0 },
      { kills: 3 },
      { kills: 2 },
    ];
    const rows = sim.buildPlayerMatchStatRows({
      matchId: 'M1',
      homePlayerIds: HOME_IDS,
      awayPlayerIds: AWAY_IDS,
      boxScore: makeBoxScore(homeStats, []),
    });
    const homeRows = rows.slice(0, 6);
    const totalKills = homeRows.reduce((s, r) => s + r.kills, 0);
    expect(totalKills).toBe(28);
  });

  it('Σ away rows digs equals box-score away team digs', () => {
    const awayStats = [{ digs: 4 }, { digs: 6 }, { digs: 1 }, { digs: 7 }, { digs: 2 }, { digs: 5 }];
    const rows = sim.buildPlayerMatchStatRows({
      matchId: 'M1',
      homePlayerIds: HOME_IDS,
      awayPlayerIds: AWAY_IDS,
      boxScore: makeBoxScore([], awayStats),
    });
    const awayRows = rows.slice(6, 12);
    const totalDigs = awayRows.reduce((s, r) => s + r.digs, 0);
    expect(totalDigs).toBe(25);
  });

  it('maps hittingPctMilli → hittingPct (Int scaled ×1000)', () => {
    const rows = sim.buildPlayerMatchStatRows({
      matchId: 'M1',
      homePlayerIds: HOME_IDS,
      awayPlayerIds: AWAY_IDS,
      boxScore: makeBoxScore([{ kills: 5, errors: 1, totalAttacks: 10, hittingPctMilli: 400 }], []),
    });
    expect(rows[0]!.hittingPct).toBe(400);
  });

  it('throws when player id arrays are wrong length', () => {
    expect(() =>
      sim.buildPlayerMatchStatRows({
        matchId: 'M1',
        homePlayerIds: ['h0', 'h1'],
        awayPlayerIds: AWAY_IDS,
        boxScore: makeBoxScore([], []),
      }),
    ).toThrow();
  });
});
