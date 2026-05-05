// Sprint 29 Task 29.1: LiveMatchState schema round-trip + factory.
// Validates that the live-mode state is fully JSON-serializable so it can
// be persisted to Match.liveStateJson (Sprint 29 Task 29.5) and survive
// a pause/resume cycle byte-for-byte.

import { describe, expect, it } from 'vitest';
import { sim } from '@vcd/shared';
import {
  createLiveMatchState,
  LiveMatchStateSchema,
  targetScoreForSet,
  currentSetComplete,
  matchComplete,
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

describe('LiveMatchState schema', () => {
  it('createLiveMatchState produces a schema-valid initial state', () => {
    const state = createLiveMatchState({
      matchId: 'match-1',
      seed: 'seed-1',
      home: liveTeam('home'),
      away: liveTeam('away'),
      initialServer: 'home',
    });
    const parsed = LiveMatchStateSchema.parse(state);
    expect(parsed.kind).toBe('live');
    expect(parsed.matchId).toBe('match-1');
    expect(parsed.status).toBe('in_progress');
    expect(parsed.winner).toBeNull();
    expect(parsed.setsWon).toEqual({ home: 0, away: 0 });
    expect(parsed.currentSet.index).toBe(0);
    expect(parsed.currentSet.targetScore).toBe(25);
    expect(parsed.currentSet.rallyIdxInSet).toBe(0);
    expect(parsed.timeoutsHome.remaining).toBe(2);
    expect(parsed.timeoutsAway.remaining).toBe(2);
    expect(parsed.liveMomentum).toEqual({ home: 0, away: 0 });
    expect(parsed.coachActionLog).toEqual([]);
    expect(parsed.activeBoost).toBeNull();
  });

  it('round-trips through JSON.stringify / JSON.parse', () => {
    const state = createLiveMatchState({
      matchId: 'm',
      seed: 42,
      home: liveTeam('home'),
      away: liveTeam('away'),
      initialServer: 'away',
      useCoachAi: true,
    });
    const roundTripped = LiveMatchStateSchema.parse(
      JSON.parse(JSON.stringify(state)),
    );
    expect(roundTripped).toEqual(state);
  });

  it('rejects invalid score values', () => {
    const state = createLiveMatchState({
      matchId: 'm',
      seed: 1,
      home: liveTeam('home'),
      away: liveTeam('away'),
      initialServer: 'home',
    });
    const broken = { ...state, currentSet: { ...state.currentSet, home: -1 } };
    expect(() => LiveMatchStateSchema.parse(broken)).toThrow();
  });

  it('rejects status="finished" with null winner being mismatched is OK at schema level (status check is engine-level)', () => {
    // The schema permits any combination of status + winner — the engine
    // enforces that finished implies non-null winner. This documents the
    // boundary so future readers understand the invariant location.
    const state = createLiveMatchState({
      matchId: 'm',
      seed: 1,
      home: liveTeam('home'),
      away: liveTeam('away'),
      initialServer: 'home',
    });
    const odd = { ...state, status: 'finished' as const, winner: null };
    expect(() => LiveMatchStateSchema.parse(odd)).not.toThrow();
  });
});

describe('LiveMatchState helpers', () => {
  it('targetScoreForSet returns 25 for sets 0-3 and 15 for the decider', () => {
    expect(targetScoreForSet(0)).toBe(25);
    expect(targetScoreForSet(1)).toBe(25);
    expect(targetScoreForSet(2)).toBe(25);
    expect(targetScoreForSet(3)).toBe(25);
    expect(targetScoreForSet(4)).toBe(15);
  });

  it('currentSetComplete only true at >= target with a 2-point margin', () => {
    const base = createLiveMatchState({
      matchId: 'm',
      seed: 1,
      home: liveTeam('home'),
      away: liveTeam('away'),
      initialServer: 'home',
    });
    const at25_23 = { ...base, currentSet: { ...base.currentSet, home: 25, away: 23 } };
    const at25_24 = { ...base, currentSet: { ...base.currentSet, home: 25, away: 24 } };
    const at26_24 = { ...base, currentSet: { ...base.currentSet, home: 26, away: 24 } };
    expect(currentSetComplete(at25_23)).toBe(true);
    expect(currentSetComplete(at25_24)).toBe(false);
    expect(currentSetComplete(at26_24)).toBe(true);
  });

  it('matchComplete only true at 3 sets won', () => {
    const base = createLiveMatchState({
      matchId: 'm',
      seed: 1,
      home: liveTeam('home'),
      away: liveTeam('away'),
      initialServer: 'home',
    });
    expect(matchComplete({ ...base, setsWon: { home: 2, away: 2 } })).toBe(false);
    expect(matchComplete({ ...base, setsWon: { home: 3, away: 1 } })).toBe(true);
    expect(matchComplete({ ...base, setsWon: { home: 1, away: 3 } })).toBe(true);
  });
});
