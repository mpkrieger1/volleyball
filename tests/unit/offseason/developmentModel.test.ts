import { describe, it, expect } from 'vitest';
import { offseason, createRng } from '@vcd/shared';

const baseRatings = () => ({
  attack: 60, block: 60, serve: 60, pass: 60, set: 60, dig: 60,
  athleticism: 60, iq: 60, stamina: 60,
});

const mkPlayer = (over: Partial<offseason.DevelopmentPlayer> = {}): offseason.DevelopmentPlayer => ({
  ratings: baseRatings(),
  potential: 85,
  classYear: 'SO',
  redshirtUsed: false,
  ...over,
});

const mkCoach = (ratingDevelop = 75): offseason.DevelopmentCoach => ({ ratingDevelop });

// Average a large number of runs to reduce noise influence in comparative tests.
function meanAttack(
  p: offseason.DevelopmentPlayer,
  c: offseason.DevelopmentCoach,
  playTime: number,
  label: string,
  iters = 500,
): number {
  let sum = 0;
  for (let i = 0; i < iters; i++) {
    const out = offseason.computePlayerGrowth(p, c, playTime, createRng(`${label}:${i}`));
    sum += out.attack;
  }
  return sum / iters;
}

describe('computePlayerGrowth', () => {
  it('starters grow more than benchwarmers (same coach, potential)', () => {
    const p = mkPlayer();
    const starter = meanAttack(p, mkCoach(), 0.8, 'starter');
    const bench = meanAttack(p, mkCoach(), 0.2, 'bench');
    expect(starter).toBeGreaterThan(bench);
  });

  it('player closer to potential grows less (headroom compression)', () => {
    const nearCap = mkPlayer({ potential: 65 });
    const farFromCap = mkPlayer({ potential: 90 });
    const nearMean = meanAttack(nearCap, mkCoach(), 0.8, 'near');
    const farMean = meanAttack(farFromCap, mkCoach(), 0.8, 'far');
    expect(farMean - 60).toBeGreaterThan(nearMean - 60);
  });

  it('FR grows more than SR with identical inputs', () => {
    const fr = meanAttack(mkPlayer({ classYear: 'FR' }), mkCoach(), 0.8, 'fr');
    const sr = meanAttack(mkPlayer({ classYear: 'SR' }), mkCoach(), 0.8, 'sr');
    expect(fr).toBeGreaterThan(sr);
  });

  it('higher coach.ratingDevelop → more growth', () => {
    const hi = meanAttack(mkPlayer(), mkCoach(95), 0.8, 'hi-coach');
    const lo = meanAttack(mkPlayer(), mkCoach(30), 0.8, 'lo-coach');
    expect(hi).toBeGreaterThan(lo);
  });

  it('ratings clamp to min(99, potential)', () => {
    const p = mkPlayer({ potential: 70, ratings: { ...baseRatings(), attack: 70 } });
    // Attack already at potential → can't grow beyond.
    for (let i = 0; i < 20; i++) {
      const out = offseason.computePlayerGrowth(p, mkCoach(95), 1.0, createRng(`cap:${i}`));
      expect(out.attack).toBeLessThanOrEqual(70);
    }
  });

  it('redshirted players get the 0.6× multiplier', () => {
    const redshirted = meanAttack(mkPlayer({ redshirtUsed: true }), mkCoach(), 0.2, 'rs');
    const active = meanAttack(mkPlayer({ redshirtUsed: false }), mkCoach(), 0.2, 'active');
    expect(active - 60).toBeGreaterThan(redshirted - 60);
  });

  it('deterministic given seed', () => {
    const a = offseason.computePlayerGrowth(mkPlayer(), mkCoach(), 0.8, createRng('det'));
    const b = offseason.computePlayerGrowth(mkPlayer(), mkCoach(), 0.8, createRng('det'));
    expect(a).toEqual(b);
  });
});
