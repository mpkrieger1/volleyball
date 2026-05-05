// Sprint 35 Task 35.2 — priority model tests.

import { describe, it, expect } from 'vitest';
import { recruiting, createRng } from '@vcd/shared';

const baseRecruit = {
  id: 'r1',
  stars: 4 as const,
  hometownRegion: 'CENTRAL' as const,
  wantsToLeaveHome: false,
};

const baseTeam = {
  teamId: 't1',
  region: 'CENTRAL',
  prestigeLevel: 70,
  facilitiesLevel: 5,
  academicsLevel: 60,
  playingTimeLevel: 50,
};

const baseCoaches = [{ role: 'HC' as const, ratingRecruit: 50 }];

describe('derivePriorityLevels', () => {
  it('prestige level passes through unmodified', () => {
    const levels = recruiting.derivePriorityLevels(baseRecruit, baseTeam);
    expect(levels.prestige).toBe(70);
  });

  it('facilitiesLevel 1..10 → 0..100 normalized', () => {
    const levels = recruiting.derivePriorityLevels(baseRecruit, { ...baseTeam, facilitiesLevel: 7 });
    expect(levels.facilities).toBe(70);
  });

  it('proximity is 100 when recruit and team share region (default polarity)', () => {
    const levels = recruiting.derivePriorityLevels(baseRecruit, baseTeam);
    expect(levels.proximityToHome).toBe(100);
  });

  it('proximity is 0 when regions differ (default polarity)', () => {
    const levels = recruiting.derivePriorityLevels(
      { ...baseRecruit, hometownRegion: 'EAST' },
      baseTeam,
    );
    expect(levels.proximityToHome).toBe(0);
  });

  it('wantsToLeaveHome flips proximity polarity', () => {
    const levels = recruiting.derivePriorityLevels(
      { ...baseRecruit, wantsToLeaveHome: true },
      baseTeam,
    );
    // Same-region team now scores LOW (recruit wants to leave).
    expect(levels.proximityToHome).toBe(0);
    const levelsLeaving = recruiting.derivePriorityLevels(
      { ...baseRecruit, hometownRegion: 'EAST', wantsToLeaveHome: true },
      baseTeam,
    );
    expect(levelsLeaving.proximityToHome).toBe(100);
  });
});

describe('computeRecruitTeamInterest', () => {
  const baseArgs = {
    recruit: baseRecruit,
    team: baseTeam,
    coachIntegrity: 50,
    coaches: baseCoaches,
    rubberbandMultiplier: 1.0,
  };

  it('returns an integer in [0, 100]', () => {
    const score = recruiting.computeRecruitTeamInterest({
      ...baseArgs,
      priorities: { playingTime: 5, proximityToHome: 5, prestige: 5, facilities: 5, nilDeal: 0 },
    });
    expect(Number.isInteger(score)).toBe(true);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('recruit weighting prestige=10, facilities=0 prefers higher-prestige team', () => {
    const priorities = { playingTime: 0, proximityToHome: 0, prestige: 10, facilities: 0, nilDeal: 0 };
    const lowPrestige = recruiting.computeRecruitTeamInterest({
      ...baseArgs,
      priorities,
      team: { ...baseTeam, prestigeLevel: 30 },
    });
    const highPrestige = recruiting.computeRecruitTeamInterest({
      ...baseArgs,
      priorities,
      team: { ...baseTeam, prestigeLevel: 95 },
    });
    expect(highPrestige).toBeGreaterThan(lowPrestige);
  });

  it('flipping recruit priorities to facilities=10, prestige=0 reverses preference', () => {
    const facFirst = { playingTime: 0, proximityToHome: 0, prestige: 0, facilities: 10, nilDeal: 0 };
    const lowFac = recruiting.computeRecruitTeamInterest({
      ...baseArgs,
      priorities: facFirst,
      team: { ...baseTeam, prestigeLevel: 95, facilitiesLevel: 1 },
    });
    const highFac = recruiting.computeRecruitTeamInterest({
      ...baseArgs,
      priorities: facFirst,
      team: { ...baseTeam, prestigeLevel: 30, facilitiesLevel: 9 },
    });
    expect(highFac).toBeGreaterThan(lowFac);
  });

  it('higher coach.ratingRecruit boosts interest (modest effect)', () => {
    const args = {
      ...baseArgs,
      priorities: { playingTime: 5, proximityToHome: 5, prestige: 5, facilities: 5, nilDeal: 0 },
    };
    const lowCoach = recruiting.computeRecruitTeamInterest({
      ...args,
      coaches: [{ role: 'HC', ratingRecruit: 30 }],
    });
    const highCoach = recruiting.computeRecruitTeamInterest({
      ...args,
      coaches: [{ role: 'HC', ratingRecruit: 90 }],
    });
    expect(highCoach).toBeGreaterThan(lowCoach);
  });

  it('all-zero priorities returns 0 (no weight to distribute)', () => {
    const score = recruiting.computeRecruitTeamInterest({
      ...baseArgs,
      priorities: { playingTime: 0, proximityToHome: 0, prestige: 0, facilities: 0, nilDeal: 0 },
    });
    expect(score).toBe(0);
  });
});

describe('sampleRecruitPriorities', () => {
  it('10K samples have mean ≈ 5 and sd ≈ 2 per component', () => {
    const rng = createRng('priority-sample-test');
    const N = 10_000;
    const sums: Record<string, number> = {
      playingTime: 0, proximityToHome: 0, prestige: 0, facilities: 0, nilDeal: 0,
    };
    const sumSq: Record<string, number> = { ...sums };
    let leaveHomeCount = 0;
    for (let i = 0; i < N; i++) {
      const out = recruiting.sampleRecruitPriorities(rng);
      for (const k of Object.keys(sums) as (keyof typeof sums)[]) {
        const v = out.priorities[k];
        sums[k] += v;
        sumSq[k] += v * v;
      }
      if (out.wantsToLeaveHome) leaveHomeCount += 1;
    }
    for (const k of Object.keys(sums)) {
      const mean = sums[k]! / N;
      const variance = sumSq[k]! / N - mean * mean;
      const sd = Math.sqrt(variance);
      expect(mean).toBeGreaterThan(4.5);
      expect(mean).toBeLessThan(5.5);
      expect(sd).toBeGreaterThan(1.5);
      expect(sd).toBeLessThan(2.5);
    }
    const leaveHomeFrac = leaveHomeCount / N;
    expect(leaveHomeFrac).toBeGreaterThan(0.10);
    expect(leaveHomeFrac).toBeLessThan(0.20);
  });

  it('priorities are in [0, 10]', () => {
    const rng = createRng('priority-clip-test');
    for (let i = 0; i < 500; i++) {
      const out = recruiting.sampleRecruitPriorities(rng);
      for (const v of Object.values(out.priorities)) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(10);
      }
    }
  });

  it('determinism — identical seed produces identical sequence', () => {
    const a = recruiting.sampleRecruitPriorities(createRng('determ'));
    const b = recruiting.sampleRecruitPriorities(createRng('determ'));
    expect(a).toEqual(b);
  });
});

describe('priorityFromId', () => {
  it('same id → same priorities (idempotent)', () => {
    const a = recruiting.priorityFromId('recruit-abc-123');
    const b = recruiting.priorityFromId('recruit-abc-123');
    expect(a).toEqual(b);
  });

  it('different ids → different priorities (basic dispersion)', () => {
    const ids = ['rA', 'rB', 'rC', 'rD', 'rE'];
    const seen = new Set(ids.map((id) => JSON.stringify(recruiting.priorityFromId(id))));
    expect(seen.size).toBeGreaterThan(1);
  });
});
