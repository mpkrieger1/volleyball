// Sprint 36 Task 36.4 — recruiter-quality tier helper.

import { describe, it, expect } from 'vitest';
import { recruiting } from '@vcd/shared';

describe('getRecruiterQuality', () => {
  it.each([
    [100, 'ACE'],
    [85, 'ACE'],
    [84, 'GREAT'],
    [70, 'GREAT'],
    [69, 'GOOD'],
    [55, 'GOOD'],
    [54, 'MEDIOCRE'],
    [0, 'MEDIOCRE'],
  ])('rating %i → %s', (rating, expected) => {
    expect(recruiting.getRecruiterQuality(rating)).toBe(expected);
  });
});

describe('RECRUITER_QUALITY_MULTIPLIER', () => {
  it('table values are exact', () => {
    expect(recruiting.RECRUITER_QUALITY_MULTIPLIER.ACE).toBe(2.0);
    expect(recruiting.RECRUITER_QUALITY_MULTIPLIER.GREAT).toBe(1.66);
    expect(recruiting.RECRUITER_QUALITY_MULTIPLIER.GOOD).toBe(1.33);
    expect(recruiting.RECRUITER_QUALITY_MULTIPLIER.MEDIOCRE).toBe(1.0);
  });
});

describe('computeRecruitTeamInterest with recruiter quality', () => {
  const baseRecruit = {
    id: 'r1',
    stars: 4 as const,
    hometownRegion: 'CENTRAL',
    wantsToLeaveHome: false,
  };
  const baseTeam = {
    teamId: 't1',
    region: 'CENTRAL',
    prestigeLevel: 70,
    facilitiesLevel: 5,
    academicsLevel: 50,
    playingTimeLevel: 50,
  };
  const priorities = {
    playingTime: 5,
    proximityToHome: 5,
    prestige: 5,
    facilities: 5,
    nilDeal: 0,
  };

  it('ACE recruiter scores higher than MEDIOCRE recruiter', () => {
    const ace = recruiting.computeRecruitTeamInterest({
      recruit: baseRecruit,
      team: baseTeam,
      priorities,
      coachIntegrity: 50,
      coaches: [{ role: 'HC', ratingRecruit: 90, ratingDevelop: 50, ratingStrategy: 50 }],
      rubberbandMultiplier: 1.0,
    });
    const med = recruiting.computeRecruitTeamInterest({
      recruit: baseRecruit,
      team: baseTeam,
      priorities,
      coachIntegrity: 50,
      coaches: [{ role: 'HC', ratingRecruit: 30, ratingDevelop: 50, ratingStrategy: 50 }],
      rubberbandMultiplier: 1.0,
    });
    expect(ace).toBeGreaterThan(med);
  });
});
