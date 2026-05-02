import { describe, it, expect } from 'vitest';
import { nil } from '@vcd/shared';

const mk = (over: Partial<nil.ValuationPlayer> = {}): nil.ValuationPlayer => ({
  overall: 70,
  potential: 80,
  position: 'OH',
  classYear: 'JR',
  ...over,
});

describe('computePlayerValue', () => {
  it('higher overall → higher value', () => {
    const hi = nil.computePlayerValue(mk({ overall: 90 }));
    const lo = nil.computePlayerValue(mk({ overall: 60 }));
    expect(hi).toBeGreaterThan(lo);
  });

  it('higher potential → higher value (all else equal)', () => {
    const hi = nil.computePlayerValue(mk({ potential: 95 }));
    const lo = nil.computePlayerValue(mk({ potential: 60 }));
    expect(hi).toBeGreaterThan(lo);
  });

  it('position scarcity: MB + OPP > OH at equal overall', () => {
    const mb = nil.computePlayerValue(mk({ position: 'MB' }));
    const oh = nil.computePlayerValue(mk({ position: 'OH' }));
    const opp = nil.computePlayerValue(mk({ position: 'OPP' }));
    expect(mb).toBeGreaterThan(oh);
    expect(opp).toBeGreaterThan(oh);
  });

  it('class year: JR > SO > FR, and SR < JR', () => {
    const jr = nil.computePlayerValue(mk({ classYear: 'JR' }));
    const so = nil.computePlayerValue(mk({ classYear: 'SO' }));
    const fr = nil.computePlayerValue(mk({ classYear: 'FR' }));
    const sr = nil.computePlayerValue(mk({ classYear: 'SR' }));
    expect(jr).toBeGreaterThan(so);
    expect(so).toBeGreaterThan(fr);
    expect(jr).toBeGreaterThan(sr);
  });

  it('non-negative (floor at BASE_CENTS)', () => {
    const low = nil.computePlayerValue(mk({ overall: 30, potential: 30 }));
    expect(low).toBeGreaterThanOrEqual(nil.BASE_CENTS);
  });

  it('deterministic', () => {
    const a = nil.computePlayerValue(mk());
    const b = nil.computePlayerValue(mk());
    expect(a).toBe(b);
  });
});
