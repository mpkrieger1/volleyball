// Sprint 35 Task 35.4 — interest is recomputed from priorities × levels.
//
// Acceptance: a recruit weighting facilities=10 sees a higher interest
// in a high-facilities team than a low-facilities team (all else equal).

import { describe, it, expect } from 'vitest';
import { recruiting } from '@vcd/shared';

describe('Sprint 35 — interest model responds to facilities priority', () => {
  it('recruit weighting facilities heavily prefers higher-facilities team', () => {
    const recruit = {
      id: 'r1',
      stars: 4 as const,
      hometownRegion: 'CENTRAL',
      wantsToLeaveHome: false,
    };
    const priorities = {
      playingTime: 1,
      proximityToHome: 1,
      prestige: 1,
      facilities: 10, // recruit cares ALL about facilities
      nilDeal: 0,
    };
    const lowFac = recruiting.computeRecruitTeamInterest({
      recruit,
      team: {
        teamId: 't1',
        region: 'CENTRAL',
        prestigeLevel: 70,
        facilitiesLevel: 2,
        academicsLevel: 50,
        playingTimeLevel: 50,
      },
      priorities,
      coachIntegrity: 50,
      coaches: [{ role: 'HC', ratingRecruit: 50, ratingDevelop: 50, ratingStrategy: 50 }],
      rubberbandMultiplier: 1.0,
    });
    const highFac = recruiting.computeRecruitTeamInterest({
      recruit,
      team: {
        teamId: 't2',
        region: 'CENTRAL',
        prestigeLevel: 70,
        facilitiesLevel: 9,
        academicsLevel: 50,
        playingTimeLevel: 50,
      },
      priorities,
      coachIntegrity: 50,
      coaches: [{ role: 'HC', ratingRecruit: 50, ratingDevelop: 50, ratingStrategy: 50 }],
      rubberbandMultiplier: 1.0,
    });
    expect(highFac).toBeGreaterThan(lowFac);
    // facilities priority weight=1; jump from facilitiesLevel 2→9 is 70 points
    // out of 100. Net difference should be measurable (≥ a few points).
    expect(highFac - lowFac).toBeGreaterThan(3);
  });
});
