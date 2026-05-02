import { describe, it, expect } from 'vitest';
import { offseason } from '@vcd/shared';

const mk = (id: string, overall: number) => ({ id, overall });

describe('enforceScholarshipCap', () => {
  it('roster of 15 → no cuts', () => {
    const roster = Array.from({ length: 15 }, (_, i) => mk(`p${i}`, 50 + i));
    const r = offseason.enforceScholarshipCap(roster);
    expect(r.cut).toHaveLength(0);
    expect(r.kept).toHaveLength(15);
  });

  it('roster of 16 → 1 cut (lowest overall)', () => {
    const roster = [
      mk('weakest', 40),
      ...Array.from({ length: 15 }, (_, i) => mk(`p${i}`, 70 + i)),
    ];
    const r = offseason.enforceScholarshipCap(roster);
    expect(r.cut).toHaveLength(1);
    expect(r.cut[0]!.id).toBe('weakest');
    expect(r.kept).toHaveLength(15);
  });

  it('roster of 20 → 5 cuts, all from the lowest tail', () => {
    const roster = Array.from({ length: 20 }, (_, i) => mk(`p${i}`, i * 5));
    const r = offseason.enforceScholarshipCap(roster);
    expect(r.cut).toHaveLength(5);
    expect(r.kept).toHaveLength(15);
    for (const c of r.cut) {
      expect(c.overall).toBeLessThan(Math.min(...r.kept.map((k) => k.overall)) + 1);
    }
  });

  it('ties broken by playerId.localeCompare', () => {
    const roster = [
      mk('a-1', 60), mk('b-2', 60), mk('c-3', 60), mk('d-4', 60),
      ...Array.from({ length: 13 }, (_, i) => mk(`z${i}`, 80 + i)),
    ];
    const r = offseason.enforceScholarshipCap(roster);
    expect(r.cut).toHaveLength(2);
    const cutIds = r.cut.map((p) => p.id).sort();
    // The 2 cut must be the 2 last alphabetically among the 60s.
    expect(cutIds).toEqual(['c-3', 'd-4']);
  });

  it('scale — 360 teams × 20 players each', () => {
    for (let t = 0; t < 360; t++) {
      const roster = Array.from({ length: 20 }, (_, i) => mk(`t${t}-p${i}`, 50 + (i % 40)));
      const r = offseason.enforceScholarshipCap(roster);
      expect(r.kept).toHaveLength(15);
      expect(r.cut).toHaveLength(5);
    }
  });

  it('SCHOLARSHIP_CAP exported as 15', () => {
    expect(offseason.SCHOLARSHIP_CAP).toBe(15);
  });
});
