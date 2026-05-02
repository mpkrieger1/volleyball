import { describe, expect, it } from 'vitest';
import { poll } from '@vcd/shared';

// 4-team round robin: A beats B, C beats D, A beats C, B beats D, A beats D, B beats C.
// → A: 3-0, B: 1-2, C: 1-2, D: 0-3.
const matches: poll.PlayedMatch[] = [
  { homeTeamId: 'A', awayTeamId: 'B', winnerId: 'A', date: new Date('2026-09-01') },
  { homeTeamId: 'C', awayTeamId: 'D', winnerId: 'C', date: new Date('2026-09-02') },
  { homeTeamId: 'A', awayTeamId: 'C', winnerId: 'A', date: new Date('2026-09-03') },
  { homeTeamId: 'B', awayTeamId: 'D', winnerId: 'B', date: new Date('2026-09-04') },
  { homeTeamId: 'A', awayTeamId: 'D', winnerId: 'A', date: new Date('2026-09-05') },
  { homeTeamId: 'B', awayTeamId: 'C', winnerId: 'B', date: new Date('2026-09-06') },
];

describe('computeTeamMetrics', () => {
  it('records per-team wins/losses + winPct', () => {
    const m = poll.computeTeamMetrics(matches, ['A', 'B', 'C', 'D']);
    expect(m.get('A')).toMatchObject({ wins: 3, losses: 0, winPct: 1.0 });
    expect(m.get('B')).toMatchObject({ wins: 2, losses: 1 });
    expect(m.get('C')).toMatchObject({ wins: 1, losses: 2 });
    expect(m.get('D')).toMatchObject({ wins: 0, losses: 3, winPct: 0 });
  });

  it('last3Record reflects the 3 most recent matches by date', () => {
    // For D: all 3 matches (all losses).
    const m = poll.computeTeamMetrics(matches, ['A', 'B', 'C', 'D']);
    expect(m.get('D')).toMatchObject({ last3Wins: 0, last3Losses: 3 });
    expect(m.get('A')).toMatchObject({ last3Wins: 3, last3Losses: 0 });
  });

  it('opponentWinPct is mean of opponents (excluding self)', () => {
    const m = poll.computeTeamMetrics(matches, ['A', 'B', 'C', 'D']);
    // A's opponents: B (2/3), C (1/3), D (0). Mean = 3/3/3 = 1/3 ≈ 0.333.
    expect(m.get('A')!.opponentWinPct).toBeCloseTo(0.333, 2);
  });

  it('teams with zero matches have zeroes (not NaN)', () => {
    const m = poll.computeTeamMetrics([], ['X']);
    expect(m.get('X')).toMatchObject({
      wins: 0, losses: 0, winPct: 0, opponentWinPct: 0, last3Wins: 0, last3Losses: 0,
    });
  });

  it('wins + losses == gamesPlayed == per-team match count', () => {
    const m = poll.computeTeamMetrics(matches, ['A', 'B', 'C', 'D']);
    for (const t of m.values()) {
      expect(t.wins + t.losses).toBe(t.gamesPlayed);
    }
  });
});
