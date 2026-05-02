// Sprint 13: recruiting interest model.
//
// Base interest is computed at cycle-open time as a deterministic
// function of team attributes and recruit attributes. Action deltas
// apply on top of the base.
//
// PRD factors: prestige, coach recruiting rating, location, playing-time
// pitch, current commits. Playing-time is approximated via "current
// commits" (more commits at a position reduces remaining time slots).

import { RECRUITING_ACTIONS, type RecruitingActionType } from './actions';

export type TeamInterestInput = {
  teamId: string;
  prestige: number; // 0..100
  region: string; // 'EAST' | 'CENTRAL' | 'MOUNTAIN' | 'PACIFIC'
  coachRatingRecruit: number; // 0..100
  /** Count of already-committed recruits at this recruit's position for this team. */
  commitsAtPosition: number;
};

export type RecruitInterestInput = {
  stars: 1 | 2 | 3 | 4 | 5;
  hometownRegion: string; // 'EAST' | 'CENTRAL' | 'MOUNTAIN' | 'PACIFIC'
};

/** Tunable weights for the base formula. Exposed so Sprint 14+ can tweak. */
/**
 * Sprint 13: prestige is the dominant signal. Weight=4 gives a meaningful
 * spread across the prestige range (gap ~200 points between blueblood
 * prestige-90 and bottom-quartile prestige-40) so top programs land
 * the elite recruits at a realistic rate (PRD exit test 2).
 */
export const PRESTIGE_WEIGHT = 4.0;
export const COACH_WEIGHT = 1.0;
export const REGION_BONUS = 40;
/**
 * Sprint 13: "pickier" is handled by `shouldDecide` waiting longer for
 * higher-star recruits, NOT by lowering base interest. Higher stars
 * DON'T subtract from base — blue-blood programs should pursue the
 * 5-star first. Left at 0 for future tuning.
 */
export const STAR_DIFFICULTY_PER_STAR = 0;
export const COMMIT_SATURATION_PER_COMMIT = 15;
export const MAX_INTEREST = 1000;

/**
 * Base interest in the range 0..~250. Representative gaps:
 *   blueblood (prestige 90, coach 85, region-match): ~250
 *   mid-major (prestige 55, coach 55, no region-match): ~110
 *   low-major (prestige 35, coach 40, no region-match): ~60
 * The AI recruiter multiplies this by its coach-recruit ratio when
 * pushing deltas, so higher-rated recruiters close gaps faster.
 */
export function computeBaseInterest(
  recruit: RecruitInterestInput,
  team: TeamInterestInput,
): number {
  let score = 0;
  score += team.prestige * PRESTIGE_WEIGHT;
  score += team.coachRatingRecruit * COACH_WEIGHT;
  if (recruit.hometownRegion === team.region) score += REGION_BONUS;
  // High-star recruits are pickier — the baseline expectation is lower.
  score -= recruit.stars * STAR_DIFFICULTY_PER_STAR;
  // Saturation: each prior commit at this position reduces appeal.
  score -= team.commitsAtPosition * COMMIT_SATURATION_PER_COMMIT;
  return Math.max(0, Math.round(score));
}

/** Clamp helper. */
export function applyActionDelta(
  currentInterest: number,
  action: RecruitingActionType,
): number {
  const def = RECRUITING_ACTIONS[action];
  const next = currentInterest + def.delta;
  return Math.max(0, Math.min(MAX_INTEREST, next));
}
