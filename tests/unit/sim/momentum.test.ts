import { describe, expect, it } from 'vitest';
import { sim } from '@vcd/shared';

describe('momentum', () => {
  it('initial momentum is zero for each team', () => {
    const m = sim.initialMomentum();
    expect(m.home).toBe(0);
    expect(m.away).toBe(0);
    expect(m.runLength).toBe(0);
    expect(m.lastWinner).toBeNull();
  });

  it('winning a point nudges winner up, loser down', () => {
    const m1 = sim.updateOnPoint(sim.initialMomentum(), 'home');
    expect(m1.home).toBeGreaterThan(0);
    expect(m1.away).toBeLessThan(0);
    expect(m1.runLength).toBe(1);
    expect(m1.lastWinner).toBe('home');
  });

  it('3-point run exceeds the swing threshold', () => {
    let m = sim.initialMomentum();
    const start = { ...m };
    m = sim.updateOnPoint(m, 'home');
    m = sim.updateOnPoint(m, 'home');
    m = sim.updateOnPoint(m, 'home');
    expect(m.runLength).toBe(3);
    expect(sim.swingOccurred(start, m)).toBe(true);
  });

  it('clamps to [-1, +1] under any sequence of updates (10k-step fuzz)', () => {
    let m = sim.initialMomentum();
    // Deterministic fuzz — alternate + bias
    for (let i = 0; i < 10_000; i++) {
      const winner: sim.TeamSide = (i * 7 + 3) % 11 < 5 ? 'home' : 'away';
      m = sim.updateOnPoint(m, winner);
      expect(m.home).toBeGreaterThanOrEqual(-1);
      expect(m.home).toBeLessThanOrEqual(1);
      expect(m.away).toBeGreaterThanOrEqual(-1);
      expect(m.away).toBeLessThanOrEqual(1);
    }
  });

  it('timeout halves the opposing team\'s momentum magnitude', () => {
    let m = sim.initialMomentum();
    m = sim.updateOnPoint(m, 'away');
    m = sim.updateOnPoint(m, 'away');
    m = sim.updateOnPoint(m, 'away');
    m = sim.updateOnPoint(m, 'away');
    const before = m.away;
    const after = sim.resetOnTimeout(m, 'home'); // home calls timeout, reset away
    expect(after.away).toBeCloseTo(before * 0.5, 6);
    expect(after.home).toBe(m.home); // own momentum unchanged
    expect(after.runLength).toBe(0);
  });

  it('attackMomentumBonus is bounded by MOMENTUM_ATTACK_BIAS_MAX', () => {
    const max = sim.TUNING.MOMENTUM_ATTACK_BIAS_MAX;
    const high: sim.MomentumState = { home: 1, away: -1, lastWinner: 'home', runLength: 5 };
    expect(sim.attackMomentumBonus(high, 'home')).toBeCloseTo(max);
    expect(sim.attackMomentumBonus(high, 'away')).toBeCloseTo(-max);
  });

  it('attackOutcome with momentumBias=+max shifts kill rate up vs neutral', () => {
    const balanced: sim.PlayerRatings = {
      attack: 50, block: 50, serve: 50, pass: 50, set: 50, dig: 50,
      athleticism: 50, iq: 50, stamina: 50,
    };
    const neutral = sim.attackOutcome(balanced, balanced, 'good', 0);
    const boosted = sim.attackOutcome(balanced, balanced, 'good', sim.TUNING.MOMENTUM_ATTACK_BIAS_MAX);
    expect(boosted.kill).toBeGreaterThan(neutral.kill);
  });

  it('MomentumStateSchema rejects out-of-range values', () => {
    expect(() =>
      sim.MomentumStateSchema.parse({ home: 1.5, away: 0, lastWinner: null, runLength: 0 }),
    ).toThrow();
  });
});
