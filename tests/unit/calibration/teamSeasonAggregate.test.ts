import { describe, expect, it } from 'vitest';
import { calibration, type awards } from '@vcd/shared';

function makeStats(playerId: string, partial: Partial<awards.AggregatedSeasonStats> = {}): awards.AggregatedSeasonStats {
  return {
    playerId,
    matchesPlayed: 0,
    setsPlayed: 0,
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
    ...partial,
  };
}

describe('aggregateTop25', () => {
  it('volume-weights team hitting % across all attackers', () => {
    // Team A: player 1 has 50K/100TA, player 2 has 30K/50TA. Errors = 0.
    // Team-level: 80 K / 150 TA = 0.5333.
    // Mean-of-means would be: (0.500 + 0.600) / 2 = 0.550 (different).
    const stats = new Map<string, awards.AggregatedSeasonStats>();
    stats.set('p1', makeStats('p1', { kills: 50, totalAttacks: 100, setsPlayed: 100 }));
    stats.set('p2', makeStats('p2', { kills: 30, totalAttacks: 50, setsPlayed: 100 }));
    const playerMeta = new Map([
      ['p1', { teamId: 'A', position: 'OH', isLibero: false }],
      ['p2', { teamId: 'A', position: 'MB', isLibero: false }],
    ]);
    const result = calibration.aggregateTop25({
      stats,
      playerMeta,
      pollTop25: [{ teamId: 'A', rank: 1 }],
    });
    expect(result.topTeams[0]?.hittingPct).toBeCloseTo(80 / 150, 5);
  });

  it('K/set divides by total team setsPlayed', () => {
    const stats = new Map<string, awards.AggregatedSeasonStats>();
    stats.set('p1', makeStats('p1', { kills: 100, setsPlayed: 50, totalAttacks: 200 }));
    stats.set('p2', makeStats('p2', { kills: 50, setsPlayed: 50, totalAttacks: 150 }));
    const playerMeta = new Map([
      ['p1', { teamId: 'A', position: 'OH', isLibero: false }],
      ['p2', { teamId: 'A', position: 'OH', isLibero: false }],
    ]);
    const result = calibration.aggregateTop25({
      stats,
      playerMeta,
      pollTop25: [{ teamId: 'A', rank: 1 }],
    });
    // 150 kills / 100 sets = 1.5
    expect(result.topTeams[0]?.killsPerSet).toBeCloseTo(1.5, 5);
  });

  it('libero dig/set filters by isLibero', () => {
    const stats = new Map<string, awards.AggregatedSeasonStats>();
    stats.set('libero', makeStats('libero', { digs: 200, setsPlayed: 50 }));
    stats.set('hitter', makeStats('hitter', { digs: 50, setsPlayed: 50 }));
    const playerMeta = new Map([
      ['libero', { teamId: 'A', position: 'L', isLibero: true }],
      ['hitter', { teamId: 'A', position: 'OH', isLibero: false }],
    ]);
    const result = calibration.aggregateTop25({
      stats,
      playerMeta,
      pollTop25: [{ teamId: 'A', rank: 1 }],
    });
    // Libero only: 200 / 50 = 4.0. Excludes the hitter's 50 digs.
    expect(result.topTeams[0]?.liberoDigsPerSet).toBeCloseTo(4.0, 5);
  });

  it('caps at 25 teams even with more pollTop25 rows', () => {
    const stats = new Map<string, awards.AggregatedSeasonStats>();
    const playerMeta = new Map<string, { teamId: string; position: string; isLibero: boolean }>();
    const poll = Array.from({ length: 50 }, (_, i) => ({ teamId: `T${i}`, rank: i + 1 }));
    const result = calibration.aggregateTop25({ stats, playerMeta, pollTop25: poll });
    expect(result.topTeams.length).toBeLessThanOrEqual(25);
  });

  it('top-25 average is mean across the team values', () => {
    // 2 teams, K/set = 1.5 and 2.5 → average 2.0.
    const stats = new Map<string, awards.AggregatedSeasonStats>();
    stats.set('a1', makeStats('a1', { kills: 75, setsPlayed: 50, totalAttacks: 150 }));
    stats.set('b1', makeStats('b1', { kills: 125, setsPlayed: 50, totalAttacks: 250 }));
    const playerMeta = new Map([
      ['a1', { teamId: 'A', position: 'OH', isLibero: false }],
      ['b1', { teamId: 'B', position: 'OH', isLibero: false }],
    ]);
    const result = calibration.aggregateTop25({
      stats,
      playerMeta,
      pollTop25: [
        { teamId: 'A', rank: 1 },
        { teamId: 'B', rank: 2 },
      ],
    });
    expect(result.averages.killsPerSet).toBeCloseTo(2.0, 5);
  });

  it('zero-attack team produces 0 hitting % (no NaN)', () => {
    const stats = new Map<string, awards.AggregatedSeasonStats>();
    stats.set('p1', makeStats('p1', { setsPlayed: 50 }));
    const playerMeta = new Map([['p1', { teamId: 'A', position: 'OH', isLibero: false }]]);
    const result = calibration.aggregateTop25({
      stats,
      playerMeta,
      pollTop25: [{ teamId: 'A', rank: 1 }],
    });
    expect(result.topTeams[0]?.hittingPct).toBe(0);
    expect(Number.isFinite(result.topTeams[0]?.hittingPct ?? 0)).toBe(true);
  });

  it('empty pollTop25 returns empty result', () => {
    const result = calibration.aggregateTop25({
      stats: new Map(),
      playerMeta: new Map(),
      pollTop25: [],
    });
    expect(result.topTeams).toEqual([]);
    expect(result.averages.hittingPct).toBe(0);
  });

  it('teams not in poll are filtered out', () => {
    const stats = new Map<string, awards.AggregatedSeasonStats>();
    stats.set('p1', makeStats('p1', { kills: 100, totalAttacks: 200, setsPlayed: 50 }));
    const playerMeta = new Map([['p1', { teamId: 'NOT_TOP25', position: 'OH', isLibero: false }]]);
    const result = calibration.aggregateTop25({
      stats,
      playerMeta,
      pollTop25: [{ teamId: 'A', rank: 1 }],
    });
    expect(result.topTeams.length).toBe(1);
    expect(result.topTeams[0]?.teamId).toBe('A');
    // No stats accumulated against A.
    expect(result.topTeams[0]?.killsPerSet).toBe(0);
  });
});
