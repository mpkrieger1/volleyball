import { describe, it, expect } from 'vitest';
import { tournament } from '@vcd/shared';

const mkStandings = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ teamId: `T${i + 1}`, rank: i + 1 }));

describe('buildConfFirstRoundPairings', () => {
  it('8-team conference → 4 R1 pairings in standard bracket order', () => {
    const p = tournament.buildConfFirstRoundPairings('C1', mkStandings(8));
    expect(p).toHaveLength(4);
    expect(p.every((m) => m.round === 'CT_R1')).toBe(true);
    expect(p.map((m) => `${m.higherSeed}v${m.lowerSeed}`)).toEqual([
      '1v8',
      '4v5',
      '3v6',
      '2v7',
    ]);
    expect(p.map((m) => m.bracketSlot)).toEqual([0, 1, 2, 3]);
  });

  it('4-to-7 team conference → 2 CT_SF pairings using top 4 seeds', () => {
    for (const n of [4, 5, 6, 7]) {
      const p = tournament.buildConfFirstRoundPairings('C1', mkStandings(n));
      expect(p).toHaveLength(2);
      expect(p.every((m) => m.round === 'CT_SF')).toBe(true);
      expect(p.map((m) => `${m.higherSeed}v${m.lowerSeed}`)).toEqual(['1v4', '2v3']);
    }
  });

  it('2-to-3 team conference → single CT_F pairing', () => {
    for (const n of [2, 3]) {
      const p = tournament.buildConfFirstRoundPairings('C1', mkStandings(n));
      expect(p).toHaveLength(1);
      expect(p[0]!.round).toBe('CT_F');
      expect(p[0]!.higherSeed).toBe(1);
      expect(p[0]!.lowerSeed).toBe(2);
    }
  });

  it('empty / 1-team conference → no pairings', () => {
    expect(tournament.buildConfFirstRoundPairings('C1', [])).toEqual([]);
    expect(tournament.buildConfFirstRoundPairings('C1', mkStandings(1))).toEqual([]);
  });

  it('deterministic across runs', () => {
    const a = tournament.buildConfFirstRoundPairings('C1', mkStandings(8));
    const b = tournament.buildConfFirstRoundPairings('C1', mkStandings(8));
    expect(a).toEqual(b);
  });
});
