import { describe, it, expect } from 'vitest';
import { recruiting, createRng } from '@vcd/shared';

describe('shouldDecide', () => {
  it('returns false at week 1 even at high interest', () => {
    expect(recruiting.shouldDecide(1, 3, 800)).toBe(false);
  });

  it('returns false when maxInterest is below the floor', () => {
    expect(recruiting.shouldDecide(10, 3, 10)).toBe(false);
  });

  it('5-stars decide later than 2-stars', () => {
    expect(recruiting.shouldDecide(5, 2, 400)).toBe(true);
    expect(recruiting.shouldDecide(5, 5, 400)).toBe(false);
  });

  it('hot interest accelerates decision timing', () => {
    // 4-star normal threshold is week 7; hot threshold is week 4.
    expect(recruiting.shouldDecide(4, 4, 400)).toBe(false);
    expect(recruiting.shouldDecide(4, 4, 700)).toBe(true);
  });

  it('by week 12, any recruit with adequate interest decides', () => {
    for (const s of [1, 2, 3, 4, 5] as const) {
      expect(recruiting.shouldDecide(12, s, 300)).toBe(true);
    }
  });
});

describe('pickCommittingTeam', () => {
  it('single team always wins if above floor', () => {
    const rng = createRng('pick-1');
    const pick = recruiting.pickCommittingTeam(rng, [
      { teamId: 'A', interest: 500 },
    ]);
    expect(pick).toBe('A');
  });

  it('returns null when no team reaches the interest floor', () => {
    const rng = createRng('pick-none');
    const pick = recruiting.pickCommittingTeam(rng, [
      { teamId: 'A', interest: 10 },
      { teamId: 'B', interest: 5 },
    ]);
    expect(pick).toBeNull();
  });

  it('leader wins >70% of 10,000 seeded draws on [400, 200, 100]', () => {
    const interests: recruiting.InterestRow[] = [
      { teamId: 'A', interest: 400 },
      { teamId: 'B', interest: 200 },
      { teamId: 'C', interest: 100 },
    ];
    const counts = { A: 0, B: 0, C: 0 };
    for (let i = 0; i < 10_000; i++) {
      const rng = createRng(`pick-big:${i}`);
      const winner = recruiting.pickCommittingTeam(rng, interests)!;
      counts[winner as 'A' | 'B' | 'C'] += 1;
    }
    // With interest^5 weighting (Sprint 13 tuning), leader wins >90%.
    // Third-place still picks up occasionally but rarely.
    expect(counts.A / 10_000).toBeGreaterThan(0.7);
    expect(counts.C / 10_000).toBeGreaterThanOrEqual(0);
    expect(counts.C / 10_000).toBeLessThan(0.05);
  });

  it('only considers the top-3 (4th-ranked team never wins)', () => {
    const interests: recruiting.InterestRow[] = [
      { teamId: 'A', interest: 400 },
      { teamId: 'B', interest: 300 },
      { teamId: 'C', interest: 200 },
      { teamId: 'D', interest: 100 },
    ];
    for (let i = 0; i < 500; i++) {
      const rng = createRng(`top3:${i}`);
      const winner = recruiting.pickCommittingTeam(rng, interests)!;
      expect(winner).not.toBe('D');
    }
  });

  it('is deterministic given the same seed + inputs', () => {
    const interests: recruiting.InterestRow[] = [
      { teamId: 'A', interest: 400 },
      { teamId: 'B', interest: 200 },
      { teamId: 'C', interest: 100 },
    ];
    const a = recruiting.pickCommittingTeam(createRng('det'), interests);
    const b = recruiting.pickCommittingTeam(createRng('det'), interests);
    expect(a).toBe(b);
  });
});
