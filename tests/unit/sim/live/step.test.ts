// Sprint 29 Task 29.1: incremental driver byte-equality + behavior tests.
//
// THE CORE GUARANTEE — proving sim-only path is unaffected by Sprint 29:
//   simulateMatchLive(seed, no coach inputs) MUST produce byte-identical
//   per-rally events to simulateMatch(seed) for the same teams + initial
//   server + useCoachAi flag.
//
// Plus:
//   - playRallies(N) then playRallies(M) ≡ playRallies(N+M)
//   - state JSON round-trip preserves equality
//   - simulateRallyStep throws when called on a finished match

import { describe, expect, it } from 'vitest';
import { sim } from '@vcd/shared';
import {
  simulateRallyStep,
  simulateMatchLive,
  simulateMatch,
  type TeamMatchState,
} from '@vcd/workers';
import {
  createLiveMatchState,
  LiveMatchStateSchema,
  type LiveMatchState,
  type TeamLiveState,
} from '@vcd/shared/sim/live/state';

const balanced = (): sim.PlayerRatings => ({
  attack: 50, block: 50, serve: 50, pass: 50, set: 50, dig: 50,
  athleticism: 50, iq: 50, stamina: 50,
});

const teamMatchState = (team: sim.TeamSide): TeamMatchState => ({
  lineup: { team, players: Array.from({ length: 6 }, () => balanced()) },
  rotation: sim.initialRotation(),
  libero: sim.liberoOff(5),
  setterIndex: 0,
  system: sim.defaultSystem51(),
});

const liveTeam = (team: sim.TeamSide): TeamLiveState => ({
  lineup: { team, players: Array.from({ length: 6 }, () => balanced()) },
  rotation: sim.initialRotation(),
  libero: sim.liberoOff(5),
  setterIndex: 0,
  system: sim.defaultSystem51(),
});

const SEEDS = [1, 7, 42, 'alpha', 'beta-2026', 99999];

describe('simulateMatchLive — byte-equality with simulateMatch', () => {
  it.each(SEEDS)('produces identical rally events for seed=%s (useCoachAi=false)', (seed) => {
    const home = teamMatchState('home');
    const away = teamMatchState('away');
    const oneShot = simulateMatch({ seed, home, away, initialServer: 'home', useCoachAi: false });
    const live = simulateMatchLive({ seed, home, away, initialServer: 'home', useCoachAi: false });

    expect(live.match.winner).toBe(oneShot.winner);
    expect(live.match.homeSetsWon).toBe(oneShot.homeSetsWon);
    expect(live.match.awaySetsWon).toBe(oneShot.awaySetsWon);
    expect(live.match.sets.length).toBe(oneShot.sets.length);

    for (let i = 0; i < oneShot.sets.length; i++) {
      const a = oneShot.sets[i]!;
      const b = live.match.sets[i]!;
      expect(b.homeScore).toBe(a.homeScore);
      expect(b.awayScore).toBe(a.awayScore);
      expect(b.rallies.length).toBe(a.rallies.length);
      // Per-rally byte-equality: events array identical.
      for (let r = 0; r < a.rallies.length; r++) {
        expect(b.rallies[r]!.events).toEqual(a.rallies[r]!.events);
        expect(b.rallies[r]!.winningTeam).toBe(a.rallies[r]!.winningTeam);
      }
    }
  });

  it.each(SEEDS)('produces identical rally events for seed=%s (useCoachAi=true, AI parity)', (seed) => {
    const home = teamMatchState('home');
    const away = teamMatchState('away');
    const oneShot = simulateMatch({ seed, home, away, initialServer: 'home', useCoachAi: true });
    const live = simulateMatchLive({ seed, home, away, initialServer: 'home', useCoachAi: true });

    expect(live.match.winner).toBe(oneShot.winner);
    expect(live.match.homeSetsWon).toBe(oneShot.homeSetsWon);
    expect(live.match.awaySetsWon).toBe(oneShot.awaySetsWon);
    for (let i = 0; i < oneShot.sets.length; i++) {
      const a = oneShot.sets[i]!;
      const b = live.match.sets[i]!;
      expect(b.rallies.length).toBe(a.rallies.length);
      for (let r = 0; r < a.rallies.length; r++) {
        expect(b.rallies[r]!.events).toEqual(a.rallies[r]!.events);
      }
      // Coach AI timeouts also identical.
      expect(b.timeouts.length).toBe(a.timeouts.length);
      for (let t = 0; t < a.timeouts.length; t++) {
        expect(b.timeouts[t]!.atRallyIdx).toBe(a.timeouts[t]!.atRallyIdx);
        expect(b.timeouts[t]!.by).toBe(a.timeouts[t]!.by);
      }
    }
  });
});

describe('simulateRallyStep — incremental == one-shot', () => {
  it('playRallies(N) then playRallies(M) produces same final state as playRallies(N+M)', () => {
    const make = (): LiveMatchState =>
      createLiveMatchState({
        matchId: 'm',
        seed: 'split-test',
        home: liveTeam('home'),
        away: liveTeam('away'),
        initialServer: 'home',
        useCoachAi: false,
      });

    // Drive A: 30 rallies in two batches (10 + 20)
    let a = make();
    for (let i = 0; i < 10 && a.status === 'in_progress'; i++) a = simulateRallyStep(a).newState;
    for (let i = 0; i < 20 && a.status === 'in_progress'; i++) a = simulateRallyStep(a).newState;

    // Drive B: 30 rallies in one batch
    let b = make();
    for (let i = 0; i < 30 && b.status === 'in_progress'; i++) b = simulateRallyStep(b).newState;

    expect(a).toEqual(b);
  });

  it('throws when called on a finished match', () => {
    const live = simulateMatchLive({
      seed: 'short',
      home: teamMatchState('home'),
      away: teamMatchState('away'),
      initialServer: 'home',
      useCoachAi: false,
    });
    expect(live.finalState.status).toBe('finished');
    expect(() => simulateRallyStep(live.finalState)).toThrow(/already finished/);
  });

  it('does not mutate the input state', () => {
    const initial = createLiveMatchState({
      matchId: 'm',
      seed: 1,
      home: liveTeam('home'),
      away: liveTeam('away'),
      initialServer: 'home',
    });
    const snapshot = JSON.parse(JSON.stringify(initial));
    simulateRallyStep(initial);
    expect(initial).toEqual(snapshot);
  });

  it('emits the right StepEvent for set/match transitions', () => {
    const events: string[] = [];
    let state = createLiveMatchState({
      matchId: 'm',
      seed: 'event-trace',
      home: liveTeam('home'),
      away: liveTeam('away'),
      initialServer: 'home',
      useCoachAi: false,
    });
    while (state.status === 'in_progress') {
      const r = simulateRallyStep(state);
      events.push(r.event);
      state = r.newState;
    }
    // Last event must be 'match_complete'.
    expect(events[events.length - 1]).toBe('match_complete');
    // Every set ends with either 'set_complete' or 'match_complete', and
    // both branches push to completedSets — so the boundary count equals
    // the total sets played (3..5 for best-of-5).
    const setBoundaries = events.filter((e) => e === 'set_complete' || e === 'match_complete').length;
    expect(setBoundaries).toBe(state.completedSets.length);
    expect(setBoundaries).toBeGreaterThanOrEqual(3);
    expect(setBoundaries).toBeLessThanOrEqual(5);
  });
});

describe('LiveMatchState mid-match JSON round-trip', () => {
  it('preserves state byte-for-byte after 25 rallies', () => {
    let state = createLiveMatchState({
      matchId: 'm',
      seed: 'mid-trip',
      home: liveTeam('home'),
      away: liveTeam('away'),
      initialServer: 'home',
      useCoachAi: false,
    });
    for (let i = 0; i < 25 && state.status === 'in_progress'; i++) {
      state = simulateRallyStep(state).newState;
    }
    const roundTripped = LiveMatchStateSchema.parse(JSON.parse(JSON.stringify(state)));
    expect(roundTripped).toEqual(state);

    // Resume from the round-tripped state — must continue identically.
    let live = state;
    let resumed = roundTripped;
    while (live.status === 'in_progress') {
      live = simulateRallyStep(live).newState;
      resumed = simulateRallyStep(resumed).newState;
    }
    expect(resumed).toEqual(live);
  });
});
