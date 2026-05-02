// Sprint 16: per-player offseason development model.
//
// growth = BASE_GROWTH
//        × (coach.ratingDevelop / 75)    // ~0.4..1.27
//        × playTimeMultiplier             // 0.5 bench, 1.5 starter
//        × potentialHeadroom              // (potential - currentKey) / 30
//        × classYearMultiplier            // FR 1.3, SO 1.15, JR 1.0, SR 0.7
//        + noise                          // ±0.5 per rating key
// Redshirt tick: multiply by REDSHIRT_MULT (0.6).
// Final rating clamps to min(99, player.potential) per key.

import type { Rng } from '../rng';
import type { PlayerRatings } from '../sim/ratings';

export type DevelopmentPlayer = {
  ratings: PlayerRatings;
  potential: number; // 0..100
  classYear: 'FR' | 'SO' | 'JR' | 'SR' | 'GR';
  redshirtUsed: boolean;
};

export type DevelopmentCoach = {
  ratingDevelop: number; // 0..100, default 50
};

/** Share of max playing time, 0..1 (e.g., 0.85 for a starter). */
export type PlayTimeSignal = number;

export const BASE_GROWTH = 2.0;
export const PLAY_TIME_BENCH_MULT = 0.5;
export const PLAY_TIME_STARTER_MULT = 1.5;
/** Threshold above which a player is considered a starter. */
export const STARTER_THRESHOLD = 0.5;
export const REDSHIRT_MULT = 0.6;
export const NOISE_AMP = 0.5;

const CLASS_YEAR_MULT: Record<DevelopmentPlayer['classYear'], number> = {
  FR: 1.3,
  SO: 1.15,
  JR: 1.0,
  SR: 0.7,
  GR: 0.5,
};

/**
 * Compute new ratings for a returning player after one offseason. Pure
 * deterministic function. Output ratings are integers clamped to
 * [1, min(99, potential)].
 */
export function computePlayerGrowth(
  player: DevelopmentPlayer,
  coach: DevelopmentCoach,
  playTime: PlayTimeSignal,
  rng: Rng,
): PlayerRatings {
  const coachMult = coach.ratingDevelop / 75;
  const playMult = playTime >= STARTER_THRESHOLD ? PLAY_TIME_STARTER_MULT : PLAY_TIME_BENCH_MULT;
  const classMult = CLASS_YEAR_MULT[player.classYear];
  const redshirtMult = player.redshirtUsed ? REDSHIRT_MULT : 1.0;

  const keys: Array<keyof PlayerRatings> = [
    'attack', 'block', 'serve', 'pass', 'set', 'dig', 'athleticism', 'iq', 'stamina',
  ];
  const cap = Math.min(99, player.potential);
  const out = {} as PlayerRatings;
  for (const k of keys) {
    const current = player.ratings[k];
    // If current already exceeds cap (Sprint 12 position archetype can
    // push a per-key rating above player.potential), keep it — don't
    // clamp DOWN. Only constrain upward growth.
    if (current >= cap) {
      out[k] = current;
      continue;
    }
    const headroom = Math.max(0, (player.potential - current) / 30);
    const noise = (rng.next() - 0.5) * 2 * NOISE_AMP;
    const growth =
      BASE_GROWTH * coachMult * playMult * classMult * redshirtMult * headroom + noise;
    const next = Math.round(current + growth);
    out[k] = Math.max(1, Math.min(cap, next));
  }
  return out;
}
