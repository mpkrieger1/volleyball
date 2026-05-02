import { describe, it, expect } from 'vitest';
import { bracket } from '@vcd/shared';

function mkSelected(n: number): bracket.SelectedTeam[] {
  return Array.from({ length: n }, (_, i) => ({
    teamId: `T${i + 1}`,
    autoBid: i < 32,
    metricRank: i + 1,
    conferenceId: `C${i % 32}`,
  }));
}

describe('seedBracket', () => {
  it('produces 64 entries across 4 regions × 16 seeds', () => {
    const out = bracket.seedBracket(mkSelected(64));
    expect(out.length).toBe(64);
    const byRegion = new Map<string, number>();
    for (const e of out) byRegion.set(e.region, (byRegion.get(e.region) ?? 0) + 1);
    for (const [, n] of byRegion) expect(n).toBe(16);
    expect(byRegion.size).toBe(4);
  });

  it('assigns S-curve seed placement (line 1 across regions, then reverse)', () => {
    const out = bracket.seedBracket(mkSelected(64));
    const line1 = out.filter((e) => e.seed === 1).sort((a, b) => a.region.localeCompare(b.region));
    expect(line1.map((e) => e.teamId)).toEqual(['T1', 'T2', 'T3', 'T4']);
    // Line 2 reverses region order: team 5 goes to REGION_4, team 8 to REGION_1.
    const line2ByTeam = new Map(out.filter((e) => e.seed === 2).map((e) => [e.teamId, e.region]));
    expect(line2ByTeam.get('T5')).toBe('REGION_4');
    expect(line2ByTeam.get('T8')).toBe('REGION_1');
  });

  it('no team is more than 2 lines off its metric rank', () => {
    const out = bracket.seedBracket(mkSelected(64));
    for (const e of out) {
      // metricRank 1..4 → line 1; 5..8 → line 2; etc.
      const expectedLine = Math.floor((e.metricRank - 1) / 4) + 1;
      expect(Math.abs(e.seed - expectedLine)).toBeLessThanOrEqual(2);
    }
  });

  it('throws if the field size is wrong', () => {
    expect(() => bracket.seedBracket(mkSelected(32))).toThrow();
  });
});
