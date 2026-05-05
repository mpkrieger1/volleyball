// Sprint 31 Task 31.4: key-rally detector tests.

import { describe, expect, it } from 'vitest';
import { sim } from '@vcd/shared';
import {
  createLiveMatchState,
  type LiveMatchState,
  type TeamLiveState,
} from '@vcd/shared/sim/live/state';

const balanced = (): sim.PlayerRatings => ({
  attack: 50, block: 50, serve: 50, pass: 50, set: 50, dig: 50,
  athleticism: 50, iq: 50, stamina: 50,
});

const liveTeam = (team: sim.TeamSide): TeamLiveState => ({
  lineup: { team, players: Array.from({ length: 6 }, () => balanced()) },
  rotation: sim.initialRotation(),
  libero: sim.liberoOff(5),
  setterIndex: 0,
  system: sim.defaultSystem51(),
  playerIdsBySlot: ['s0', 's1', 's2', 's3', 's4', 's5'],
  bench: [],
  tacticalHint: 'balanced',
});

const baseState = (overrides: Partial<LiveMatchState> = {}): LiveMatchState => ({
  ...createLiveMatchState({
    matchId: 'm', seed: 'kr', home: liveTeam('home'), away: liveTeam('away'),
    initialServer: 'home', useCoachAi: false, userTeam: 'home',
  }),
  ...overrides,
});

describe('isKeyRally', () => {
  it.each([
    // [home, away, setIdx, target, setsHome, setsAway, expectedSetPoint, expectedMatchPoint, expectedLeader]
    [24, 23, 0, 25, 0, 0, true, false, 'home'],   // home set point, set 1
    [24, 24, 0, 25, 0, 0, false, false, null],    // deuce — no set point
    [24, 25, 0, 25, 0, 0, true, false, 'away'],   // away leads at deuce-equivalent (24-25 means away has the lead)
    [22, 15, 0, 25, 0, 0, false, false, 'home'],  // not at target-1 yet
    [25, 23, 0, 25, 0, 0, true, false, 'home'],   // home above target with 2-point lead → still set point pre-rally
    [14, 13, 4, 15, 2, 2, true, true, 'home'],    // match point in deciding set (2-2, set 5, target 15)
    [14, 12, 4, 15, 0, 2, true, false, 'home'],   // set point (set 5 → target 15) but only home setsWon=0 < 2
  ] as const)(
    'home=%i away=%i set=%i target=%i sets=%i-%i → setPoint=%s, matchPoint=%s, leader=%s',
    (h, a, setIdx, target, setsH, setsA, expectedSp, expectedMp, expectedLeader) => {
      const s = baseState({
        currentSet: {
          index: setIdx as 0|1|2|3|4, home: h, away: a, targetScore: target,
          initialServer: 'home', rallyIdxInSet: 0,
          rallies: [], momentumAfterRally: [], timeouts: [],
        },
        setsWon: { home: setsH, away: setsA },
      });
      const r = sim.isKeyRally(s);
      expect(r.setPoint).toBe(expectedSp);
      expect(r.matchPoint).toBe(expectedMp);
      expect(r.leader).toBe(expectedLeader);
    }
  );

  it('returns no key rally for finished matches', () => {
    const s = baseState({ status: 'finished', winner: 'home' });
    const r = sim.isKeyRally(s);
    expect(r.setPoint).toBe(false);
    expect(r.matchPoint).toBe(false);
  });
});
