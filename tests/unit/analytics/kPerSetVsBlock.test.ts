import { describe, expect, it } from 'vitest';
import { analytics, sim } from '@vcd/shared';

function emptyPlayer(slot: number, kills = 0): sim.PlayerBoxScore {
  return {
    slotIndex: slot,
    kills,
    errors: 0,
    totalAttacks: kills * 2,
    hittingPctMilli: 500,
    assists: 0,
    serviceAces: 0,
    serviceErrors: 0,
    receptionErrors: 0,
    digs: 0,
    blockSolos: 0,
    blockAssists: 0,
    rotationMinutes: 100,
  };
}

function makeBoxScore(homeKills: number[6], awayKills: number[6]): sim.MatchBoxScore {
  const home = homeKills.map((k, i) => emptyPlayer(i, k));
  const away = awayKills.map((k, i) => emptyPlayer(i, k));
  return {
    home: { team: 'home', players: home as never, totals: sim.computeTotals(home) },
    away: { team: 'away', players: away as never, totals: sim.computeTotals(away) },
    homeSetsWon: 3,
    awaySetsWon: 1,
    winner: 'home',
  };
}

describe('computeKPerSetVsBlock', () => {
  it('returns 12 points (6 per team)', () => {
    const data = analytics.computeKPerSetVsBlock({
      boxScore: makeBoxScore([0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0]),
      setsPlayed: 3,
      home: {
        lineupSlots: ['A', 'B', 'C', 'D', 'E', 'F'],
        lineupRatingsBlock: [70, 65, 80, 60, 75, 55],
        lineupPositions: ['S', 'OH', 'MB', 'OPP', 'MB', 'L'],
        lineupPlayerIds: ['h0', 'h1', 'h2', 'h3', 'h4', 'h5'],
      },
      away: {
        lineupSlots: ['G', 'H', 'I', 'J', 'K', 'L'],
        lineupRatingsBlock: [60, 70, 75, 65, 80, 55],
        lineupPositions: ['S', 'OH', 'MB', 'OPP', 'MB', 'L'],
        lineupPlayerIds: ['a0', 'a1', 'a2', 'a3', 'a4', 'a5'],
      },
    });
    expect(data).toHaveLength(12);
  });

  it('home opponentBlockAvg equals mean of away lineup block ratings', () => {
    const data = analytics.computeKPerSetVsBlock({
      boxScore: makeBoxScore([0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0]),
      setsPlayed: 3,
      home: {
        lineupSlots: ['A', 'B', 'C', 'D', 'E', 'F'],
        lineupRatingsBlock: [70, 65, 80, 60, 75, 55],
        lineupPositions: ['S', 'OH', 'MB', 'OPP', 'MB', 'L'],
        lineupPlayerIds: ['h0', 'h1', 'h2', 'h3', 'h4', 'h5'],
      },
      away: {
        lineupSlots: ['G', 'H', 'I', 'J', 'K', 'L'],
        lineupRatingsBlock: [60, 90, 90, 60, 60, 60], // mean = 70
        lineupPositions: ['S', 'OH', 'MB', 'OPP', 'MB', 'L'],
        lineupPlayerIds: ['a0', 'a1', 'a2', 'a3', 'a4', 'a5'],
      },
    });
    const homePoints = data.filter((p) => p.isHome);
    for (const p of homePoints) expect(p.opponentBlockAvg).toBe(70);
  });

  it('killsPerSet = kills / setsPlayed', () => {
    const data = analytics.computeKPerSetVsBlock({
      boxScore: makeBoxScore([0, 12, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0]),
      setsPlayed: 4,
      home: {
        lineupSlots: ['A', 'B', 'C', 'D', 'E', 'F'],
        lineupRatingsBlock: [70, 65, 80, 60, 75, 55],
        lineupPositions: ['S', 'OH', 'MB', 'OPP', 'MB', 'L'],
        lineupPlayerIds: ['h0', 'h1', 'h2', 'h3', 'h4', 'h5'],
      },
      away: {
        lineupSlots: ['G', 'H', 'I', 'J', 'K', 'L'],
        lineupRatingsBlock: [70, 70, 70, 70, 70, 70],
        lineupPositions: ['S', 'OH', 'MB', 'OPP', 'MB', 'L'],
        lineupPlayerIds: ['a0', 'a1', 'a2', 'a3', 'a4', 'a5'],
      },
    });
    const slot1 = data.find((p) => p.playerId === 'h1');
    expect(slot1?.killsPerSet).toBeCloseTo(3, 5);
  });

  it('handles setsPlayed=0 without DivByZero', () => {
    const data = analytics.computeKPerSetVsBlock({
      boxScore: makeBoxScore([5, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0]),
      setsPlayed: 0,
      home: {
        lineupSlots: ['A', 'B', 'C', 'D', 'E', 'F'],
        lineupRatingsBlock: [70, 70, 70, 70, 70, 70],
        lineupPositions: ['S', 'OH', 'MB', 'OPP', 'MB', 'L'],
        lineupPlayerIds: ['h0', 'h1', 'h2', 'h3', 'h4', 'h5'],
      },
      away: {
        lineupSlots: ['G', 'H', 'I', 'J', 'K', 'L'],
        lineupRatingsBlock: [70, 70, 70, 70, 70, 70],
        lineupPositions: ['S', 'OH', 'MB', 'OPP', 'MB', 'L'],
        lineupPlayerIds: ['a0', 'a1', 'a2', 'a3', 'a4', 'a5'],
      },
    });
    expect(Number.isFinite(data[0]!.killsPerSet)).toBe(true);
  });
});
