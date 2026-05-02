import { describe, expect, it } from 'vitest';
import { analytics, type sim } from '@vcd/shared';

function makeRally(
  rallyIndex: number,
  servingTeam: 'home' | 'away',
  winningTeam: 'home' | 'away',
  attacks: Array<{ team: 'home' | 'away'; outcome: 'kill' | 'error' | 'blocked' | 'dug' }>,
) {
  const events = [
    { kind: 'serve' as const, tick: 0, team: servingTeam, server: 0, quality: 'in_play' as const },
    ...attacks.map((a, i) => ({
      kind: 'attack' as const,
      tick: i + 1,
      team: a.team,
      attacker: 1,
      outcome: a.outcome,
    })),
    { kind: 'point' as const, tick: 100, winner: winningTeam, reason: 'kill' as const },
  ];
  return { rallyIndex, seed: `r${rallyIndex}`, servingTeam, winningTeam, events };
}

function makePbp(rallies: ReturnType<typeof makeRally>[]): sim.MatchPbp {
  return {
    version: 1,
    winner: 'home',
    homeSetsWon: 1,
    awaySetsWon: 0,
    sets: [{ setIndex: 0, homeScore: 25, awayScore: 0, rallies }],
  };
}

describe('computeRotationHittingPct', () => {
  it('returns 6-element arrays per team', () => {
    const data = analytics.computeRotationHittingPct(makePbp([]));
    expect(data.home).toHaveLength(6);
    expect(data.away).toHaveLength(6);
    expect(data.homeCounts).toHaveLength(6);
    expect(data.awayCounts).toHaveLength(6);
  });

  it('attributes a kill to the attacker team rotation 0 on the first rally', () => {
    const data = analytics.computeRotationHittingPct(
      makePbp([makeRally(0, 'home', 'home', [{ team: 'home', outcome: 'kill' }])]),
    );
    expect(data.homeCounts[0]).toEqual({ kills: 1, errors: 0, totalAttacks: 1 });
    expect(data.home[0]).toBe(1000); // 100% scaled ×1000
  });

  it('rotates the receiving team after a side-out', () => {
    // home serves, away wins → away rotates to rotation 1 → next attack by away is in rot 1
    const data = analytics.computeRotationHittingPct(
      makePbp([
        makeRally(0, 'home', 'away', []),
        makeRally(1, 'away', 'away', [{ team: 'away', outcome: 'kill' }]),
      ]),
    );
    expect(data.awayCounts[0]).toEqual({ kills: 0, errors: 0, totalAttacks: 0 });
    expect(data.awayCounts[1]).toEqual({ kills: 1, errors: 0, totalAttacks: 1 });
  });

  it('serving team does not rotate when they win their own serve', () => {
    const data = analytics.computeRotationHittingPct(
      makePbp([
        makeRally(0, 'home', 'home', [{ team: 'home', outcome: 'kill' }]),
        makeRally(1, 'home', 'home', [{ team: 'home', outcome: 'kill' }]),
      ]),
    );
    // Both kills should land in home rotation 0 (no rotation between rallies).
    expect(data.homeCounts[0]).toEqual({ kills: 2, errors: 0, totalAttacks: 2 });
  });

  it('errors and blocked count toward errors+totalAttacks', () => {
    const data = analytics.computeRotationHittingPct(
      makePbp([
        makeRally(0, 'home', 'away', [
          { team: 'home', outcome: 'error' },
        ]),
      ]),
    );
    expect(data.homeCounts[0]).toEqual({ kills: 0, errors: 1, totalAttacks: 1 });
    expect(data.home[0]).toBe(-1000); // (0-1)/1 = -1.0 scaled ×1000
  });

  it('hittingPctMilli is 0 for zero-attack rotations', () => {
    const data = analytics.computeRotationHittingPct(makePbp([]));
    for (const v of data.home) expect(v).toBe(0);
    for (const v of data.away) expect(v).toBe(0);
  });

  it('rotation resets between sets', () => {
    const set1 = [
      makeRally(0, 'home', 'away', []),
      makeRally(1, 'away', 'away', [{ team: 'away', outcome: 'kill' }]),
    ];
    const set2 = [makeRally(0, 'home', 'home', [{ team: 'home', outcome: 'kill' }])];
    const pbp: sim.MatchPbp = {
      version: 1,
      winner: 'home',
      homeSetsWon: 1,
      awaySetsWon: 1,
      sets: [
        { setIndex: 0, homeScore: 0, awayScore: 25, rallies: set1 },
        { setIndex: 1, homeScore: 25, awayScore: 0, rallies: set2 },
      ],
    };
    const data = analytics.computeRotationHittingPct(pbp);
    // Set 1: away kill in rotation 1.
    expect(data.awayCounts[1]?.kills).toBe(1);
    // Set 2: home kill in rotation 0 (reset between sets).
    expect(data.homeCounts[0]?.kills).toBe(1);
  });
});
