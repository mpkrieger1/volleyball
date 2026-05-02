import { describe, it, expect } from 'vitest';
import { portal } from '@vcd/shared';

describe('computePortalBaseInterest', () => {
  it('scales with team prestige', () => {
    const hi = portal.computePortalBaseInterest(
      { overall: 70 },
      { teamId: 't1', prestige: 90, coachRatingRecruit: 70 },
    );
    const lo = portal.computePortalBaseInterest(
      { overall: 70 },
      { teamId: 't2', prestige: 40, coachRatingRecruit: 70 },
    );
    expect(hi).toBeGreaterThan(lo);
  });

  it('scales with coach recruit rating', () => {
    const hi = portal.computePortalBaseInterest(
      { overall: 70 },
      { teamId: 't1', prestige: 60, coachRatingRecruit: 90 },
    );
    const lo = portal.computePortalBaseInterest(
      { overall: 70 },
      { teamId: 't2', prestige: 60, coachRatingRecruit: 40 },
    );
    expect(hi).toBeGreaterThan(lo);
  });

  it('higher-rated targets draw higher base interest everywhere', () => {
    const elite = portal.computePortalBaseInterest(
      { overall: 90 },
      { teamId: 't', prestige: 70, coachRatingRecruit: 70 },
    );
    const avg = portal.computePortalBaseInterest(
      { overall: 60 },
      { teamId: 't', prestige: 70, coachRatingRecruit: 70 },
    );
    expect(elite).toBeGreaterThan(avg);
  });
});

describe('applyNilBump', () => {
  it('$20k offer adds ≥ 200 interest', () => {
    const next = portal.applyNilBump(100, 20_000_00);
    expect(next - 100).toBeGreaterThanOrEqual(200);
  });

  it('$10k offer adds ≥ 100 interest', () => {
    const next = portal.applyNilBump(100, 10_000_00);
    expect(next - 100).toBeGreaterThanOrEqual(100);
  });

  it('caps at +300 regardless of offer amount', () => {
    const next = portal.applyNilBump(100, 500_000_00);
    expect(next - 100).toBeLessThanOrEqual(300);
  });

  it('clamps to MAX_INTEREST', () => {
    const next = portal.applyNilBump(950, 50_000_00);
    expect(next).toBeLessThanOrEqual(1000);
  });
});

describe('PORTAL_ACTIONS + budget', () => {
  it('PORTAL_WEEKLY_BUDGET is positive', () => {
    expect(portal.PORTAL_WEEKLY_BUDGET).toBeGreaterThan(0);
  });

  it('all 4 non-NIL action types are defined with positive cost/delta', () => {
    for (const a of ['CALL', 'UNOFFICIAL_VISIT', 'HOME_VISIT', 'OFFICIAL_VISIT'] as const) {
      expect(portal.PORTAL_ACTIONS[a].cost).toBeGreaterThan(0);
      expect(portal.PORTAL_ACTIONS[a].delta).toBeGreaterThan(0);
    }
  });
});
