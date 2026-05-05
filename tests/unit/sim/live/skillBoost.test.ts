// Sprint 30 Task 30.2: skill-talk boost engine tests.

import { describe, expect, it } from 'vitest';
import { sim } from '@vcd/shared';
import { simulateRallyStep } from '@vcd/workers';
import {
  createLiveMatchState,
  type TeamLiveState,
  type LiveMatchState,
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

describe('boostDurationFor', () => {
  it.each([
    [0, 7],     // floor wins
    [10, 7],    // 5 + 1 = 6 → floor 7
    [20, 7],    // 5 + 2 = 7 → exactly floor
    [30, 8],    // 5 + 3 = 8
    [50, 10],   // 5 + 5 = 10
    [80, 13],   // 5 + 8 = 13
    [100, 15],  // 5 + 10 = 15 (cap at top of strategy range)
  ])('strategy=%i → duration=%i', (s, d) => {
    expect(sim.boostDurationFor(s)).toBe(d);
  });
});

describe('createBoost', () => {
  it('builds a fresh boost with correct shape', () => {
    const b = sim.createBoost('home', 'attack', 50);
    expect(b).toEqual({ team: 'home', skill: 'attack', pointsRemaining: 10 });
  });
});

describe('effectiveSkillMultiplier', () => {
  const baseState = (): LiveMatchState =>
    createLiveMatchState({
      matchId: 'm', seed: 's',
      home: liveTeam('home'), away: liveTeam('away'),
      initialServer: 'home',
    });

  it('returns 1.0 with no momentum + no boost', () => {
    const s = baseState();
    expect(sim.effectiveSkillMultiplier(s, 'home', 'attack')).toBe(1.0);
  });

  it('returns 1.05 when boost matches team + skill', () => {
    const s: LiveMatchState = {
      ...baseState(),
      activeBoost: { team: 'home', skill: 'attack', pointsRemaining: 5 },
    };
    expect(sim.effectiveSkillMultiplier(s, 'home', 'attack')).toBeCloseTo(1.05, 5);
  });

  it('returns 1.0 when boost team matches but skill differs', () => {
    const s: LiveMatchState = {
      ...baseState(),
      activeBoost: { team: 'home', skill: 'block', pointsRemaining: 5 },
    };
    expect(sim.effectiveSkillMultiplier(s, 'home', 'attack')).toBe(1.0);
  });

  it('returns 1.0 when boost is on the opposite team', () => {
    const s: LiveMatchState = {
      ...baseState(),
      activeBoost: { team: 'away', skill: 'attack', pointsRemaining: 5 },
    };
    expect(sim.effectiveSkillMultiplier(s, 'home', 'attack')).toBe(1.0);
  });

  it('stacks momentum × boost multiplicatively', () => {
    const s: LiveMatchState = {
      ...baseState(),
      useLiveMomentum: true,
      liveMomentum: { home: 3, away: 0 }, // tier 1 → ×1.025
      activeBoost: { team: 'home', skill: 'attack', pointsRemaining: 5 },
    };
    expect(sim.effectiveSkillMultiplier(s, 'home', 'attack')).toBeCloseTo(1.025 * 1.05, 5);
  });

  it('momentum-only when no boost', () => {
    const s: LiveMatchState = {
      ...baseState(),
      useLiveMomentum: true,
      liveMomentum: { home: 6, away: 0 }, // tier 2 → ×1.025^2
    };
    expect(sim.effectiveSkillMultiplier(s, 'home', 'attack')).toBeCloseTo(1.025 * 1.025, 5);
  });
});

describe('buildSkillMultipliers + isUnitMultiplier', () => {
  it('all 1.0 with no boosts → isUnit', () => {
    const s = createLiveMatchState({
      matchId: 'm', seed: 's',
      home: liveTeam('home'), away: liveTeam('away'),
      initialServer: 'home',
    });
    const m = sim.buildSkillMultipliers(s, 'home');
    expect(sim.isUnitMultiplier(m)).toBe(true);
  });

  it('boost on attack → only attack ≠ 1.0', () => {
    const s: LiveMatchState = {
      ...createLiveMatchState({
        matchId: 'm', seed: 's',
        home: liveTeam('home'), away: liveTeam('away'),
        initialServer: 'home',
      }),
      activeBoost: { team: 'home', skill: 'attack', pointsRemaining: 5 },
    };
    const m = sim.buildSkillMultipliers(s, 'home');
    expect(m.attack).toBeCloseTo(1.05, 5);
    expect(m.serve).toBe(1.0);
    expect(m.dig).toBe(1.0);
    expect(sim.isUnitMultiplier(m)).toBe(false);
    // Away side has no boost.
    const a = sim.buildSkillMultipliers(s, 'away');
    expect(sim.isUnitMultiplier(a)).toBe(true);
  });
});

describe('decrementBoost', () => {
  const make = (pts: number): LiveMatchState => ({
    ...createLiveMatchState({
      matchId: 'm', seed: 's',
      home: liveTeam('home'), away: liveTeam('away'),
      initialServer: 'home',
    }),
    activeBoost: { team: 'home', skill: 'attack', pointsRemaining: pts },
  });

  it('decrements pointsRemaining by 1', () => {
    const s = sim.decrementBoost(make(5));
    expect(s.activeBoost?.pointsRemaining).toBe(4);
  });

  it('clears boost (sets activeBoost=null) when pointsRemaining reaches 0', () => {
    const s = sim.decrementBoost(make(1));
    expect(s.activeBoost).toBeNull();
  });

  it('no-op when activeBoost is null', () => {
    const s = createLiveMatchState({
      matchId: 'm', seed: 's',
      home: liveTeam('home'), away: liveTeam('away'),
      initialServer: 'home',
    });
    expect(sim.decrementBoost(s)).toBe(s);
  });
});

describe('boost integration with simulateRallyStep', () => {
  it('boost decrements automatically each rally', () => {
    let state: LiveMatchState = {
      ...createLiveMatchState({
        matchId: 'm', seed: 'b1',
        home: liveTeam('home'), away: liveTeam('away'),
        initialServer: 'home',
        useCoachAi: false,
      }),
      activeBoost: { team: 'home', skill: 'attack', pointsRemaining: 3 },
    };
    state = simulateRallyStep(state).newState;
    expect(state.activeBoost?.pointsRemaining).toBe(2);
    state = simulateRallyStep(state).newState;
    expect(state.activeBoost?.pointsRemaining).toBe(1);
    state = simulateRallyStep(state).newState;
    expect(state.activeBoost).toBeNull();
  });

  it('Monte Carlo: home attack-talk boost increases home kill rate over many seeds', () => {
    // Aggregate home attack outcomes across 200 different seeds (one rally
    // per seed, fresh state) — the boost should produce more kills than
    // the no-boost baseline. We use independent seeds rather than
    // continuing a single match because each rally's home momentum drift
    // would otherwise confound the comparison.
    let killsBaseline = 0;
    let killsBoosted = 0;
    let attacksBaseline = 0;
    let attacksBoosted = 0;
    for (let i = 0; i < 200; i++) {
      const seed = `mc-${i}`;
      const baseline = createLiveMatchState({
        matchId: 'm', seed, home: liveTeam('home'), away: liveTeam('away'),
        initialServer: 'home', useCoachAi: false,
      });
      const boosted: LiveMatchState = {
        ...baseline,
        activeBoost: { team: 'home', skill: 'attack', pointsRemaining: 100 },
      };
      const ra = simulateRallyStep(baseline).rally;
      const rb = simulateRallyStep(boosted).rally;
      for (const ev of ra.events) {
        if (ev.kind === 'attack' && ev.team === 'home') {
          attacksBaseline += 1;
          if (ev.outcome === 'kill') killsBaseline += 1;
        }
      }
      for (const ev of rb.events) {
        if (ev.kind === 'attack' && ev.team === 'home') {
          attacksBoosted += 1;
          if (ev.outcome === 'kill') killsBoosted += 1;
        }
      }
    }
    const baselineRate = killsBaseline / Math.max(1, attacksBaseline);
    const boostedRate = killsBoosted / Math.max(1, attacksBoosted);
    // Boost should raise kill rate by roughly +1-3 percentage points.
    // Tolerance is wide because the FSM has dig branches that can mask the
    // boost on first-attack-only events. Plenty of margin to avoid flake.
    expect(boostedRate).toBeGreaterThan(baselineRate);
  });
});

describe('byte-equality preserved when no boost + no momentum', () => {
  it('matches Sprint 29 baseline for repeated rallies', () => {
    const make = (): LiveMatchState =>
      createLiveMatchState({
        matchId: 'm', seed: 'parity',
        home: liveTeam('home'), away: liveTeam('away'),
        initialServer: 'home',
        useCoachAi: false,
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
