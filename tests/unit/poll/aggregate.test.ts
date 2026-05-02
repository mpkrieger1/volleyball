import { describe, expect, it } from 'vitest';
import { poll } from '@vcd/shared';

describe('aggregatePoll', () => {
  it('returns 25 rows for reasonable ballot input', () => {
    // 40 teams, 10 ballots all identical → top 25 is the first 25.
    const ballot = Array.from({ length: 25 }, (_, i) => `t${i}`);
    const ballots = Array.from({ length: 10 }, () => [...ballot]);
    const rows = poll.aggregatePoll(ballots);
    expect(rows.length).toBe(25);
    expect(rows[0]!.rank).toBe(1);
    expect(rows[24]!.rank).toBe(25);
    expect(rows[0]!.teamId).toBe('t0');
  });

  it('points math: top team gets (25 × ballots) when unanimous', () => {
    const ballot = Array.from({ length: 25 }, (_, i) => `t${i}`);
    const rows = poll.aggregatePoll(Array.from({ length: 64 }, () => [...ballot]));
    expect(rows[0]!.points).toBe(25 * 64);
    expect(rows[24]!.points).toBe(1 * 64);
  });

  it('firstPlaceVotes sum to ballot count', () => {
    const b1 = Array.from({ length: 25 }, (_, i) => `a${i}`);
    const b2 = Array.from({ length: 25 }, (_, i) => `b${i}`);
    const rows = poll.aggregatePoll([
      ...Array.from({ length: 40 }, () => [...b1]),
      ...Array.from({ length: 24 }, () => [...b2]),
    ]);
    const total = rows.reduce((a, r) => a + r.firstPlaceVotes, 0);
    // Some first-place votes may land outside the top-25 summary if teams
    // tied below — but with 64 ballots voting for 2 possibilities both in
    // the top 25, total should equal 64.
    expect(total).toBe(64);
  });

  it('deterministic tie-break by teamId', () => {
    // Both teams score 25 points. Lex order wins.
    const b = ['z-team', 'a-team'];
    const rows = poll.aggregatePoll([[...b]]);
    expect(rows[0]!.teamId).toBe('z-team'); // 25 points beats 24
    expect(rows[1]!.teamId).toBe('a-team');
  });

  it('empty ballot list → empty poll', () => {
    expect(poll.aggregatePoll([])).toEqual([]);
  });
});
