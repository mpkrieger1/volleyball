import { describe, expect, it } from 'vitest';
import { analytics, type sim } from '@vcd/shared';

function recv(team: 'home' | 'away', receiver: number, grade: 0 | 1 | 2 | 3) {
  return { kind: 'reception' as const, tick: 0, team, receiver, grade };
}

function makePbp(events: ReturnType<typeof recv>[]): sim.MatchPbp {
  return {
    version: 1,
    winner: 'home',
    homeSetsWon: 3,
    awaySetsWon: 0,
    sets: [
      {
        setIndex: 0,
        homeScore: 25,
        awayScore: 0,
        rallies: [
          {
            rallyIndex: 0,
            seed: 'r0',
            servingTeam: 'home',
            winningTeam: 'home',
            events,
          },
        ],
      },
    ],
  };
}

const NAMES = {
  home: ['Smith', 'Jones', 'Lee', 'Brown', 'Park', 'Davis'],
  away: ['Adams', 'Baker', 'Cole', 'Diaz', 'Evans', 'Frye'],
} as const;
const IDS = {
  home: ['h0', 'h1', 'h2', 'h3', 'h4', 'h5'],
  away: ['a0', 'a1', 'a2', 'a3', 'a4', 'a5'],
} as const;

describe('computeReceptionGradeHistogram', () => {
  it('returns one row per slot per team that received', () => {
    const data = analytics.computeReceptionGradeHistogram({
      pbp: makePbp([
        recv('home', 0, 3),
        recv('home', 1, 2),
        recv('away', 2, 0),
      ]),
      home: { lineupSlots: NAMES.home, lineupPlayerIds: IDS.home },
      away: { lineupSlots: NAMES.away, lineupPlayerIds: IDS.away },
    });
    expect(data).toHaveLength(3);
  });

  it('tallies grades per (team, slot)', () => {
    const data = analytics.computeReceptionGradeHistogram({
      pbp: makePbp([
        recv('home', 0, 3),
        recv('home', 0, 3),
        recv('home', 0, 2),
        recv('home', 0, 0),
      ]),
      home: { lineupSlots: NAMES.home, lineupPlayerIds: IDS.home },
      away: { lineupSlots: NAMES.away, lineupPlayerIds: IDS.away },
    });
    expect(data).toHaveLength(1);
    const row = data[0]!;
    expect(row.grade0).toBe(1);
    expect(row.grade2).toBe(1);
    expect(row.grade3).toBe(2);
    expect(row.total).toBe(4);
    expect(row.playerName).toBe('Smith');
  });

  it('flags isHome correctly', () => {
    const data = analytics.computeReceptionGradeHistogram({
      pbp: makePbp([recv('home', 0, 3), recv('away', 4, 1)]),
      home: { lineupSlots: NAMES.home, lineupPlayerIds: IDS.home },
      away: { lineupSlots: NAMES.away, lineupPlayerIds: IDS.away },
    });
    const homeRow = data.find((r) => r.isHome);
    const awayRow = data.find((r) => !r.isHome);
    expect(homeRow?.playerName).toBe('Smith');
    expect(awayRow?.playerName).toBe('Evans');
  });
});
