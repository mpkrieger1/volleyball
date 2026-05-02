import { describe, it, expect } from 'vitest';
import { standings } from '@vcd/shared';

const mk = (h: string, a: string, w: string, conf = true): standings.StandingsMatch => ({
  homeTeamId: h,
  awayTeamId: a,
  winnerId: w,
  isConference: conf,
});

const teams: standings.StandingsTeam[] = [
  { id: 'A', conferenceId: 'C1' },
  { id: 'B', conferenceId: 'C1' },
  { id: 'C', conferenceId: 'C1' },
  { id: 'D', conferenceId: 'C1' },
];

describe('computeConferenceStandings', () => {
  it('ranks a 4-team round-robin by conf win%', () => {
    // A 3-0, B 2-1, C 1-2, D 0-3.
    const matches: standings.StandingsMatch[] = [
      mk('A', 'B', 'A'),
      mk('A', 'C', 'A'),
      mk('A', 'D', 'A'),
      mk('B', 'C', 'B'),
      mk('B', 'D', 'B'),
      mk('C', 'D', 'C'),
    ];
    const out = standings.computeConferenceStandings(matches, teams);
    const c1 = out.get('C1')!;
    expect(c1.map((s) => s.teamId)).toEqual(['A', 'B', 'C', 'D']);
    expect(c1[0].confWins).toBe(3);
    expect(c1[3].confLosses).toBe(3);
    expect(c1[0].rank).toBe(1);
  });

  it('breaks conf-record ties using head-to-head', () => {
    // A and B each 1-1 in conf; A beat B head-to-head.
    const matches: standings.StandingsMatch[] = [
      mk('A', 'B', 'A'),
      mk('A', 'C', 'C'),
      mk('B', 'C', 'B'),
    ];
    const out = standings.computeConferenceStandings(matches, teams);
    const c1 = out.get('C1')!;
    const a = c1.find((s) => s.teamId === 'A')!;
    const b = c1.find((s) => s.teamId === 'B')!;
    expect(a.rank).toBeLessThan(b.rank);
  });

  it('uses overall win% when conf record AND head-to-head are tied', () => {
    // A and B split head-to-head, both 1-1 in conf, but A has an extra
    // non-conference win so higher overall win%.
    const matches: standings.StandingsMatch[] = [
      mk('A', 'B', 'A'),
      mk('B', 'A', 'B'),
      mk('A', 'X', 'A', false), // non-conf win for A
    ];
    const teamsExt: standings.StandingsTeam[] = [
      { id: 'A', conferenceId: 'C1' },
      { id: 'B', conferenceId: 'C1' },
      { id: 'X', conferenceId: 'C2' },
    ];
    const out = standings.computeConferenceStandings(matches, teamsExt);
    const c1 = out.get('C1')!;
    expect(c1[0].teamId).toBe('A');
    expect(c1[1].teamId).toBe('B');
  });

  it('is deterministic across runs', () => {
    const matches: standings.StandingsMatch[] = [
      mk('A', 'B', 'A'),
      mk('C', 'D', 'C'),
    ];
    const a = standings.computeConferenceStandings(matches, teams);
    const b = standings.computeConferenceStandings(matches, teams);
    expect([...(a.get('C1') ?? [])]).toEqual([...(b.get('C1') ?? [])]);
  });

  it('handles teams with no games played', () => {
    const out = standings.computeConferenceStandings([], teams);
    const c1 = out.get('C1')!;
    expect(c1).toHaveLength(4);
    for (const s of c1) {
      expect(s.confWinPct).toBe(0);
      expect(s.overallWinPct).toBe(0);
    }
  });
});
