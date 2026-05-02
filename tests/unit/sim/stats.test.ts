import { describe, expect, it } from 'vitest';
import { sim } from '@vcd/shared';

describe('stats helpers', () => {
  it('stdNormCdf matches known values', () => {
    expect(sim.stdNormCdf(0)).toBeCloseTo(0.5, 4);
    expect(sim.stdNormCdf(1.96)).toBeCloseTo(0.975, 3);
    expect(sim.stdNormCdf(-1.96)).toBeCloseTo(0.025, 3);
    expect(sim.stdNormCdf(2.58)).toBeCloseTo(0.995, 3);
  });

  it('twoProportionZ returns 0 when samples are identical', () => {
    const r = sim.twoProportionZ(50, 100, 50, 100);
    expect(r.z).toBe(0);
    expect(r.pTwoSided).toBeCloseTo(1, 4);
  });

  it('twoProportionZ produces a large negative z when p1 << p2', () => {
    // 20/100 vs 40/100 — classic textbook result z ≈ -3.06
    const r = sim.twoProportionZ(20, 100, 40, 100);
    expect(r.z).toBeLessThan(-3);
    expect(r.pTwoSided).toBeLessThan(0.01);
  });

  it('twoProportionZ is symmetric in sign when arguments flip', () => {
    const a = sim.twoProportionZ(30, 100, 50, 100);
    const b = sim.twoProportionZ(50, 100, 30, 100);
    expect(a.z).toBeCloseTo(-b.z, 6);
    expect(a.pTwoSided).toBeCloseTo(b.pTwoSided, 6);
  });
});
