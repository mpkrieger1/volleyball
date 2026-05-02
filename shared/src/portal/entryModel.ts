// Sprint 14: portal-entry probability model.
//
// PRD-listed drivers: playing time, position depth, coaching change,
// academic fit. This sprint implements playing time (via depth rank) +
// position depth + class-year + rating-vs-prestige mismatch. Coaching
// change and academic fit are stubbed as a small random noise factor.
//
// Target population entry rate: ~10% (center of PRD 8–15% band).

import type { Rng } from '../rng';

export type PlayerLike = {
  overall: number; // mean of 9 ratings, 0..100
  classYear: 'FR' | 'SO' | 'JR' | 'SR' | 'GR';
  position: string;
  /** Sprint 15: aggregate NIL value for this player across all active
   * deals, in cents. Higher NIL reduces entry probability (retention). */
  nilValueCents?: number;
};

export type TeamLike = {
  prestige: number; // 0..100
};

export type RosterContext = {
  /** Within-position rank on this team (1 = starter, 4 = deep bench). */
  depthRank: number;
};

// Tunables — calibrated so a 10,000-player seeded sim lands in [0.08, 0.15].
export const BASE_RATE = 0.04;
export const DEPTH_WEIGHT = 0.045; // each step down the depth chart adds 4.5%
export const PRESTIGE_MISMATCH_WEIGHT = 0.002; // per-point of (overall - prestige)
export const SENIOR_FLOOR = 0.01; // SR entry prob cap
export const FRESHMAN_BONUS = 0.02; // FRs in the portal (looking for better fit)
export const NOISE_AMPLITUDE = 0.02;

/** Sprint 15: maximum reduction to entry probability from NIL retention. */
export const NIL_RETENTION_WEIGHT = 0.05;
/** Sprint 15: NIL amount at which retention saturates ($30k). */
export const NIL_SATURATION_CENTS = 30_000_00;

/**
 * Returns the Bernoulli probability [0, 1] that this player enters
 * the portal this cycle. Deterministic given inputs + RNG.
 */
export function computePortalEntryProbability(
  player: PlayerLike,
  team: TeamLike,
  context: RosterContext,
  rng: Rng,
): number {
  // Seniors rarely transfer.
  if (player.classYear === 'SR') return Math.min(SENIOR_FLOOR, BASE_RATE);

  let p = BASE_RATE;
  // Depth penalty: 1 = starter (no add), 4 = bench (big add).
  p += Math.max(0, context.depthRank - 1) * DEPTH_WEIGHT;

  // Prestige mismatch: player is better than team's prestige → looking
  // to move up. Player worse than prestige → unlikely to find a better
  // spot. Only upward mismatch adds; downward is neutral.
  const mismatch = player.overall - team.prestige;
  if (mismatch > 0) {
    p += mismatch * PRESTIGE_MISMATCH_WEIGHT;
  }

  if (player.classYear === 'FR') p += FRESHMAN_BONUS;

  // Sprint 15: NIL retention. Higher NIL packages reduce entry probability.
  if (player.nilValueCents && player.nilValueCents > 0) {
    const saturated = Math.min(1, player.nilValueCents / NIL_SATURATION_CENTS);
    p -= NIL_RETENTION_WEIGHT * saturated;
  }

  // Small random noise: coaching-change/academic-fit stub.
  p += (rng.next() - 0.5) * NOISE_AMPLITUDE * 2;

  return Math.max(0, Math.min(0.6, p));
}

export function didPlayerEnterPortal(rng: Rng, probability: number): boolean {
  return rng.next() < probability;
}
