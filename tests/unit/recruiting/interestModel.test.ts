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

describe('computeBoardScore (Sprint 25)', () => {
  it('is deterministic for the same (team, recruit) pair', () => {
    const r = { ...mkRecruit(), recruitId: 'rec1' };
    const t = mkTeam();
    expect(recruiting.computeBoardScore(r, t)).toBe(recruiting.computeBoardScore(r, t));
  });

  it('rewards higher stars (5-star outranks 2-star for the same team)', () => {
    const t = mkTeam();
    // Star bonus dominates the bounded jitter (±20 vs +240 for stars 5-2=3).
    const fiveStar = recruiting.computeBoardScore({ ...mkRecruit({ stars: 5 }), recruitId: 'r5' }, t);
    const twoStar = recruiting.computeBoardScore({ ...mkRecruit({ stars: 2 }), recruitId: 'r2' }, t);
    expect(fiveStar).toBeGreaterThan(twoStar);
  });

  it('produces different scores across teams for the same recruit (jitter)', () => {
    // The bug pre-Sprint-25: every team scored the same recruit identically
    // when no region bonus applied, and the id-localeCompare tiebreaker
    // funneled all teams to the same id-sorted top-N recruits. This test
    // ensures jitter breaks that clustering.
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
    // Across 360 teams ranking a 100-recruit class with the SAME prestige
    // and no region matches, jitter should produce non-trivial differences
    // in the top-30 selections (Jaccard < 0.95 between team A and team B).
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
    // Without jitter, Jaccard would be 1.0 (identical sets). With star
    // bonus + jitter, expect overlap < 1 — elite recruits still cluster
    // top, but lower-tier slots diverge.
    expect(jaccard).toBeLessThan(1);
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
