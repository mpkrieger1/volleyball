import { describe, it, expect } from 'vitest';
import { recruiting } from '@vcd/shared';

const mkRecruit = (
  over: Partial<recruiting.RecruitInterestInput> = {},
): recruiting.RecruitInterestInput => ({
  stars: 3,
  hometownRegion: 'CENTRAL',
  ...over,
});

const mkTeam = (
  over: Partial<recruiting.TeamInterestInput> = {},
): recruiting.TeamInterestInput => ({
  teamId: 't1',
  prestige: 55,
  region: 'CENTRAL',
  coachRatingRecruit: 55,
  commitsAtPosition: 0,
  ...over,
});

describe('computeBaseInterest', () => {
  it('scales with team prestige', () => {
    const r = mkRecruit();
    const hi = recruiting.computeBaseInterest(r, mkTeam({ prestige: 90 }));
    const lo = recruiting.computeBaseInterest(r, mkTeam({ prestige: 40 }));
    expect(hi).toBeGreaterThan(lo);
  });

  it('scales with coachRatingRecruit', () => {
    const r = mkRecruit();
    const hi = recruiting.computeBaseInterest(r, mkTeam({ coachRatingRecruit: 85 }));
    const lo = recruiting.computeBaseInterest(r, mkTeam({ coachRatingRecruit: 35 }));
    expect(hi).toBeGreaterThan(lo);
  });

  it('grants region bonus when recruit hometown matches team region', () => {
    const match = recruiting.computeBaseInterest(
      mkRecruit({ hometownRegion: 'CENTRAL' }),
      mkTeam({ region: 'CENTRAL' }),
    );
    const noMatch = recruiting.computeBaseInterest(
      mkRecruit({ hometownRegion: 'CENTRAL' }),
      mkTeam({ region: 'PACIFIC' }),
    );
    expect(match - noMatch).toBe(recruiting.REGION_BONUS);
  });

  it('star difficulty is currently disabled — same-team base does not drop for higher stars', () => {
    // Sprint 13 decision: "pickiness" is modeled in shouldDecide, not in
    // base interest. Keep this test to lock the current behavior.
    const t = mkTeam();
    const fiveStar = recruiting.computeBaseInterest(mkRecruit({ stars: 5 }), t);
    const twoStar = recruiting.computeBaseInterest(mkRecruit({ stars: 2 }), t);
    expect(fiveStar).toBe(twoStar);
  });

  it('prior commits at the same position reduce interest (saturation)', () => {
    const r = mkRecruit();
    const empty = recruiting.computeBaseInterest(r, mkTeam({ commitsAtPosition: 0 }));
    const full = recruiting.computeBaseInterest(r, mkTeam({ commitsAtPosition: 3 }));
    expect(empty).toBeGreaterThan(full);
  });

  it('is deterministic', () => {
    const a = recruiting.computeBaseInterest(mkRecruit(), mkTeam());
    const b = recruiting.computeBaseInterest(mkRecruit(), mkTeam());
    expect(a).toBe(b);
  });
});

describe('applyActionDelta', () => {
  it('increases interest by the action delta', () => {
    const before = 100;
    const after = recruiting.applyActionDelta(before, 'CALL');
    expect(after).toBe(before + recruiting.RECRUITING_ACTIONS.CALL.delta);
  });

  it('clamps to MAX_INTEREST', () => {
    const before = 990;
    const after = recruiting.applyActionDelta(before, 'OFFICIAL_VISIT');
    expect(after).toBe(recruiting.MAX_INTEREST);
  });

  it('never goes below zero', () => {
    const after = recruiting.applyActionDelta(0, 'CALL');
    expect(after).toBeGreaterThanOrEqual(0);
  });
});

describe('RECRUITING_ACTIONS shape', () => {
  it('all 4 action types defined', () => {
    for (const t of recruiting.RECRUITING_ACTION_TYPES) {
      const def = recruiting.RECRUITING_ACTIONS[t];
      expect(def.cost).toBeGreaterThan(0);
      expect(def.delta).toBeGreaterThan(0);
    }
  });

  it('WEEKLY_BUDGET is positive', () => {
    expect(recruiting.WEEKLY_BUDGET).toBeGreaterThan(0);
  });
});
