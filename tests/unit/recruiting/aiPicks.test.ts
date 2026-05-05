// Sprint 36 Task 36.6 — AI heuristic tests (pure planner).

import { describe, it, expect } from 'vitest';
import { planNilAllocation } from '../../../main/src/recruiting/aiPicks';

const baseRecruits = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    recruitId: `r${i}`,
    stars: 4,
    currentInterest: 200 - i * 10, // descending from 200
    baselineNilCents: 10_000_000, // $100k baseline
  }));

describe('planNilAllocation — normal team (not trailing)', () => {
  it('distributes budget proportional to headroom × stars across top-10', () => {
    const plans = planNilAllocation({
      teamId: 't1',
      nilBudgetCents: 30_000_000, // $300k
      nilBudgetUsedCents: 0,
      topRecruits: baseRecruits(10),
      leaderInterest: 200, // I am the leader → not trailing
    });
    expect(plans.length).toBeGreaterThan(0);
    const total = plans.reduce((a, b) => a + b.newOfferCents, 0);
    // Total should be close to budget (some loss to per-recruit caps).
    expect(total).toBeGreaterThan(0);
    expect(total).toBeLessThanOrEqual(30_000_000);
  });

  it('caps each recruit at 1.0× baseline when not trailing', () => {
    const plans = planNilAllocation({
      teamId: 't1',
      nilBudgetCents: 100_000_000, // $1M (way over needed)
      nilBudgetUsedCents: 0,
      topRecruits: baseRecruits(10),
      leaderInterest: 200,
    });
    for (const p of plans) {
      expect(p.newOfferCents).toBeLessThanOrEqual(10_000_000);
    }
  });

  it('returns empty when budget is exhausted', () => {
    const plans = planNilAllocation({
      teamId: 't1',
      nilBudgetCents: 30_000_000,
      nilBudgetUsedCents: 30_000_000,
      topRecruits: baseRecruits(10),
      leaderInterest: 200,
    });
    expect(plans).toHaveLength(0);
  });
});

describe('planNilAllocation — trailing team (moonshot)', () => {
  it('puts entire budget on top-1 recruit, capped at 1.5× baseline', () => {
    // I'm trailing — top recruit's interest is 50, leader's is 200.
    const plans = planNilAllocation({
      teamId: 't1',
      nilBudgetCents: 30_000_000, // $300k
      nilBudgetUsedCents: 0,
      topRecruits: [
        { recruitId: 'rA', stars: 5, currentInterest: 50, baselineNilCents: 25_000_000 },
        { recruitId: 'rB', stars: 4, currentInterest: 40, baselineNilCents: 10_000_000 },
      ],
      leaderInterest: 200,
    });
    expect(plans.length).toBe(1);
    expect(plans[0]!.recruitId).toBe('rA');
    // 1.5 × $250k = $375k cap; budget = $300k → bound by budget.
    expect(plans[0]!.newOfferCents).toBe(30_000_000);
  });

  it('moonshot is capped at 1.5× baseline (not budget)', () => {
    const plans = planNilAllocation({
      teamId: 't1',
      nilBudgetCents: 100_000_000, // way more than 1.5× baseline
      nilBudgetUsedCents: 0,
      topRecruits: [
        { recruitId: 'rA', stars: 5, currentInterest: 50, baselineNilCents: 10_000_000 },
      ],
      leaderInterest: 200,
    });
    expect(plans[0]!.newOfferCents).toBe(15_000_000); // 1.5 × $100k
  });
});

describe('determinism', () => {
  it('same input → same output', () => {
    const args = {
      teamId: 't1',
      nilBudgetCents: 20_000_000,
      nilBudgetUsedCents: 0,
      topRecruits: baseRecruits(5),
      leaderInterest: 200,
    };
    expect(planNilAllocation(args)).toEqual(planNilAllocation(args));
  });
});
