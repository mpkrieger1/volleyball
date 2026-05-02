import { describe, it, expect } from 'vitest';
import { bracket } from '@vcd/shared';

const mk = (home: string, away: string, winner: string, neutral = false): bracket.BracketMatch => ({
  homeTeamId: home,
  awayTeamId: away,
  winnerId: winner,
  isNeutralSite: neutral,
});

describe('computeRPI', () => {
  it('ranks a 4-team round-robin in the expected order', () => {
    const matches: bracket.BracketMatch[] = [
      mk('A', 'B', 'A'),
      mk('A', 'C', 'A'),
      mk('A', 'D', 'A'),
      mk('B', 'C', 'B'),
      mk('B', 'D', 'B'),
      mk('C', 'D', 'C'),
    ];
    const out = bracket.computeRPI(matches, ['A', 'B', 'C', 'D']);
    expect(out.size).toBe(4);
    const ranked = bracket.rankByRPI(out);
    expect(ranked[0]).toBe('A');
    expect(ranked[3]).toBe('D');
  });

  it('road wins are weighted heavier than home wins (given identical unweighted record)', () => {
    // X: 1 road win + 1 road loss.  Y: 1 home win + 1 home loss. Both 1-1.
    // X weighted WP = 1.4/(1.4+0.6) = 0.70 ;  Y = 0.6/(0.6+1.4) = 0.30.
    const matches: bracket.BracketMatch[] = [
      mk('A', 'X', 'X'), // X road win
      mk('B', 'X', 'B'), // X road loss
      mk('Y', 'A', 'Y'), // Y home win
      mk('Y', 'B', 'B'), // Y home loss
    ];
    const out = bracket.computeRPI(matches, ['X', 'Y', 'A', 'B']);
    expect(out.get('X')!.rpi).toBeGreaterThan(out.get('Y')!.rpi);
  });

  it('is deterministic across runs', () => {
    const matches: bracket.BracketMatch[] = [
      mk('A', 'B', 'A'), mk('B', 'C', 'B'), mk('C', 'A', 'A'),
    ];
    const a = bracket.computeRPI(matches, ['A', 'B', 'C']);
    const b = bracket.computeRPI(matches, ['A', 'B', 'C']);
    expect([...a.entries()]).toEqual([...b.entries()]);
  });

  it('produces integer RPI in [0, 1000]', () => {
    const matches: bracket.BracketMatch[] = [mk('A', 'B', 'A')];
    const out = bracket.computeRPI(matches, ['A', 'B']);
    for (const r of out.values()) {
      expect(r.rpi).toBeGreaterThanOrEqual(0);
      expect(r.rpi).toBeLessThanOrEqual(1000);
      expect(Number.isInteger(r.rpi)).toBe(true);
    }
  });

  it('records a Q1 win for a road win over a high-ranked opponent', () => {
    // B wins on the road at A (a team ranked well within the Q1 road-bound of 75).
    const matches: bracket.BracketMatch[] = [
      mk('A', 'C', 'A'),
      mk('A', 'D', 'A'),
      mk('A', 'E', 'A'),
      mk('A', 'B', 'B'),
      mk('B', 'C', 'B'),
      mk('B', 'D', 'B'),
    ];
    const out = bracket.computeRPI(matches, ['A', 'B', 'C', 'D', 'E']);
    expect(out.get('B')!.q1Wins).toBeGreaterThanOrEqual(1);
  });
});
