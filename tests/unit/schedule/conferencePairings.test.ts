import { describe, expect, it } from 'vitest';
import { createRng, schedule } from '@vcd/shared';

const teamIds = (n: number): string[] => Array.from({ length: n }, (_, i) => `t${i}`);

// Sprint 28: capped at MAX_CONF_ROUNDS_PER_TEAM (=9) rounds before mirroring.
// For N ≤ 10, we still produce a full double round-robin (every pair plays
// exactly twice). For N > 10, each team plays 9 distinct opponents × 2 = 18
// games; some pairs do not play.

describe('conference pairings — full double round-robin (confSize ≤10, even)', () => {
  it.each([2, 4, 6, 8, 10])(
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
    const set = new Set<string>();
    for (const p of pairings) set.add([p.homeTeamId, p.awayTeamId].sort().join(':'));
    expect(set.size).toBe(36); // C(9,2)
  });
});

describe('conference pairings — capped at 9 rounds (confSize >10)', () => {
  it.each([12, 14, 16, 18])(
    'N=%i (even): every team plays exactly 18 games (9 distinct opponents × 2)',
    (n) => {
      const ids = teamIds(n);
      const pairings = schedule.generateConferencePairings(ids, 'confX', createRng('s'));
      const gamesPerTeam = new Map<string, number>();
      for (const p of pairings) {
        gamesPerTeam.set(p.homeTeamId, (gamesPerTeam.get(p.homeTeamId) ?? 0) + 1);
        gamesPerTeam.set(p.awayTeamId, (gamesPerTeam.get(p.awayTeamId) ?? 0) + 1);
      }
      for (const id of ids) {
        expect(gamesPerTeam.get(id), `team ${id}`).toBe(18);
      }
      // Total = 18 * n / 2 (each game counted by 2 teams).
      expect(pairings.length).toBe(9 * n);
    },
  );

  it.each([11, 13, 15, 17])(
    'N=%i (odd): every team plays at most 18 games and at least 16 (bye-rotation asymmetry)',
    (n) => {
      const ids = teamIds(n);
      const pairings = schedule.generateConferencePairings(ids, 'confX', createRng('s'));
      const gamesPerTeam = new Map<string, number>();
      for (const p of pairings) {
        gamesPerTeam.set(p.homeTeamId, (gamesPerTeam.get(p.homeTeamId) ?? 0) + 1);
        gamesPerTeam.set(p.awayTeamId, (gamesPerTeam.get(p.awayTeamId) ?? 0) + 1);
      }
      for (const id of ids) {
        const g = gamesPerTeam.get(id) ?? 0;
        expect(g, `team ${id}: ${g} games`).toBeGreaterThanOrEqual(16);
        expect(g, `team ${id}: ${g} games`).toBeLessThanOrEqual(18);
      }
    },
  );

  it('every pair that plays at all plays an even number of times (mirror invariant)', () => {
    const pairings = schedule.generateConferencePairings(teamIds(14), 'c', createRng('s'));
    const byPair = new Map<string, number>();
    for (const p of pairings) {
      const k = [p.homeTeamId, p.awayTeamId].sort().join(':');
      byPair.set(k, (byPair.get(k) ?? 0) + 1);
    }
    for (const [, n] of byPair) {
      expect(n % 2).toBe(0);
    }
  });
});

describe('conference pairings — invariants across all sizes', () => {
  it('each team has equal home/away counts (within 1 for odd-bye asymmetry)', () => {
    const ids = teamIds(10);
    const pairings = schedule.generateConferencePairings(ids, 'c', createRng('s'));
    const home = new Map<string, number>();
    const away = new Map<string, number>();
    for (const p of pairings) {
      home.set(p.homeTeamId, (home.get(p.homeTeamId) ?? 0) + 1);
      away.set(p.awayTeamId, (away.get(p.awayTeamId) ?? 0) + 1);
    }
    for (const id of ids) {
      const h = home.get(id) ?? 0;
      const a = away.get(id) ?? 0;
      expect(Math.abs(h - a)).toBeLessThanOrEqual(1);
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

  it('roundIndex spans [0, 2*rounds-1] where rounds = min(N-1, 9)', () => {
    // N=8: rounds = 7, expect 14 round indices.
    const small = schedule.generateConferencePairings(teamIds(8), 'c', createRng('s'));
    expect(new Set(small.map((p) => p.roundIndex)).size).toBe(14);
    // N=14: rounds capped at 9, expect 18 round indices.
    const big = schedule.generateConferencePairings(teamIds(14), 'c', createRng('s'));
    expect(new Set(big.map((p) => p.roundIndex)).size).toBe(18);
  });
});
