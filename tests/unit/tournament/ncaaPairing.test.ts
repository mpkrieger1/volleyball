import { describe, it, expect } from 'vitest';
import { tournament, bracket } from '@vcd/shared';

function mkSeedMap() {
  const m = new Map<bracket.BracketRegion, Map<number, string>>();
  for (const r of bracket.REGIONS) {
    const inner = new Map<number, string>();
    for (let s = 1; s <= 16; s++) inner.set(s, `${r}:${s}`);
    m.set(r, inner);
  }
  return m;
}

describe('buildNcaaR64Pairings', () => {
  it('produces 32 pairings (8 per region × 4 regions)', () => {
    const pairings = tournament.buildNcaaR64Pairings(mkSeedMap());
    expect(pairings).toHaveLength(32);
    const byRegion = new Map<string, number>();
    for (const p of pairings) byRegion.set(p.region, (byRegion.get(p.region) ?? 0) + 1);
    for (const [, n] of byRegion) expect(n).toBe(8);
  });

  it('uses standard bracket seed pairings (1v16, 8v9, 5v12, 4v13, 6v11, 3v14, 7v10, 2v15)', () => {
    const pairings = tournament.buildNcaaR64Pairings(mkSeedMap());
    const r1 = pairings.filter((p) => p.region === 'REGION_1').sort((a, b) => a.bracketSlot - b.bracketSlot);
    expect(r1.map((p) => `${p.higherSeed}v${p.lowerSeed}`)).toEqual([
      '1v16',
      '8v9',
      '5v12',
      '4v13',
      '6v11',
      '3v14',
      '7v10',
      '2v15',
    ]);
  });

  it('FF_REGION_PAIRS is REGION_1/2 then REGION_3/4', () => {
    expect(tournament.FF_REGION_PAIRS).toEqual([
      ['REGION_1', 'REGION_2'],
      ['REGION_3', 'REGION_4'],
    ]);
  });
});
