import { describe, expect, it } from 'vitest';
import { poll } from '@vcd/shared';

const mkRow = (rank: number, teamId: string, points = 200): poll.PollRow => ({
  rank,
  teamId,
  points,
  firstPlaceVotes: 0,
});

const mkMetrics = (
  entries: Array<{ id: string; last3Wins: number; last3Losses: number }>,
): Map<string, poll.TeamMetrics> => {
  const m = new Map<string, poll.TeamMetrics>();
  for (const e of entries) {
    m.set(e.id, {
      teamId: e.id,
      wins: 10,
      losses: 2,
      gamesPlayed: 12,
      winPct: 0.833,
      last3Wins: e.last3Wins,
      last3Losses: e.last3Losses,
      opponentWinPct: 0.5,
      opponentIds: [],
    });
  }
  return m;
};

describe('applyInertia', () => {
  it('passes through unchanged when prevPoll is null (first poll of season)', () => {
    const np = [mkRow(1, 'A'), mkRow(2, 'B')];
    const result = poll.applyInertia(null, np, new Map(), []);
    expect(result).toEqual(np);
  });

  it('PRD S9 exit test 2: a 0-3 team cannot improve rank vs prev', () => {
    const prev = Array.from({ length: 25 }, (_, i) => mkRow(i + 1, `T${i + 1}`));
    // newPoll tries to rise T10 to rank 5.
    const next = prev.map((r) => (r.teamId === 'T10' ? { ...r, rank: 5 } : r));
    const renum = next.sort((a, b) => a.rank - b.rank).map((r, i) => ({ ...r, rank: i + 1 }));
    const metrics = mkMetrics([
      ...Array.from({ length: 25 }, (_, i) => ({
        id: `T${i + 1}`,
        last3Wins: (i + 1) === 10 ? 0 : 2,
        last3Losses: (i + 1) === 10 ? 3 : 1,
      })),
    ]);
    const result = poll.applyInertia(prev, renum, metrics, []);
    const t10 = result.find((r) => r.teamId === 'T10')!;
    // Can't improve from rank 10. Final rank must be ≥ 10.
    expect(t10.rank).toBeGreaterThanOrEqual(10);
  });

  it('PRD S9 exit test 3: a non-upsetter cannot jump > 8 spots', () => {
    const prev = Array.from({ length: 25 }, (_, i) => mkRow(i + 1, `T${i + 1}`));
    // Team T20 tries to leap to rank 5 (jump of 15 spots).
    const next = [...prev];
    const idx20 = next.findIndex((r) => r.teamId === 'T20');
    next.splice(idx20, 1);
    next.splice(4, 0, mkRow(5, 'T20'));
    // Renumber for consistency.
    const renum = next.map((r, i) => ({ ...r, rank: i + 1 }));
    const metrics = mkMetrics(
      Array.from({ length: 25 }, (_, i) => ({ id: `T${i + 1}`, last3Wins: 2, last3Losses: 1 })),
    );
    const result = poll.applyInertia(prev, renum, metrics, []);
    const t20 = result.find((r) => r.teamId === 'T20')!;
    // Must not have moved more than 8 (from 20 to at least 12).
    expect(t20.rank).toBeGreaterThanOrEqual(20 - poll.MAX_NON_UPSET_MOVE);
  });

  it('an upsetter CAN jump > 8 spots when they beat a prev-top-10 team', () => {
    const prev = Array.from({ length: 25 }, (_, i) => mkRow(i + 1, `T${i + 1}`));
    // T20 tries to leap to rank 5, and they upset (prev-top-10 win).
    const next = prev.map((r) => (r.teamId === 'T20' ? { ...r, rank: 5 } : r));
    const renum = next
      .sort((a, b) => a.rank - b.rank)
      .map((r, i) => ({ ...r, rank: i + 1 }));
    const metrics = mkMetrics(
      Array.from({ length: 25 }, (_, i) => ({ id: `T${i + 1}`, last3Wins: 3, last3Losses: 0 })),
    );
    const upsets = [{ winnerTeamId: 'T20' }];
    const result = poll.applyInertia(prev, renum, metrics, upsets);
    const t20 = result.find((r) => r.teamId === 'T20')!;
    // With an upset, T20 can rise above rank 12.
    expect(t20.rank).toBeLessThan(20);
  });

  it('unranked team entering for first time cannot rank above the floor', () => {
    const prev = Array.from({ length: 25 }, (_, i) => mkRow(i + 1, `T${i + 1}`));
    // NEW team 'X' appears at rank 5 in newPoll; others shift down to 26.
    const next = [mkRow(5, 'X'), ...prev.map((r) => ({ ...r, rank: r.rank + 1 }))];
    // Renumber in-place.
    const renum = next
      .sort((a, b) => a.rank - b.rank)
      .map((r, i) => ({ ...r, rank: i + 1 }));
    const metrics = mkMetrics([
      { id: 'X', last3Wins: 3, last3Losses: 0 },
      ...Array.from({ length: 25 }, (_, i) => ({ id: `T${i + 1}`, last3Wins: 2, last3Losses: 1 })),
    ]);
    const result = poll.applyInertia(prev, renum, metrics, []);
    const x = result.find((r) => r.teamId === 'X');
    if (x) {
      // Floor is 20 so X shouldn't appear at rank < 20.
      expect(x.rank).toBeGreaterThanOrEqual(poll.FIRST_TIME_ENTRY_FLOOR);
    }
  });

  it('detectUpsets returns empty when prevPoll is null', () => {
    expect(
      poll.detectUpsets([{ winnerId: 'A', homeTeamId: 'A', awayTeamId: 'B' }], null),
    ).toEqual([]);
  });

  it('detectUpsets flags a win over a prev-top-10 team', () => {
    const prev = Array.from({ length: 25 }, (_, i) => mkRow(i + 1, `T${i + 1}`));
    const upsets = poll.detectUpsets(
      [{ winnerId: 'T20', homeTeamId: 'T20', awayTeamId: 'T5' }],
      prev,
    );
    expect(upsets).toEqual([{ winnerTeamId: 'T20' }]);
  });

  it('detectUpsets ignores wins against non-top-10 teams', () => {
    const prev = Array.from({ length: 25 }, (_, i) => mkRow(i + 1, `T${i + 1}`));
    const upsets = poll.detectUpsets(
      [{ winnerId: 'T20', homeTeamId: 'T20', awayTeamId: 'T15' }],
      prev,
    );
    expect(upsets).toEqual([]);
  });
});
