// Sprint 12: rating + height sampling helpers for the recruit generator.

import type { Rng } from '../rng';
import type { PlayerRatings } from '../sim/ratings';
import type { PositionArchetype } from './positionArchetypes';

const RATING_KEYS: Array<keyof PlayerRatings> = [
  'attack', 'block', 'serve', 'pass', 'set', 'dig', 'athleticism', 'iq', 'stamina',
];

/**
 * Combine a base rating with per-position multipliers and per-rating
 * jitter. Output is clamped to [1, 99].
 */
export function applyArchetype(
  rng: Rng,
  base: number,
  archetype: PositionArchetype,
): PlayerRatings {
  const out = {} as PlayerRatings;
  for (const key of RATING_KEYS) {
    const mult = archetype.ratingMultipliers[key];
    const jitter = rng.int(-6, 6);
    const raw = Math.round(base * mult + jitter);
    out[key] = Math.max(1, Math.min(99, raw));
  }
  return out;
}

/**
 * Sample a height via Box–Muller from N(mean, sd²), clamped to sanity
 * bounds [150, 220] cm. Returns integer centimeters.
 */
export function sampleHeight(rng: Rng, archetype: PositionArchetype): number {
  const u1 = Math.max(1e-9, rng.next());
  const u2 = rng.next();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  const cm = Math.round(archetype.heightMeanCm + z * archetype.heightSdCm);
  return Math.max(150, Math.min(220, cm));
}

/**
 * Weighted-pick utility. Entries with higher `weight` are chosen more
 * often. O(n) per call; fine for our list sizes.
 */
export function weightedPick<T extends { weight: number }>(rng: Rng, items: T[]): T {
  if (items.length === 0) throw new Error('weightedPick: empty list');
  let total = 0;
  for (const it of items) total += it.weight;
  const r = rng.next() * total;
  let acc = 0;
  for (const it of items) {
    acc += it.weight;
    if (r < acc) return it;
  }
  return items[items.length - 1]!;
}
