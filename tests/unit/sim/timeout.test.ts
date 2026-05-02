import { describe, expect, it } from 'vitest';
import { sim } from '@vcd/shared';

describe('timeout ledger', () => {
  it('starts with 2 timeouts per set', () => {
    expect(sim.emptyTimeoutLedger().remaining).toBe(2);
  });

  it('accepts up to 2 timeouts; 3rd rejected with NO_TIMEOUTS_LEFT', () => {
    let L = sim.emptyTimeoutLedger();
    const r1 = sim.attemptTimeout(L, 5);
    expect(r1.ok).toBe(true);
    if (r1.ok) L = r1.ledger;
    const r2 = sim.attemptTimeout(L, 11);
    expect(r2.ok).toBe(true);
    if (r2.ok) L = r2.ledger;
    expect(L.remaining).toBe(0);
    const r3 = sim.attemptTimeout(L, 17);
    expect(r3.ok).toBe(false);
    if (!r3.ok) expect(r3.code).toBe('NO_TIMEOUTS_LEFT');
  });

  it('records rally index of each timeout', () => {
    let L = sim.emptyTimeoutLedger();
    const r1 = sim.attemptTimeout(L, 7);
    if (r1.ok) L = r1.ledger;
    const r2 = sim.attemptTimeout(L, 13);
    if (r2.ok) L = r2.ledger;
    expect(L.timeoutsCalled.map((t) => t.atRallyIdx)).toEqual([7, 13]);
  });

  it('reset restores to 2 regardless of prior state', () => {
    let L = sim.emptyTimeoutLedger();
    const r = sim.attemptTimeout(L, 1);
    if (r.ok) L = r.ledger;
    expect(sim.resetTimeoutLedger(L).remaining).toBe(2);
  });
});
