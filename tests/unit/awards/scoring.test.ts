import { describe, expect, it } from 'vitest';
import { awards } from '@vcd/shared';

function baseStats(): awards.AggregatedSeasonStats {
  return {
    playerId: 'P1',
    matchesPlayed: 30,
    setsPlayed: 100,
    kills: 0,
    errors: 0,
    totalAttacks: 0,
    hittingPctMilli: 0,
    assists: 0,
    serviceAces: 0,
    serviceErrors: 0,
    receptionErrors: 0,
    digs: 0,
    blockSolos: 0,
    blockAssists: 0,
  };
}

describe('scorePlayerForAA', () => {
  it('OH score is monotone in kills', () => {
    const lo = { ...baseStats(), kills: 100 };
    const mid = { ...baseStats(), kills: 300 };
    const hi = { ...baseStats(), kills: 500 };
    expect(awards.scorePlayerForAA(lo, 'OH')).toBeLessThan(awards.scorePlayerForAA(mid, 'OH'));
    expect(awards.scorePlayerForAA(mid, 'OH')).toBeLessThan(awards.scorePlayerForAA(hi, 'OH'));
  });

  it('MB score is monotone in blocks (solos + 0.5×assists)', () => {
    const lo = { ...baseStats(), blockSolos: 10, blockAssists: 20 };
    const mid = { ...baseStats(), blockSolos: 50, blockAssists: 60 };
    const hi = { ...baseStats(), blockSolos: 100, blockAssists: 100 };
    expect(awards.scorePlayerForAA(lo, 'MB')).toBeLessThan(awards.scorePlayerForAA(mid, 'MB'));
    expect(awards.scorePlayerForAA(mid, 'MB')).toBeLessThan(awards.scorePlayerForAA(hi, 'MB'));
  });

  it('OPP score is monotone in kills (with hittingPct stable)', () => {
    const lo = { ...baseStats(), kills: 200, totalAttacks: 500, hittingPctMilli: 350 };
    const hi = { ...baseStats(), kills: 500, totalAttacks: 1000, hittingPctMilli: 350 };
    expect(awards.scorePlayerForAA(lo, 'OPP')).toBeLessThan(awards.scorePlayerForAA(hi, 'OPP'));
  });

  it('S score is monotone in assists', () => {
    const lo = { ...baseStats(), assists: 500 };
    const mid = { ...baseStats(), assists: 1000 };
    const hi = { ...baseStats(), assists: 1500 };
    expect(awards.scorePlayerForAA(lo, 'S')).toBeLessThan(awards.scorePlayerForAA(mid, 'S'));
    expect(awards.scorePlayerForAA(mid, 'S')).toBeLessThan(awards.scorePlayerForAA(hi, 'S'));
  });

  it('L score is monotone in digs (with reception errors stable)', () => {
    const lo = { ...baseStats(), digs: 200, receptionErrors: 30 };
    const mid = { ...baseStats(), digs: 400, receptionErrors: 30 };
    const hi = { ...baseStats(), digs: 700, receptionErrors: 30 };
    expect(awards.scorePlayerForAA(lo, 'L')).toBeLessThan(awards.scorePlayerForAA(mid, 'L'));
    expect(awards.scorePlayerForAA(mid, 'L')).toBeLessThan(awards.scorePlayerForAA(hi, 'L'));
  });

  it('L score: more reception errors → lower score (everything else equal)', () => {
    const clean = { ...baseStats(), digs: 400, receptionErrors: 5 };
    const messy = { ...baseStats(), digs: 400, receptionErrors: 80 };
    expect(awards.scorePlayerForAA(messy, 'L')).toBeLessThan(awards.scorePlayerForAA(clean, 'L'));
  });

  it('handles zero setsPlayed without throwing or NaN', () => {
    const zero = { ...baseStats(), setsPlayed: 0, kills: 5 };
    const score = awards.scorePlayerForAA(zero, 'OH');
    expect(Number.isFinite(score)).toBe(true);
  });

  it('deriveInputs computes per-set rates correctly', () => {
    const stats = { ...baseStats(), setsPlayed: 100, kills: 350, assists: 900, digs: 220 };
    const i = awards.deriveInputs(stats);
    expect(i.killsPerSet).toBeCloseTo(3.5, 5);
    expect(i.assistsPerSet).toBeCloseTo(9.0, 5);
    expect(i.digsPerSet).toBeCloseTo(2.2, 5);
  });
});
