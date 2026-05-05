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

// Sprint 37: legacy `computeBaseInterest` deleted. The bridge that
// remains is `computeRecruitTeamInterestScaled` — same legacy 0..1000
// magnitude, sourced from priorityModel + Sprint 28 floor penalty.
// The detailed math is covered in `priorityModel.test.ts`; these tests
// guard the ordinal contracts callers depend on.
describe('computeRecruitTeamInterestScaled', () => {
  it('scales with team prestige', () => {
    const r = mkRecruit();
    const hi = recruiting.computeRecruitTeamInterestScaled(r, mkTeam({ prestige: 90 }));
    const lo = recruiting.computeRecruitTeamInterestScaled(r, mkTeam({ prestige: 40 }));
    expect(hi).toBeGreaterThan(lo);
  });

  it('scales with coachRatingRecruit', () => {
    const r = mkRecruit();
    const hi = recruiting.computeRecruitTeamInterestScaled(
      r,
      mkTeam({ coachRatingRecruit: 85 }),
    );
    const lo = recruiting.computeRecruitTeamInterestScaled(
      r,
      mkTeam({ coachRatingRecruit: 35 }),
    );
    expect(hi).toBeGreaterThan(lo);
  });

  it('grants a region preference when recruit hometown matches team region', () => {
    const match = recruiting.computeRecruitTeamInterestScaled(
      mkRecruit({ hometownRegion: 'CENTRAL' }),
      mkTeam({ region: 'CENTRAL' }),
    );
    const noMatch = recruiting.computeRecruitTeamInterestScaled(
      mkRecruit({ hometownRegion: 'CENTRAL' }),
      mkTeam({ region: 'PACIFIC' }),
    );
    expect(match).toBeGreaterThan(noMatch);
  });

  it('low-prestige programs are penalized vs high-prestige for the same recruit', () => {
    const davidson = mkTeam({ prestige: 45, region: 'EAST', coachRatingRecruit: 55 });
    const blueBlood = mkTeam({ prestige: 90, region: 'EAST', coachRatingRecruit: 85 });
    const fiveStar = mkRecruit({ stars: 5, hometownRegion: 'EAST' });
    expect(recruiting.computeRecruitTeamInterestScaled(fiveStar, davidson)).toBeLessThan(
      recruiting.computeRecruitTeamInterestScaled(fiveStar, blueBlood),
    );
  });

  it('star floor allows 4-star interest at mid-major prestige but penalizes vs high-prestige', () => {
    const midMajor = mkTeam({ prestige: 45, region: 'EAST' });
    const blueBlood = mkTeam({ prestige: 90, region: 'EAST' });
    const fourStar = mkRecruit({ stars: 4, hometownRegion: 'EAST' });
    expect(
      recruiting.computeRecruitTeamInterestScaled(fourStar, midMajor),
    ).toBeGreaterThan(0);
    expect(
      recruiting.computeRecruitTeamInterestScaled(fourStar, midMajor),
    ).toBeLessThan(recruiting.computeRecruitTeamInterestScaled(fourStar, blueBlood));
  });

  it('low-prestige low-star is not penalized (floors only apply upward)', () => {
    const lowMajor = mkTeam({ prestige: 25 });
    const oneStar = recruiting.computeRecruitTeamInterestScaled(
      mkRecruit({ stars: 1 }),
      lowMajor,
    );
    expect(oneStar).toBeGreaterThan(0);
  });

  it('prior commits at the same position reduce interest (saturation)', () => {
    const r = mkRecruit();
    const empty = recruiting.computeRecruitTeamInterestScaled(
      r,
      mkTeam({ commitsAtPosition: 0 }),
    );
    const full = recruiting.computeRecruitTeamInterestScaled(
      r,
      mkTeam({ commitsAtPosition: 3 }),
    );
    expect(empty).toBeGreaterThan(full);
  });

  it('is deterministic', () => {
    const a = recruiting.computeRecruitTeamInterestScaled(mkRecruit(), mkTeam());
    const b = recruiting.computeRecruitTeamInterestScaled(mkRecruit(), mkTeam());
    expect(a).toBe(b);
  });

  it('returns 0..MAX_INTEREST magnitude (commit-resolution thresholds depend on this)', () => {
    const score = recruiting.computeRecruitTeamInterestScaled(
      mkRecruit({ stars: 5, hometownRegion: 'EAST' }),
      mkTeam({ prestige: 95, region: 'EAST', coachRatingRecruit: 90 }),
    );
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(recruiting.MAX_INTEREST);
  });
});

describe('applyActionDelta', () => {
  it('increases interest by the action delta', () => {
    const before = 100;
    const after = recruiting.applyActionDelta(before, 'PHONE_CALL');
    expect(after).toBe(before + recruiting.RECRUITING_ACTIONS.PHONE_CALL.delta);
  });

  it('clamps to MAX_INTEREST', () => {
    const before = 990;
    const after = recruiting.applyActionDelta(before, 'OFFER_SCHOLARSHIP');
    expect(after).toBe(recruiting.MAX_INTEREST);
  });

  it('never goes below zero', () => {
    const after = recruiting.applyActionDelta(0, 'PHONE_CALL');
    expect(after).toBeGreaterThanOrEqual(0);
  });
});

describe('computeBoardScore (Sprint 25)', () => {
  it('is deterministic for the same (team, recruit) pair', () => {
    const r = { ...mkRecruit(), recruitId: 'rec1' };
    const t = mkTeam();
    expect(recruiting.computeBoardScore(r, t)).toBe(recruiting.computeBoardScore(r, t));
  });

  it('rewards higher stars at high-prestige programs (5-star > 2-star)', () => {
    const t = mkTeam({ prestige: 90, coachRatingRecruit: 85 });
    const fiveStar = recruiting.computeBoardScore(
      { ...mkRecruit({ stars: 5 }), recruitId: 'r5' },
      t,
    );
    const twoStar = recruiting.computeBoardScore(
      { ...mkRecruit({ stars: 2 }), recruitId: 'r2' },
      t,
    );
    expect(fiveStar).toBeGreaterThan(twoStar);
  });

  it('produces different scores across teams for the same recruit (jitter)', () => {
    const r = { ...mkRecruit({ hometownRegion: 'CENTRAL' }), recruitId: 'r1' };
    const ta = mkTeam({ teamId: 'tA', region: 'PACIFIC' });
    const tb = mkTeam({ teamId: 'tB', region: 'PACIFIC' });
    const tc = mkTeam({ teamId: 'tC', region: 'PACIFIC' });
    const scores = [
      recruiting.computeBoardScore(r, ta),
      recruiting.computeBoardScore(r, tb),
      recruiting.computeBoardScore(r, tc),
    ];
    const unique = new Set(scores);
    expect(unique.size).toBeGreaterThan(1);
  });

  it('100-recruit shuffle: different teams pick distinguishable top-30 sets', () => {
    const recruits = Array.from({ length: 100 }, (_, i) => ({
      stars: ((i % 5) + 1) as 1 | 2 | 3 | 4 | 5,
      hometownRegion: 'CENTRAL',
      recruitId: `r${String(i).padStart(3, '0')}`,
    }));
    const teamA = mkTeam({ teamId: 'tA', region: 'PACIFIC' });
    const teamB = mkTeam({ teamId: 'tB', region: 'PACIFIC' });
    const scoreFor = (t: recruiting.TeamInterestInput) =>
      recruits
        .map((r) => ({ id: r.recruitId, score: recruiting.computeBoardScore(r, t) }))
        .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
        .slice(0, 30)
        .map((x) => x.id);
    const aTop = new Set(scoreFor(teamA));
    const bTop = new Set(scoreFor(teamB));
    let intersection = 0;
    for (const id of aTop) if (bTop.has(id)) intersection += 1;
    const jaccard = intersection / (aTop.size + bTop.size - intersection);
    expect(jaccard).toBeLessThan(1);
  });
});

describe('RECRUITING_ACTIONS shape', () => {
  it('every action type defined; non-scout actions have a positive delta', () => {
    for (const t of recruiting.RECRUITING_ACTION_TYPES) {
      const def = recruiting.RECRUITING_ACTIONS[t];
      expect(def.cost).toBeGreaterThan(0);
      if (def.scoutOnly) {
        expect(def.delta).toBe(0);
      } else {
        expect(def.delta).toBeGreaterThan(0);
      }
    }
  });

  it('WEEKLY_BUDGET is positive', () => {
    expect(recruiting.WEEKLY_BUDGET).toBeGreaterThan(0);
  });
});
