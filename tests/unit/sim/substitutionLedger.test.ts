import { describe, expect, it } from 'vitest';
import { sim } from '@vcd/shared';

const starters = [0, 1, 2, 3, 4, 5];

describe('substitution ledger', () => {
  it('emptyLedger starts at zero subs', () => {
    const L = sim.emptyLedger(starters);
    expect(L.subsThisSet).toBe(0);
    expect(L.pairings).toEqual([]);
  });

  it('accepts 15 subs and rejects the 16th with CAP_EXCEEDED (PRD S4 exit test 3)', () => {
    let L = sim.emptyLedger(starters);
    // 15 legal subs using a fresh starter + fresh substitute each time. Only 6
    // starters exist, so we alternate who we sub out and use distinct subs 6..20.
    for (let i = 0; i < 15; i++) {
      const starter = starters[i % 6]!;
      const sub = 6 + i;
      // If starter is already paired, bring them back first (re-entry counts as a sub).
      const existing = L.pairings.find((p) => p.starter === starter);
      if (existing) {
        const r = sim.attemptSub(L, existing.substitute, starter);
        expect(r.ok).toBe(true);
        if (r.ok) L = r.ledger;
        continue;
      }
      const r = sim.attemptSub(L, starter, sub);
      expect(r.ok).toBe(true);
      if (r.ok) L = r.ledger;
    }
    expect(L.subsThisSet).toBe(15);
    const sixteenth = sim.attemptSub(L, 0, 99);
    expect(sixteenth.ok).toBe(false);
    if (!sixteenth.ok) expect(sixteenth.code).toBe('CAP_EXCEEDED');
  });

  it('starter re-entry is only allowed by replacing their original substitute', () => {
    let L = sim.emptyLedger(starters);
    // Sub starter 0 out for player 10.
    const r1 = sim.attemptSub(L, 0, 10);
    expect(r1.ok).toBe(true);
    if (r1.ok) L = r1.ledger;
    // Starter 0 re-entering by replacing player 11 (not their original sub) → rejected.
    const bad = sim.attemptSub(L, 11, 0);
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.code).toBe('ILLEGAL_PAIRING');
    // Starter 0 re-entering by replacing player 10 (their original sub) → allowed.
    const good = sim.attemptSub(L, 10, 0);
    expect(good.ok).toBe(true);
  });

  it('starter who never left cannot be re-entered', () => {
    const L = sim.emptyLedger(starters);
    const r = sim.attemptSub(L, 99, 0);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('ILLEGAL_PAIRING');
  });

  it('substitute cannot be paired with two different starters simultaneously', () => {
    let L = sim.emptyLedger(starters);
    const r1 = sim.attemptSub(L, 0, 10);
    expect(r1.ok).toBe(true);
    if (r1.ok) L = r1.ledger;
    const r2 = sim.attemptSub(L, 1, 10);
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.code).toBe('DUPLICATE_SUBSTITUTE');
  });

  it('resetForNewSet clears subsThisSet + pairings', () => {
    let L = sim.emptyLedger(starters);
    const r = sim.attemptSub(L, 0, 10);
    if (r.ok) L = r.ledger;
    const fresh = sim.resetForNewSet(L);
    expect(fresh.subsThisSet).toBe(0);
    expect(fresh.pairings).toEqual([]);
    expect(fresh.starters).toEqual(starters);
  });

  it('rejects self-substitution', () => {
    const r = sim.attemptSub(sim.emptyLedger(starters), 0, 0);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('ILLEGAL_PAIRING');
  });

  it('ledger is immutable — attemptSub does not mutate the input', () => {
    const L0 = sim.emptyLedger(starters);
    sim.attemptSub(L0, 0, 10);
    expect(L0.subsThisSet).toBe(0);
    expect(L0.pairings).toEqual([]);
  });
});
