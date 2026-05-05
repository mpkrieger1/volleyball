// Sprint 36 Task 36.3 — NIL conversion helper.

import { describe, it, expect } from 'vitest';
import { recruiting } from '@vcd/shared';

describe('getNilOfferBaselineCents', () => {
  it.each([
    [5, 25_000_000],
    [4, 10_000_000],
    [3, 4_000_000],
    [2, 1_500_000],
    [1, 500_000],
  ])('stars=%i → baseline %i cents', (stars, expected) => {
    expect(
      recruiting.getNilOfferBaselineCents({ stars: stars as 1 | 2 | 3 | 4 | 5 }),
    ).toBe(expected);
  });
});

describe('convertNilOfferToPoints', () => {
  const basePriorities = (nilDeal: number) => ({
    playingTime: 5,
    proximityToHome: 5,
    prestige: 5,
    facilities: 5,
    nilDeal,
  });

  it('5★ recruit, nilDeal=8, $250k offer → cap at MAX_NIL_POINTS=200', () => {
    const pts = recruiting.convertNilOfferToPoints({
      offerCents: 25_000_000,
      recruit: { stars: 5 },
      priorities: basePriorities(8),
    });
    expect(pts).toBe(200);
  });

  it('5★ recruit, nilDeal=2, $250k offer → 75 × 2 × 1.0 = 150', () => {
    const pts = recruiting.convertNilOfferToPoints({
      offerCents: 25_000_000,
      recruit: { stars: 5 },
      priorities: basePriorities(2),
    });
    expect(pts).toBe(150);
  });

  it('5★ recruit, nilDeal=8, $125k offer → 75 × 8 × 0.5 = 300 → cap at 200', () => {
    const pts = recruiting.convertNilOfferToPoints({
      offerCents: 12_500_000,
      recruit: { stars: 5 },
      priorities: basePriorities(8),
    });
    expect(pts).toBe(200);
  });

  it('5★ recruit, nilDeal=4, $125k offer → 75 × 4 × 0.5 = 150', () => {
    const pts = recruiting.convertNilOfferToPoints({
      offerCents: 12_500_000,
      recruit: { stars: 5 },
      priorities: basePriorities(4),
    });
    expect(pts).toBe(150);
  });

  it('$0 offer → 0 points regardless of priority', () => {
    expect(
      recruiting.convertNilOfferToPoints({
        offerCents: 0,
        recruit: { stars: 5 },
        priorities: basePriorities(10),
      }),
    ).toBe(0);
  });

  it('nilDeal=0 priority → priorityWeight clamps to 1; 75 × 1 × 1 = 75', () => {
    expect(
      recruiting.convertNilOfferToPoints({
        offerCents: 25_000_000,
        recruit: { stars: 5 },
        priorities: basePriorities(0),
      }),
    ).toBe(75);
  });

  it('result is always integer + non-negative', () => {
    const pts = recruiting.convertNilOfferToPoints({
      offerCents: 7_500_000,
      recruit: { stars: 4 },
      priorities: basePriorities(3),
    });
    expect(Number.isInteger(pts)).toBe(true);
    expect(pts).toBeGreaterThanOrEqual(0);
  });
});

describe('MAX_NIL_POINTS constant', () => {
  it('is 200', () => {
    expect(recruiting.MAX_NIL_POINTS).toBe(200);
  });
});
