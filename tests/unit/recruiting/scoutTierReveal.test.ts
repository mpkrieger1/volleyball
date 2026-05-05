// Sprint 35 Task 35.6 — scout-tier reveal projection.
//
// Maps RecruitInterest.scoutLevel (0..3, capped) to a 3-tier reveal:
//   0    → Locked  (position + stars + height + hometown only)
//   1    → Partial (+ best 3 of 9 ratings + potential range)
//   2-3  → Full    (+ all 9 ratings + exact potential)

import { describe, it, expect } from 'vitest';
import { projectRecruitDetail } from '../../../main/src/recruiting/scoutReveal';

const baseRecruit = {
  id: 'r1',
  firstName: 'Test',
  lastName: 'Recruit',
  position: 'OH',
  stars: 4,
  height: 185,
  hometownCity: 'Lincoln',
  hometownState: 'NE',
  hometownRegion: 'CENTRAL',
  potential: 80,
  commitState: 'PENDING',
  commitmentStatus: 'EXPLORING',
  ratingsJson: JSON.stringify({
    attack: 75, block: 70, serve: 65, pass: 70, set: 60,
    dig: 70, athleticism: 75, iq: 70, stamina: 75,
  }),
};

describe('projectRecruitDetail — Sprint 35 scout-tier reveal', () => {
  it('Tier 0 (Locked, scoutLevel=0) hides ratings + potential', () => {
    const out = projectRecruitDetail({ recruit: baseRecruit, scoutLevel: 0 });
    expect(out.tier).toBe('LOCKED');
    expect(out.ratings).toBeUndefined();
    expect(out.potential).toBeUndefined();
    expect(out.potentialRange).toBeUndefined();
    expect(out.position).toBe('OH');
    expect(out.stars).toBe(4);
    expect(out.height).toBe(185);
  });

  it('Tier 1 (Partial, scoutLevel=1) shows top-3 ratings + potential range', () => {
    const out = projectRecruitDetail({ recruit: baseRecruit, scoutLevel: 1 });
    expect(out.tier).toBe('PARTIAL');
    expect(out.topRatings).toBeDefined();
    expect(out.topRatings!.length).toBe(3);
    // Top-3 of {attack:75, block:70, serve:65, pass:70, set:60, dig:70,
    //          athleticism:75, iq:70, stamina:75}
    // → 75-tied: attack, athleticism, stamina (alpha tiebreak)
    expect(new Set(out.topRatings!.map((r) => r.key))).toEqual(
      new Set(['attack', 'athleticism', 'stamina']),
    );
    expect(out.potentialRange).toBeDefined();
    expect(out.potentialRange!.lo).toBeLessThanOrEqual(80);
    expect(out.potentialRange!.hi).toBeGreaterThanOrEqual(80);
    expect(out.potentialRange!.hi - out.potentialRange!.lo).toBe(50);
    expect(out.ratings).toBeUndefined();
    expect(out.potential).toBeUndefined();
  });

  it('Tier 2 (Full, scoutLevel=2) shows all 9 ratings + exact potential', () => {
    const out = projectRecruitDetail({ recruit: baseRecruit, scoutLevel: 2 });
    expect(out.tier).toBe('FULL');
    expect(out.ratings).toBeDefined();
    expect(out.ratings!.attack).toBe(75);
    expect(out.ratings!.stamina).toBe(75);
    expect(out.potential).toBe(80);
    expect(out.potentialRange).toBeUndefined(); // suppressed at FULL
    expect(out.topRatings).toBeUndefined();
  });

  it('scoutLevel=3 also produces Full (mapping clamp; legacy Sprint 28 ceiling)', () => {
    const out = projectRecruitDetail({ recruit: baseRecruit, scoutLevel: 3 });
    expect(out.tier).toBe('FULL');
    expect(out.ratings).toBeDefined();
    expect(out.potential).toBe(80);
  });

  it('scoutLevel above 3 still clamps to Full (defensive)', () => {
    const out = projectRecruitDetail({ recruit: baseRecruit, scoutLevel: 99 });
    expect(out.tier).toBe('FULL');
  });
});
