import { describe, expect, it } from 'vitest';
import { awards, sim } from '@vcd/shared';

function row(playerId: string, matchId: string, partial: Partial<sim.PlayerMatchStatRow> = {}): sim.PlayerMatchStatRow {
  return {
    playerId,
    matchId,
    kills: 0,
    errors: 0,
    totalAttacks: 0,
    hittingPct: 0,
    assists: 0,
    serviceAces: 0,
    serviceErrors: 0,
    receptionErrors: 0,
    digs: 0,
    blockSolos: 0,
    blockAssists: 0,
    rotationMinutes: 0,
    ...partial,
  };
}

describe('aggregatePlayerSeasonStats', () => {
  it('sums per-match counts to season totals', () => {
    const sets = new Map([['M1', 3], ['M2', 4], ['M3', 5]]);
    const rows = [
      row('P1', 'M1', { kills: 12, errors: 3, totalAttacks: 30, digs: 4 }),
      row('P1', 'M2', { kills: 18, errors: 5, totalAttacks: 40, digs: 6 }),
      row('P1', 'M3', { kills: 15, errors: 4, totalAttacks: 35, digs: 5 }),
    ];
    const agg = awards.aggregatePlayerSeasonStats('P1', rows, sets);
    expect(agg.matchesPlayed).toBe(3);
    expect(agg.setsPlayed).toBe(12);
    expect(agg.kills).toBe(45);
    expect(agg.errors).toBe(12);
    expect(agg.totalAttacks).toBe(105);
    expect(agg.digs).toBe(15);
  });

  it('computes season hittingPct from K-E/TA', () => {
    const sets = new Map([['M1', 3]]);
    const rows = [row('P1', 'M1', { kills: 10, errors: 2, totalAttacks: 20 })];
    const agg = awards.aggregatePlayerSeasonStats('P1', rows, sets);
    expect(agg.hittingPctMilli).toBe(400); // (10-2)/20 = 0.400 → 400
  });

  it('handles zero-attack player without NaN', () => {
    const sets = new Map([['M1', 3]]);
    const rows = [row('P1', 'M1', { digs: 5, kills: 0, totalAttacks: 0 })];
    const agg = awards.aggregatePlayerSeasonStats('P1', rows, sets);
    expect(agg.hittingPctMilli).toBe(0);
  });

  it('aggregateAllPlayers groups by playerId', () => {
    const sets = new Map([['M1', 3], ['M2', 4]]);
    const rows = [
      row('P1', 'M1', { kills: 10 }),
      row('P2', 'M1', { kills: 5 }),
      row('P1', 'M2', { kills: 12 }),
      row('P2', 'M2', { kills: 8 }),
    ];
    const map = awards.aggregateAllPlayers(rows, sets);
    expect(map.size).toBe(2);
    expect(map.get('P1')?.kills).toBe(22);
    expect(map.get('P2')?.kills).toBe(13);
  });

  it('setsPlayed uses the sets-per-match map', () => {
    // Player plays 2 matches with different set counts. Total = 4 + 5 = 9.
    const sets = new Map([['M_A', 4], ['M_B', 5]]);
    const rows = [row('P1', 'M_A'), row('P1', 'M_B')];
    const agg = awards.aggregatePlayerSeasonStats('P1', rows, sets);
    expect(agg.setsPlayed).toBe(9);
  });
});
