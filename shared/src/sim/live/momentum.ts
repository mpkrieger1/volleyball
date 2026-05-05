// Sprint 29 Task 29.2: live-mode momentum (parallel to existing sim/momentum.ts).
//
// User-defined model:
//   - Leader's momentum = floor(|scoreA - scoreB| / 2). Trailer = 0.
//   - Recomputed after every rally; resets at start of each set.
//   - Tier = floor(momentum / 3), capped at 3 (so tiers 0..3).
//   - Each tier multiplies that team's skill ratings by 1.025 (compound).
//     tier 0 → 1.000, tier 1 → 1.025, tier 2 → 1.050625, tier 3 → 1.0768906.
//   - Stacks multiplicatively with Sprint 30's skill-talk +5% boost.
//
// This module is INDEPENDENT of shared/src/sim/momentum.ts (the existing
// continuous [-1, +1] bias model from Sprint 5). Both coexist:
//   - Existing module → drives attack-rate bias in simulateRally; used in
//     both sim-only and live paths to preserve calibration.
//   - This module → applies a multiplicative skill bonus, gated by
//     LiveMatchState.useLiveMomentum so it ONLY affects live-played
//     matches launched via the Match Hub Play button.

import type { LiveMomentum } from './state';

/** Per-tier multiplier applied per skill. Locked from user spec. */
export const LIVE_MOMENTUM_TIER_MULT = 1.025;

/** Cap on tiers — momentum bonuses level off after +9 (3 tiers). */
export const LIVE_MOMENTUM_MAX_TIER = 3;

/** Each tier requires this many momentum points. */
export const LIVE_MOMENTUM_POINTS_PER_TIER = 3;

/**
 * Compute live momentum for both teams from the current set score.
 * Leader's value = floor(|diff|/2); trailer's = 0; tied = both 0.
 */
export function computeLiveMomentum(homeScore: number, awayScore: number): LiveMomentum {
  if (homeScore === awayScore) return { home: 0, away: 0 };
  const diff = Math.abs(homeScore - awayScore);
  const value = Math.floor(diff / 2);
  return homeScore > awayScore
    ? { home: value, away: 0 }
    : { home: 0, away: value };
}

/** Tier 0..3 for a momentum value. */
export function tierFor(momentum: number): number {
  if (momentum <= 0) return 0;
  return Math.min(LIVE_MOMENTUM_MAX_TIER, Math.floor(momentum / LIVE_MOMENTUM_POINTS_PER_TIER));
}

/**
 * Skill multiplier from a momentum value.
 *   tier 0 → 1.000
 *   tier 1 → 1.025
 *   tier 2 → 1.050625
 *   tier 3 → 1.07689...
 * Compound (each tier is a stacked +2.5%).
 */
export function liveSkillMultiplier(momentum: number): number {
  const tier = tierFor(momentum);
  if (tier === 0) return 1.0;
  return Math.pow(LIVE_MOMENTUM_TIER_MULT, tier);
}
