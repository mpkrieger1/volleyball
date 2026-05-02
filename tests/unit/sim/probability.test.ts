import { describe, expect, it } from 'vitest';
import { sim } from '@vcd/shared';

const ratings = (over: Partial<sim.PlayerRatings> = {}): sim.PlayerRatings => ({
  attack: 50,
  block: 50,
  serve: 50,
  pass: 50,
  set: 50,
  dig: 50,
  athleticism: 50,
  iq: 50,
  stamina: 50,
  ...over,
});

const sumOf = (d: Record<string, number>): number =>
  Object.values(d).reduce((a, b) => a + b, 0);

describe('probability distributions', () => {
  it('serveOutcome sums to 1 across rating profiles', () => {
    for (const s of [0, 25, 50, 75, 100]) {
      for (const p of [0, 50, 100]) {
        const d = sim.serveOutcome(ratings({ serve: s }), ratings({ pass: p }));
        expect(sumOf(d)).toBeCloseTo(1, 9);
        for (const v of Object.values(d)) {
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it('receptionOutcome sums to 1 for every serve quality', () => {
    for (const q of ['in_play_good', 'in_play_ok', 'in_play_bad'] as const) {
      const d = sim.receptionOutcome(ratings(), q);
      expect(sumOf(d)).toBeCloseTo(1, 9);
    }
  });

  it('setOutcome sums to 1 for every reception grade', () => {
    for (const g of ['perfect', 'good', 'ok', 'bad'] as const) {
      const d = sim.setOutcome(ratings(), g);
      expect(sumOf(d)).toBeCloseTo(1, 9);
    }
  });

  it('attackOutcome sums to 1 for every set quality', () => {
    for (const q of ['perfect', 'good', 'ok', 'bad'] as const) {
      const d = sim.attackOutcome(ratings(), ratings(), q);
      expect(sumOf(d)).toBeCloseTo(1, 9);
    }
  });

  it('digOutcome sums to 1', () => {
    const d = sim.digOutcome(ratings());
    expect(sumOf(d)).toBeCloseTo(1, 9);
  });
});

describe('monotonicity invariants', () => {
  it('ace rate rises with server serve rating', () => {
    const low = sim.serveOutcome(ratings({ serve: 40 }), ratings());
    const mid = sim.serveOutcome(ratings({ serve: 60 }), ratings());
    const high = sim.serveOutcome(ratings({ serve: 80 }), ratings());
    expect(mid.ace).toBeGreaterThan(low.ace);
    expect(high.ace).toBeGreaterThan(mid.ace);
  });

  it('perfect reception rate rises with receiver pass rating', () => {
    const low = sim.receptionOutcome(ratings({ pass: 40 }), 'in_play_good');
    const high = sim.receptionOutcome(ratings({ pass: 80 }), 'in_play_good');
    expect(high.perfect).toBeGreaterThan(low.perfect);
  });

  it('kill rate rises with attacker attack rating', () => {
    const low = sim.attackOutcome(ratings({ attack: 40 }), ratings(), 'good');
    const high = sim.attackOutcome(ratings({ attack: 80 }), ratings(), 'good');
    expect(high.kill).toBeGreaterThan(low.kill);
  });

  it('kill rate falls with higher opponent block', () => {
    const weak = sim.attackOutcome(ratings(), ratings({ block: 30 }), 'good');
    const strong = sim.attackOutcome(ratings(), ratings({ block: 80 }), 'good');
    expect(strong.kill).toBeLessThan(weak.kill);
  });

  it('a perfect set boosts kill rate over an ok set', () => {
    const okSet = sim.attackOutcome(ratings(), ratings(), 'ok');
    const perfectSet = sim.attackOutcome(ratings(), ratings(), 'perfect');
    expect(perfectSet.kill).toBeGreaterThan(okSet.kill);
  });
});

describe('sample()', () => {
  it('picks the first key whose cumulative mass exceeds u', () => {
    const d = { a: 0.25, b: 0.25, c: 0.5 };
    expect(sim.sample(d, 0.1)).toBe('a');
    expect(sim.sample(d, 0.3)).toBe('b');
    expect(sim.sample(d, 0.6)).toBe('c');
    expect(sim.sample(d, 0.9999)).toBe('c');
  });
});
