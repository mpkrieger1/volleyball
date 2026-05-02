// Sprint 17: free-agent hiring pool. Generated each offseason.
//
// Candidates have three ratings (recruit, develop, strategy), a preferred
// role, an asking salary that scales with best rating, and an age band.
// Determinism: seeded RNG per index slot.

import { createRng } from '../rng';
import { FIRST_NAMES, LAST_NAMES } from '../recruiting/nameData';
import { weightedPick } from '../recruiting/ratings';

export type HiringPoolCandidate = {
  firstName: string;
  lastName: string;
  ratingRecruit: number;
  ratingDevelop: number;
  ratingStrategy: number;
  preferredRole: 'HC' | 'AHC' | 'AC';
  askingSalaryCents: number;
  ageYears: number;
};

/** Asking salary (cents) scales with max-rating. Range ~$40k to ~$900k. */
function deriveAskingSalaryCents(maxRating: number, role: HiringPoolCandidate['preferredRole']): number {
  // Base from rating, then role multiplier.
  // rating 30 → ~$40k, rating 90 → ~$600k (before role mult).
  const baseDollars = 20_000 + Math.pow(maxRating, 2) * 8;
  const roleMult = role === 'HC' ? 1.3 : role === 'AHC' ? 1.0 : 0.6;
  return Math.round(baseDollars * roleMult * 100);
}

export function generateHiringPool({
  seed,
  seasonYear,
  size,
}: {
  seed: string;
  seasonYear: number;
  size: number;
}): Array<HiringPoolCandidate & { seasonAvailable: number }> {
  const root = createRng(seed);
  const out: Array<HiringPoolCandidate & { seasonAvailable: number }> = [];
  for (let i = 0; i < size; i++) {
    const rng = root.fork(`cand:${i}`);
    const firstRng = rng.fork('first');
    const lastRng = rng.fork('last');
    // Ratings: roughly normal around 55, σ ≈ 12, clamped [25, 92].
    // Use sum-of-3-uniforms as a cheap approximation (no Box-Muller needed).
    const sample = (tag: string) => {
      const r = rng.fork(tag);
      const u = r.next() + r.next() + r.next();
      const std = (u - 1.5) * 12;
      return Math.max(25, Math.min(92, Math.round(55 + std)));
    };
    const ratingRecruit = sample('rec');
    const ratingDevelop = sample('dev');
    const ratingStrategy = sample('strat');
    // Preferred role: by max rating.
    const maxRating = Math.max(ratingRecruit, ratingDevelop, ratingStrategy);
    const roleRng = rng.fork('role');
    // 15% HC aspirants, 45% AHC, 40% AC — weighted by max rating so top
    // talent trends toward HC slots.
    const roleDie = roleRng.next() + maxRating / 300;
    const preferredRole: HiringPoolCandidate['preferredRole'] =
      roleDie > 1.0 ? 'HC' : roleDie > 0.55 ? 'AHC' : 'AC';
    const ageRng = rng.fork('age');
    const ageYears = 28 + Math.floor(ageRng.next() * 30); // 28..57
    const askingSalaryCents = deriveAskingSalaryCents(maxRating, preferredRole);
    const first = weightedPick(firstRng, FIRST_NAMES);
    const last = weightedPick(lastRng, LAST_NAMES);
    out.push({
      firstName: first.name,
      lastName: last.name,
      ratingRecruit,
      ratingDevelop,
      ratingStrategy,
      preferredRole,
      askingSalaryCents,
      ageYears,
      seasonAvailable: seasonYear,
    });
  }
  return out;
}
