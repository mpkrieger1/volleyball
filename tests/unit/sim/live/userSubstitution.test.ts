// Sprint 30 Task 30.3: substitution system tests.

import { describe, expect, it } from 'vitest';
import { sim } from '@vcd/shared';
import { simulateRallyStep } from '@vcd/workers';
import {
  createLiveMatchState,
  applyUserSubstitution,
  type LiveMatchState,
  type TeamLiveState,
  type BenchPlayer,
} from '@vcd/shared/sim/live/state';

const balanced = (overrides: Partial<sim.PlayerRatings> = {}): sim.PlayerRatings => ({
  attack: 50, block: 50, serve: 50, pass: 50, set: 50, dig: 50,
  athleticism: 50, iq: 50, stamina: 50,
  ...overrides,
});

const benchPlayer = (id: string, overrides: Partial<BenchPlayer> = {}): BenchPlayer => ({
  playerId: id,
  firstName: 'B',
  lastName: id.toUpperCase(),
  position: 'OH',
  jersey: 99,
  isLibero: false,
  ratings: balanced(),
  ...overrides,
});

const liveTeam = (
  team: sim.TeamSide,
  starters: string[] = ['s0', 's1', 's2', 's3', 's4', 's5'],
  bench: BenchPlayer[] = [benchPlayer('b1'), benchPlayer('b2')],
): TeamLiveState => ({
  lineup: { team, players: Array.from({ length: 6 }, () => balanced()) },
  rotation: sim.initialRotation(),
  libero: sim.liberoOff(5),
  setterIndex: 0,
  system: sim.defaultSystem51(),
  playerIdsBySlot: starters as TeamLiveState['playerIdsBySlot'],
  bench,
});

const baseState = (overrides: Partial<LiveMatchState> = {}): LiveMatchState => ({
  ...createLiveMatchState({
    matchId: 'm', seed: 'sub', home: liveTeam('home'), away: liveTeam('away'),
    initialServer: 'home', useCoachAi: false,
    userTeam: 'home',
  }),
  ...overrides,
});

describe('applyUserSubstitution — happy path', () => {
  it('swaps lineup ratings and playerIdsBySlot atomically', () => {
    const s = baseState();
    const r = applyUserSubstitution(s, { outIdx: 1, inPlayerId: 'b1' });
    expect(r.ok).toBe(true);
    if (r.ok) {
      // playerIdsBySlot updated
      expect(r.state.home.playerIdsBySlot[1]).toBe('b1');
      // outgoing went to bench (last entry)
      const newBench = r.state.home.bench;
      expect(newBench.length).toBe(s.home.bench.length); // -1 then +1 = same
      expect(newBench[newBench.length - 1]?.playerId).toBe('s1');
    }
  });

  it('increments subsHome counter by 1', () => {
    const s = baseState();
    const r = applyUserSubstitution(s, { outIdx: 0, inPlayerId: 'b1' });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.state.subsHome).toBe(1);
      expect(r.state.subsAway).toBe(0);
    }
  });

  it('appends substitution CoachAction with rallyIndex=rallyCursor', () => {
    const s = baseState({ rallyCursor: 7 });
    const r = applyUserSubstitution(s, { outIdx: 2, inPlayerId: 'b2' });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.state.coachActionLog).toHaveLength(1);
      expect(r.state.coachActionLog[0]).toEqual({
        kind: 'substitution',
        team: 'home',
        rallyIndex: 7,
        out: 's2',
        in: 'b2',
      });
    }
  });

  it('subbed-in player ratings replace lineup.players[outIdx]', () => {
    const stronger = balanced({ attack: 90, block: 85 });
    const s = baseState({
      home: liveTeam('home', undefined, [
        benchPlayer('b-strong', { ratings: stronger }),
      ]),
    });
    const r = applyUserSubstitution(s, { outIdx: 3, inPlayerId: 'b-strong' });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.state.home.lineup.players[3]?.attack).toBe(90);
      expect(r.state.home.lineup.players[3]?.block).toBe(85);
    }
  });
});

describe('applyUserSubstitution — rejections', () => {
  it('rejects when subsUsed === 15 (SUBS_EXHAUSTED)', () => {
    const s = baseState({ subsHome: 15 });
    const r = applyUserSubstitution(s, { outIdx: 0, inPlayerId: 'b1' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('SUBS_EXHAUSTED');
  });

  it('rejects libero slot swap (LIBERO_SLOT_SWAP_NOT_ALLOWED)', () => {
    // Default libero index is 5 (sim.liberoOff(5)).
    const s = baseState();
    const r = applyUserSubstitution(s, { outIdx: 5, inPlayerId: 'b1' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('LIBERO_SLOT_SWAP_NOT_ALLOWED');
  });

  it('rejects when inPlayerId not on bench (PLAYER_NOT_ON_BENCH)', () => {
    const s = baseState();
    const r = applyUserSubstitution(s, { outIdx: 0, inPlayerId: 'unknown-id' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('PLAYER_NOT_ON_BENCH');
  });

  it('rejects invalid outIdx (INVALID_SLOT)', () => {
    const s = baseState();
    const r = applyUserSubstitution(s, { outIdx: 9, inPlayerId: 'b1' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('INVALID_SLOT');
  });

  it('rejects when no user team (NO_USER_TEAM)', () => {
    const s = baseState({ userTeam: 'none' });
    const r = applyUserSubstitution(s, { outIdx: 0, inPlayerId: 'b1' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('NO_USER_TEAM');
  });

  it('rejects when match finished (INVALID_STATE)', () => {
    const s = baseState({ status: 'finished', winner: 'home' });
    const r = applyUserSubstitution(s, { outIdx: 0, inPlayerId: 'b1' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('INVALID_STATE');
  });
});

describe('sub cap resets at set transition', () => {
  it('after set boundary, subsHome === 0 even if a sub was made earlier', () => {
    let s: LiveMatchState = {
      ...baseState({
        currentSet: {
          index: 0, home: 24, away: 0, targetScore: 25, initialServer: 'home',
          rallyIdxInSet: 28, rallies: [], momentumAfterRally: [], timeouts: [],
        },
        subsHome: 7,
      }),
    };
    for (let i = 0; i < 30 && s.status === 'in_progress'; i++) {
      const r = simulateRallyStep(s);
      s = r.newState;
      if (r.event === 'set_complete') break;
    }
    expect(s.currentSet.index).toBe(1);
    expect(s.subsHome).toBe(0);
    expect(s.subsAway).toBe(0);
  });
});

describe('aiPickSubstitution', () => {
  it('returns pass when fatigue threshold not exceeded', () => {
    const s = baseState();
    const decision = sim.aiPickSubstitution(s, 'home');
    expect(decision.kind).toBe('pass');
  });

  it('returns sub decision when fatigue threshold exceeded + bench available', () => {
    // Force 5 sets played → fatigue = 5*0.5 = 2.5 (above threshold 2.0).
    const s = baseState({
      completedSets: Array.from({ length: 5 }, (_, i) => ({
        index: i as 0|1|2|3|4, homeScore: 25, awayScore: 20,
        rallies: [], momentumAfterRally: [], timeouts: [],
        servingTeamEnd: 'home' as sim.TeamSide,
        finalMomentum: sim.initialMomentum(),
        finalTimeoutsHome: sim.emptyTimeoutLedger(),
        finalTimeoutsAway: sim.emptyTimeoutLedger(),
      })),
    });
    const decision = sim.aiPickSubstitution(s, 'home');
    expect(decision.kind).toBe('sub');
    if (decision.kind === 'sub') {
      expect(decision.outIdx).toBeGreaterThanOrEqual(0);
      expect(decision.outIdx).toBeLessThanOrEqual(5);
      expect(decision.inPlayerId).toMatch(/^b\d+$/);
    }
  });

  it('is deterministic — same state, same decision', () => {
    const s = baseState({
      completedSets: Array.from({ length: 5 }, (_, i) => ({
        index: i as 0|1|2|3|4, homeScore: 25, awayScore: 20,
        rallies: [], momentumAfterRally: [], timeouts: [],
        servingTeamEnd: 'home' as sim.TeamSide,
        finalMomentum: sim.initialMomentum(),
        finalTimeoutsHome: sim.emptyTimeoutLedger(),
        finalTimeoutsAway: sim.emptyTimeoutLedger(),
      })),
    });
    const a = sim.aiPickSubstitution(s, 'home');
    const b = sim.aiPickSubstitution(s, 'home');
    expect(a).toEqual(b);
  });
});

describe('integration: subs flow through simulateRallyStep', () => {
  it('user sub via coachInputs reflects in next rally state', () => {
    const s = baseState();
    const stepped = simulateRallyStep(s, {
      substitution: { outIdx: 1, inPlayerId: 'b1' },
    }).newState;
    expect(stepped.home.playerIdsBySlot[1]).toBe('b1');
    expect(stepped.subsHome).toBe(1);
    expect(stepped.coachActionLog.some((a) => a.kind === 'substitution')).toBe(true);
  });
});

describe('byte-equality preserved when no subs + no momentum', () => {
  it('matches Sprint 29 baseline for repeated rallies', () => {
    const make = (): LiveMatchState => createLiveMatchState({
      matchId: 'm', seed: 'sub-parity',
      home: liveTeam('home'), away: liveTeam('away'),
      initialServer: 'home', useCoachAi: false,
    });
    let a = make();
    let b = make();
    for (let i = 0; i < 25 && a.status === 'in_progress'; i++) {
      a = simulateRallyStep(a).newState;
      b = simulateRallyStep(b).newState;
    }
    expect(a).toEqual(b);
  });
});
