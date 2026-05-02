import { describe, expect, it } from 'vitest';
import { analytics, type sim } from '@vcd/shared';

function rallyOfLength(rallyIndex: number, length: number, winner: 'home' | 'away'): sim.MatchPbp['sets'][0]['rallies'][0] {
  const events: sim.RallyEvent[] = [];
  for (let i = 0; i < length; i++) {
    events.push({ kind: 'serve' as const, tick: i, team: 'home', server: 0, quality: 'in_play' as const });
  }
  return { rallyIndex, seed: `r${rallyIndex}`, servingTeam: 'home', winningTeam: winner, events };
}

function makePbp(rallies: ReturnType<typeof rallyOfLength>[]): sim.MatchPbp {
  return {
    version: 1,
    winner: 'home',
    homeSetsWon: 3,
    awaySetsWon: 0,
    sets: [{ setIndex: 0, homeScore: 25, awayScore: 18, rallies }],
  };
}

describe('computeRallyLengthDistribution', () => {
  it('returns 5 buckets in fixed order', () => {
    const data = analytics.computeRallyLengthDistribution(makePbp([]));
    expect(data.map((r) => r.bucket)).toEqual(['1-3', '4-6', '7-10', '11-15', '16+']);
  });

  it('bucketizes rally lengths correctly', () => {
    const data = analytics.computeRallyLengthDistribution(
      makePbp([
        rallyOfLength(0, 2, 'home'),  // 1-3
        rallyOfLength(1, 3, 'home'),  // 1-3
        rallyOfLength(2, 5, 'home'),  // 4-6
        rallyOfLength(3, 8, 'away'),  // 7-10
        rallyOfLength(4, 12, 'home'), // 11-15
        rallyOfLength(5, 20, 'away'), // 16+
      ]),
    );
    const byBucket = Object.fromEntries(data.map((r) => [r.bucket, r]));
    expect(byBucket['1-3']!.count).toBe(2);
    expect(byBucket['4-6']!.count).toBe(1);
    expect(byBucket['7-10']!.count).toBe(1);
    expect(byBucket['11-15']!.count).toBe(1);
    expect(byBucket['16+']!.count).toBe(1);
  });

  it('attributes points by winner per bucket', () => {
    const data = analytics.computeRallyLengthDistribution(
      makePbp([
        rallyOfLength(0, 2, 'home'),
        rallyOfLength(1, 2, 'home'),
        rallyOfLength(2, 2, 'away'),
      ]),
    );
    const b13 = data.find((r) => r.bucket === '1-3')!;
    expect(b13.homePoints).toBe(2);
    expect(b13.awayPoints).toBe(1);
  });

  it('total points across buckets = total rallies', () => {
    const data = analytics.computeRallyLengthDistribution(
      makePbp([
        rallyOfLength(0, 2, 'home'),
        rallyOfLength(1, 8, 'away'),
        rallyOfLength(2, 18, 'home'),
      ]),
    );
    const totalCount = data.reduce((s, r) => s + r.count, 0);
    const totalPoints = data.reduce((s, r) => s + r.homePoints + r.awayPoints, 0);
    expect(totalCount).toBe(3);
    expect(totalPoints).toBe(3);
  });

  it('empty PBP produces all zero buckets', () => {
    const data = analytics.computeRallyLengthDistribution(makePbp([]));
    for (const r of data) {
      expect(r.count).toBe(0);
      expect(r.homePoints).toBe(0);
      expect(r.awayPoints).toBe(0);
    }
  });
});
