// Sprint 30 Task 30.1: user-driven timeout system tests.

import { describe, expect, it } from 'vitest';
import { sim } from '@vcd/shared';
import { simulateRallyStep } from '@vcd/workers';
import {
  applyUserTimeout,
  type ApplyUserTimeoutResult,
} from '@vcd/shared/sim/live/state';
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
});

const baseState = (overrides?: Partial<LiveMatchState>): LiveMatchState => ({
  ...createLiveMatchState({
    matchId: 'm', seed: 'ut', home: liveTeam('home'), away: liveTeam('away'),
    initialServer: 'home', useCoachAi: false,
    userTeam: 'home',
  }),
  ...overrides,
});

describe('applyUserTimeout — happy path', () => {
  it('decrements TimeoutLedger.remaining by 1 for the user team', () => {
    const s = baseState();
    expect(s.timeoutsHome.remaining).toBe(2);
    const r = applyUserTimeout(s, { hcStrategy: 50 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.state.timeoutsHome.remaining).toBe(1);
  });

  it('appends a timeout CoachAction to the log with rallyIndex=rallyCursor', () => {
    const s = baseState({ rallyCursor: 12 });
    const r = applyUserTimeout(s, { hcStrategy: 50 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.state.coachActionLog).toHaveLength(1);
      expect(r.state.coachActionLog[0]).toEqual({
        kind: 'timeout',
        team: 'home',
        rallyIndex: 12,
      });
    }
  });

  it('skill provided → activeBoost set with boostDurationFor(hcStrategy)', () => {
    const s = baseState({ rallyCursor: 5 });
    const r = applyUserTimeout(s, { hcStrategy: 50, skill: 'attack' });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.state.activeBoost).toEqual({
        team: 'home',
        skill: 'attack',
        pointsRemaining: 10, // boostDurationFor(50)
      });
      expect(r.state.coachActionLog[0]).toEqual({
        kind: 'timeout',
        team: 'home',
        rallyIndex: 5,
        skill: 'attack',
      });
    }
  });

  it('skill omitted → activeBoost preserved (null when no prior boost)', () => {
    const s = baseState();
    const r = applyUserTimeout(s, { hcStrategy: 50 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.state.activeBoost).toBeNull();
  });

  it('replaces an existing boost when a new skill is chosen', () => {
    const s = baseState({
      activeBoost: { team: 'home', skill: 'serve', pointsRemaining: 4 },
    });
    const r = applyUserTimeout(s, { hcStrategy: 50, skill: 'attack' });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.state.activeBoost?.skill).toBe('attack');
      expect(r.state.activeBoost?.pointsRemaining).toBe(10);
    }
  });

  it('halves opponent continuous momentum (resetOnTimeout)', () => {
    // Simulate a state where the away team has built positive momentum.
    const seed = baseState();
    let s: LiveMatchState = seed;
    // Manually set away momentum by pretending updates happened.
    s = {
      ...s,
      momentum: { home: 0, away: 0.6, lastWinner: 'away', runLength: 4 },
    };
    const r = applyUserTimeout(s, { hcStrategy: 50 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      // resetOnTimeout halves opposite momentum (TIMEOUT_MOMENTUM_RESET_FACTOR=0.5)
      expect(r.state.momentum.away).toBeCloseTo(0.3, 5);
      expect(r.state.momentum.home).toBe(0); // unchanged
    }
  });
});

describe('applyUserTimeout — rejections', () => {
  it('rejects when TO ledger is empty (NO_TIMEOUTS_LEFT)', () => {
    const s = baseState({
      timeoutsHome: { remaining: 0, timeoutsCalled: [{ atRallyIdx: 5 }, { atRallyIdx: 12 }] },
    });
    const r = applyUserTimeout(s, { hcStrategy: 50 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('NO_TIMEOUTS_LEFT');
  });

  it('rejects when no user team set (NO_USER_TEAM)', () => {
    const s = baseState({ userTeam: 'none' });
    const r = applyUserTimeout(s, { hcStrategy: 50 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('NO_USER_TEAM');
  });

  it('rejects when match is finished (INVALID_STATE)', () => {
    const s = baseState({ status: 'finished', winner: 'home' });
    const r = applyUserTimeout(s, { hcStrategy: 50 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('INVALID_STATE');
  });
});

describe('TO cap resets at set transition', () => {
  it('after set_complete, timeoutsHome.remaining resets to 2', () => {
    // Force a state where home is one rally away from set 1, with both
    // TOs spent. Step rallies until set ends; verify TO ledger reset.
    let s: LiveMatchState = {
      ...createLiveMatchState({
        matchId: 'm', seed: 'cap-reset',
        home: liveTeam('home'), away: liveTeam('away'),
        initialServer: 'home', useCoachAi: false,
        userTeam: 'home',
      }),
      timeoutsHome: { remaining: 0, timeoutsCalled: [{ atRallyIdx: 1 }, { atRallyIdx: 3 }] },
      currentSet: {
        index: 0, home: 24, away: 0, targetScore: 25, initialServer: 'home',
        rallyIdxInSet: 28, rallies: [], momentumAfterRally: [], timeouts: [],
      },
    };
    // Play until set completes (could take a few rallies if home loses
    // a serve). Hard cap at 30 iterations as safety.
    for (let i = 0; i < 30 && s.status === 'in_progress'; i++) {
      const r = simulateRallyStep(s);
      s = r.newState;
      if (r.event === 'set_complete') break;
    }
    expect(s.currentSet.index).toBe(1);
    expect(s.timeoutsHome.remaining).toBe(2);
    expect(s.timeoutsAway.remaining).toBe(2);
  });
});

describe('integration: applyUserTimeout + simulateRallyStep', () => {
  it('boost applied via TO actually affects subsequent rally', () => {
    const s = baseState({ useLiveMomentum: false });
    const r = applyUserTimeout(s, { hcStrategy: 50, skill: 'attack' }) as Extract<
      ApplyUserTimeoutResult, { ok: true }
    >;
    expect(r.ok).toBe(true);
    expect(r.state.activeBoost).not.toBeNull();
    // Step one rally — boost should decrement.
    const stepped = simulateRallyStep(r.state).newState;
    expect(stepped.activeBoost?.pointsRemaining).toBe(9); // 10 → 9
  });
});
