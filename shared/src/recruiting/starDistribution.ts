// Sprint 12: star-tier distribution for HS recruit generation.
//
// Target curve matches NCAA D-I recruiting ranking conventions:
//   5★: 1%  (elite)
//   4★: 5%  (high D-I)
//   3★: 24% (solid D-I)
//   2★: 40% (mid-D-I / high D-II ceiling)
//   1★: 30% (walk-on / late commits)
// Sums to 100%. The PRD exit test 1 tolerance is ±5 percentage points.
//
// These are TUNABLE — if you change them, the 1,000-class calibration
// test will stay green as long as the empirical distribution matches
// the new curve. Sprint 5's golden-fixture convention applies:
// intentional tweaks go in a dedicated commit with a comment.

import type { Rng } from '../rng';

export type Stars = 1 | 2 | 3 | 4 | 5;

export type StarDistEntry = { stars: Stars; prob: number };

export const STAR_DISTRIBUTION: StarDistEntry[] = [
  { stars: 5, prob: 0.01 },
  { stars: 4, prob: 0.05 },
  { stars: 3, prob: 0.24 },
  { stars: 2, prob: 0.40 },
  { stars: 1, prob: 0.30 },
];

export function sampleStars(rng: Rng): Stars {
  const r = rng.next();
  let acc = 0;
  for (const entry of STAR_DISTRIBUTION) {
    acc += entry.prob;
    if (r < acc) return entry.stars;
  }
  // Numerical floor: return the last tier.
  return STAR_DISTRIBUTION[STAR_DISTRIBUTION.length - 1]!.stars;
}

/**
 * Base rating per star tier. Generator draws uniform within each band
 * and then applies per-position multipliers.
 */
export function sampleBaseRating(rng: Rng, stars: Stars): number {
  const ranges: Record<Stars, [number, number]> = {
    5: [85, 95],
    4: [75, 87],
    3: [65, 77],
    2: [55, 67],
    1: [40, 58],
  };
  const [lo, hi] = ranges[stars];
  return rng.int(lo, hi);
}

/**
 * Potential ceiling (0..100). Higher stars → higher mean with noise.
 * Distinct from current rating — represents the developmental cap.
 */
export function samplePotential(rng: Rng, stars: Stars): number {
  const means: Record<Stars, number> = { 5: 93, 4: 85, 3: 75, 2: 65, 1: 55 };
  const sd = 5;
  const mean = means[stars];
  // Box–Muller one-sided — see sampleHeight for the full implementation.
  const u1 = Math.max(1e-9, rng.next());
  const u2 = rng.next();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return Math.max(30, Math.min(100, Math.round(mean + z * sd)));
}
