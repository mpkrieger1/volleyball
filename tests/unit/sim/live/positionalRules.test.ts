// Sprint 31 Task 31.3: positional rules + setter dump tests.

import { describe, expect, it } from 'vitest';
import { sim } from '@vcd/shared';
import { simulateRallyStep, simulateMatchLive, simulateMatch, type TeamMatchState } from '@vcd/workers';
import {
  createLiveMatchState,
  type LiveMatchState,
  type TeamLiveState,
  type TacticalHint,
} from '@vcd/shared/sim/live/state';

const balanced = (): sim.PlayerRatings => ({
  attack: 50, block: 50, serve: 50, pass: 50, set: 50, dig: 50,
  athleticism: 50, iq: 50, stamina: 50,
});

const teamMatch = (team: sim.TeamSide): TeamMatchState => ({
  lineup: { team, players: Array.from({ length: 6 }, () => balanced()) },
  rotation: sim.initialRotation(),
  libero: sim.liberoOff(5),
  setterIndex: 0,
  system: sim.defaultSystem51(),
});

const liveTeam = (team: sim.TeamSide, hint: TacticalHint = 'balanced'): TeamLiveState => ({
  lineup: { team, players: Array.from({ length: 6 }, () => balanced()) },
  rotation: sim.initialRotation(),
  libero: sim.liberoOff(5),
  setterIndex: 0,
  system: sim.defaultSystem51(),
  playerIdsBySlot: ['s0', 's1', 's2', 's3', 's4', 's5'],
  bench: [],
  tacticalHint: hint,
});

describe('HINT_TABLE values match locked spec', () => {
  it.each([
    ['aggressive', 1.10, 1.05, 0.07],
    ['balanced',   1.10, 1.10, 0.05],
    ['defensive',  1.10, 1.15, 0.03],
  ] as const)('%s', (hint, fra, brp, sd) => {
    expect(sim.HINT_TABLE[hint].frontRowAttackMult).toBeCloseTo(fra, 5);
    expect(sim.HINT_TABLE[hint].backRowPassMult).toBeCloseTo(brp, 5);
    expect(sim.HINT_TABLE[hint].setterDumpProb).toBeCloseTo(sd, 5);
  });
});

describe('applyPositionalToLineup', () => {
  it('boosts front-row attackers, leaves back-row attack untouched', () => {
    const lineup: sim.PlayerLineup = {
      team: 'home',
      players: Array.from({ length: 6 }, () => balanced()),
    };
    const rotation = sim.initialRotation();
    // initialRotation: slots [0,1,2,3,4,5] at [P1,P2,P3,P4,P5,P6]
    // → P2/P3/P4 (front-row) hold slot indices 1, 2, 3
    const out = sim.applyPositionalToLineup(lineup, rotation, null, 'balanced');
    expect(out.players[1]?.attack).toBeCloseTo(50 * 1.10, 5); // front-row P2
    expect(out.players[2]?.attack).toBeCloseTo(50 * 1.10, 5); // P3
    expect(out.players[3]?.attack).toBeCloseTo(50 * 1.10, 5); // P4
    expect(out.players[0]?.attack).toBe(50); // P1 (back-row): unchanged
    expect(out.players[4]?.attack).toBe(50); // P5: unchanged
    expect(out.players[5]?.attack).toBe(50); // P6: unchanged
  });

  it('boosts back-row passers, leaves front-row pass untouched', () => {
    const lineup: sim.PlayerLineup = {
      team: 'home',
      players: Array.from({ length: 6 }, () => balanced()),
    };
    const rotation = sim.initialRotation();
    const out = sim.applyPositionalToLineup(lineup, rotation, null, 'defensive');
    // back-row slots: 0 (P1), 4 (P5), 5 (P6) → ×1.15
    expect(out.players[0]?.pass).toBeCloseTo(50 * 1.15, 5);
    expect(out.players[4]?.pass).toBeCloseTo(50 * 1.15, 5);
    expect(out.players[5]?.pass).toBeCloseTo(50 * 1.15, 5);
    // front-row pass unchanged
    expect(out.players[1]?.pass).toBe(50);
    expect(out.players[2]?.pass).toBe(50);
    expect(out.players[3]?.pass).toBe(50);
  });

  it('caps multipliers at 100', () => {
    const lineup: sim.PlayerLineup = {
      team: 'home',
      players: Array.from({ length: 6 }, () => ({ ...balanced(), attack: 95, pass: 95 })),
    };
    const rotation = sim.initialRotation();
    const out = sim.applyPositionalToLineup(lineup, rotation, null, 'defensive');
    // Front-row: 95 × 1.10 = 104.5 → capped to 100
    expect(out.players[2]?.attack).toBe(100);
    // Back-row pass: 95 × 1.15 = 109.25 → capped to 100
    expect(out.players[0]?.pass).toBe(100);
  });
});

describe('setterDumpProbability', () => {
  it('returns 0 for 6-2 system or back-row setter regardless of hint', () => {
    expect(sim.setterDumpProbability('aggressive', '6-2', true)).toBe(0);
    expect(sim.setterDumpProbability('balanced', '6-2', true)).toBe(0);
    expect(sim.setterDumpProbability('defensive', '6-2', true)).toBe(0);
    expect(sim.setterDumpProbability('aggressive', '5-1', false)).toBe(0);
    expect(sim.setterDumpProbability('defensive', '5-1', false)).toBe(0);
  });

  it('returns hint-specific rate for 5-1 + setter front-row', () => {
    expect(sim.setterDumpProbability('aggressive', '5-1', true)).toBeCloseTo(0.07, 5);
    expect(sim.setterDumpProbability('balanced', '5-1', true)).toBeCloseTo(0.05, 5);
    expect(sim.setterDumpProbability('defensive', '5-1', true)).toBeCloseTo(0.03, 5);
  });
});

describe('isSetterFrontRow', () => {
  it('5-1: true when setter slot is at P2/P3/P4', () => {
    const sys = sim.defaultSystem51(); // setterIndex: 0
    // Default rotation places slot 0 at P1 (back-row)
    expect(sim.isSetterFrontRow(sys, sim.initialRotation())).toBe(false);
    // After 5 rotations, slot 0 has rotated through P1→P6→P5→P4→P3→P2 (front)
    let rot = sim.initialRotation();
    for (let i = 0; i < 5; i++) rot = sim.rotate(rot);
    expect(sim.isSetterFrontRow(sys, rot)).toBe(true);
  });
});

// ─── CRITICAL: calibration determinism gate ──────────────────────────────

describe('CRITICAL — simulateMatch unchanged (calibration gate)', () => {
  // useLivePositionalRules defaults to false in simulateMatchLive helpers,
  // so byte-equality with simulateMatch must hold across many seeds.
  const SEEDS = [1, 7, 42, 99, 'alpha', 'beta', 'gamma', 'delta', 12345, 'sprint-31'];
  it.each(SEEDS)('byte-equal sim vs liveMatch with positional rules off (seed=%s)', (seed) => {
    const home = teamMatch('home');
    const away = teamMatch('away');
    const oneShot = simulateMatch({ seed, home, away, initialServer: 'home', useCoachAi: false });
    const live = simulateMatchLive({ seed, home, away, initialServer: 'home', useCoachAi: false });
    for (let i = 0; i < oneShot.sets.length; i++) {
      const a = oneShot.sets[i]!;
      const b = live.match.sets[i]!;
      for (let r = 0; r < a.rallies.length; r++) {
        expect(b.rallies[r]!.events).toEqual(a.rallies[r]!.events);
      }
    }
  });
});

describe('integration: positional rules layer in via step.ts', () => {
  it('useLivePositionalRules=true changes home attack rate vs off', () => {
    // Stack the deck: home = balanced ratings; positional rules ON should
    // boost front-row attacks measurably.
    let killsOn = 0;
    let killsOff = 0;
    let attacksOn = 0;
    let attacksOff = 0;
    for (let i = 0; i < 200; i++) {
      const seed = `pos-${i}`;
      const baseOff: LiveMatchState = createLiveMatchState({
        matchId: 'm', seed, home: liveTeam('home', 'balanced'), away: liveTeam('away', 'balanced'),
        initialServer: 'home', useCoachAi: false, useLivePositionalRules: false,
      });
      const baseOn: LiveMatchState = createLiveMatchState({
        matchId: 'm', seed, home: liveTeam('home', 'balanced'), away: liveTeam('away', 'balanced'),
        initialServer: 'home', useCoachAi: false, useLivePositionalRules: true,
      });
      const ra = simulateRallyStep(baseOff).rally;
      const rb = simulateRallyStep(baseOn).rally;
      for (const ev of ra.events) {
        if (ev.kind === 'attack' && ev.team === 'home') {
          attacksOff += 1;
          if (ev.outcome === 'kill') killsOff += 1;
        }
      }
      for (const ev of rb.events) {
        if (ev.kind === 'attack' && ev.team === 'home') {
          attacksOn += 1;
          if (ev.outcome === 'kill') killsOn += 1;
        }
      }
    }
    // With +10% on attack rating across all front-row hitters, kill rate
    // should rise noticeably. Generous tolerance to avoid flake.
    const rateOn = killsOn / Math.max(1, attacksOn);
    const rateOff = killsOff / Math.max(1, attacksOff);
    expect(rateOn).toBeGreaterThan(rateOff);
  });
});
