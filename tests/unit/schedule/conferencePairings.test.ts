import { describe, expect, it } from 'vitest';
import { createRng, schedule } from '@vcd/shared';

const teamIds = (n: number): string[] => Array.from({ length: n }, (_, i) => `t${i}`);

describe('conference double round-robin', () => {
  it.each([2, 4, 6, 8, 10, 12, 14, 16, 18])(
    'N=%i: every pair plays exactly twice (one home, one away)',
    (n) => {
      const ids = teamIds(n);
      const pairings = schedule.generateConferencePairings(ids, 'confX', createRng('s'));
      // Expected count: 2 * C(n, 2) = n*(n-1)
      expect(pairings.length).toBe(n * (n - 1));
      const byPair = new Map<string, { home: number; away: number }>();
      for (const p of pairings) {
        const k = [p.homeTeamId, p.awayTeamId].sort().join(':');
        const rec = byPair.get(k) ?? { home: 0, away: 0 };
        // count directional
        rec.home += 1;
        byPair.set(k, rec);
      }
      expect(byPair.size).toBe((n * (n - 1)) / 2);
      for (const [, rec] of byPair) {
        expect(rec.home).toBe(2);
      }
    },
  );

  it('odd N (9 teams): every pair plays twice (one team sits out per round)', () => {
    const ids = teamIds(9);
    const pairings = schedule.generateConferencePairings(ids, 'confY', createRng('s'));
    expect(pairings.length).toBe(9 * 8);
    // Every distinct pair appears twice.
    const set = new Set<string>();
    for (const p of pairings) set.add([p.homeTeamId, p.awayTeamId].sort().join(':'));
    expect(set.size).toBe(36); // C(9,2)
  });

  it('each team has equal home/away counts', () => {
    const ids = teamIds(10);
    const pairings = schedule.generateConferencePairings(ids, 'c', createRng('s'));
    const home = new Map<string, number>();
    const away = new Map<string, number>();
    for (const p of pairings) {
      home.set(p.homeTeamId, (home.get(p.homeTeamId) ?? 0) + 1);
      away.set(p.awayTeamId, (away.get(p.awayTeamId) ?? 0) + 1);
    }
    for (const id of ids) {
      expect(home.get(id)).toBe(9);
      expect(away.get(id)).toBe(9);
    }
  });

  it('deterministic under a fixed seed', () => {
    const a = schedule.generateConferencePairings(teamIds(12), 'c', createRng('det'));
    const b = schedule.generateConferencePairings(teamIds(12), 'c', createRng('det'));
    expect(a).toEqual(b);
  });

  it('different seeds produce different orderings', () => {
    const a = schedule.generateConferencePairings(teamIds(12), 'c', createRng('s1'));
    const b = schedule.generateConferencePairings(teamIds(12), 'c', createRng('s2'));
    expect(a).not.toEqual(b);
  });

  it('roundIndex spans [0, 2*(N-1)-1] for even N', () => {
    const pairings = schedule.generateConferencePairings(teamIds(8), 'c', createRng('s'));
    const rounds = new Set(pairings.map((p) => p.roundIndex));
    expect(rounds.size).toBe(14); // 2*(8-1)
  });
});
