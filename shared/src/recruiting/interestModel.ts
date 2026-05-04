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

/**
 * Sprint 28 (post-screenshot review): tunable weights mirroring the FCCD
 * "Recruit Priorities" model in spirit. Each recruit weights factors;
 * each team's standing on each factor is derived from its data:
 *
 *   FCCD factor              | VCD source                         | weight here
 *   -------------------------|------------------------------------|--------------
 *   School prestige          | Team.prestige × Recruit.stars      | dominant
 *   Proximity to home        | Team.region == Recruit.region      | REGION_BONUS
 *   Coach reputation         | HC.ratingRecruit                   | COACH_DIFF_WEIGHT
 *   Playing time             | commits at recruit's position      | COMMIT_SAT
 *   Star/program-tier fit    | star-floor ladder (NEW Sprint 28)  | STAR_FLOOR_*
 *   Scheme fit, atmosphere,  | (deferred — needs new team props)  | —
 *   facilities, academics,   |
 *   college life, NIL deal   |
 *
 * The Sprint 13 model multiplied prestige by a flat weight (4), so a 5-star
 * and a 1-star scored identically against a low-prestige program — and
 * Davidson (prestige 45) ended up with a board full of 5-stars at 230
 * interest each. The Sprint 28 fix:
 *   - Make the prestige signal scale with stars: `prestige × stars` so
 *     star-prestige fit becomes the primary signal (95×5=475, 45×5=225).
 *   - Add a star-floor penalty: each star tier expects a minimum prestige.
 *     Schools below the floor pay (floor − prestige) × WEIGHT, which
 *     wipes out 5-star interest at Davidson while leaving 3-star interest
 *     intact.
 */
export const PRESTIGE_STAR_WEIGHT = 1.0;
export const COACH_DIFF_WEIGHT = 0.5;
export const REGION_BONUS = 40;
export const COMMIT_SATURATION_PER_COMMIT = 15;

/** Minimum team prestige expected for each star tier. */
export const STAR_PRESTIGE_FLOOR: Record<1 | 2 | 3 | 4 | 5, number> = {
  1: 0,
  2: 15,
  3: 30,
  4: 50,
  5: 70,
};
/** Cost in interest points per prestige-point shortfall vs. the floor. */
export const STAR_FLOOR_PENALTY_WEIGHT = 12;

export const MAX_INTEREST = 1000;

/**
 * Base interest from a team's "Recruit Priorities"-style profile.
 * Examples:
 *   blueblood (prestige 90) + 5-star + region-match: 90×5 + 20 + 40 = 510
 *   blueblood (prestige 90) + 3-star + no region:    90×3 +  0 +  0 = 270
 *   mid-major (prestige 45) + 5-star + no region:    45×5 − (70−45)×12 = 225 − 300 = 0  (Davidson stays out of the 5-star race)
 *   mid-major (prestige 45) + 4-star + no region:    45×4 − (50−45)×12 = 180 − 60  = 120
 *   mid-major (prestige 45) + 3-star + region-match: 45×3 + 40             = 175
 *   low-major (prestige 25) + 4-star: floor 50, gap 25, penalty 300; base 100 - 300 = 0
 *   low-major (prestige 25) + 2-star: floor 15, no penalty; base 50, low but visible
 */
export function computeBaseInterest(
  recruit: RecruitInterestInput,
  team: TeamInterestInput,
): number {
  let score = team.prestige * recruit.stars * PRESTIGE_STAR_WEIGHT;
  score += (team.coachRatingRecruit - 50) * COACH_DIFF_WEIGHT;
  if (recruit.hometownRegion === team.region) score += REGION_BONUS;
  score -= team.commitsAtPosition * COMMIT_SATURATION_PER_COMMIT;

  const floor = STAR_PRESTIGE_FLOOR[recruit.stars];
  const gap = Math.max(0, floor - team.prestige);
  score -= gap * STAR_FLOOR_PENALTY_WEIGHT;

  return Math.max(0, Math.round(score));
}

/**
 * Sprint 25: Board-seeding score used by `openRecruitingCycle` to pick
 * which recruits fill each team's initial RecruitInterest board.
 *
 * Sprint 28 update: the Sprint 25 doc explained that `computeBaseInterest`
 * was star-agnostic and that's why this function adds a stars bonus. As
 * of Sprint 28, base interest is `prestige × stars`, so star priority is
 * already baked into the base. The board-score function now mainly:
 *   1. Adds a small stars bonus (25) to nudge ties between equal-base
 *      recruits toward the higher-star one, which still matters because
 *      the floor penalty wipes some 5-star bases to zero on low-prestige
 *      programs and the remaining 4-stars at those programs all score
 *      similarly.
 *   2. Adds deterministic per-(team, recruit) jitter to break ties on
 *      lower-tier recruits so they distribute across teams instead of
 *      clustering on id-sorted slices.
 *
 * The persisted RecruitInterest.interest stays at `computeBaseInterest`
 * so Sprint 13 commit-resolution semantics (interest^5 weighting,
 * shouldDecide thresholds) are unchanged.
 */
// Sprint 28: with the new `prestige × stars` base, the star bonus no longer
// has to forcibly separate tiers — it just nudges ties. Lower from 80 to 25.
export const STAR_BOARD_BONUS = 25;
export const BOARD_JITTER_RANGE = 40;

export function computeBoardScore(
  recruit: RecruitInterestInput & { recruitId: string },
  team: TeamInterestInput,
): number {
  const base = computeBaseInterest(recruit, team);
  const stars = base + recruit.stars * STAR_BOARD_BONUS;
  // Deterministic jitter from a stable hash of teamId+recruitId. We use
  // an inline xmur3-style mix to avoid an rng dependency from this pure
  // function. The output is in [-BOARD_JITTER_RANGE/2, +BOARD_JITTER_RANGE/2].
  const key = `${team.teamId}|${recruit.recruitId}`;
  let h = 1779033703 ^ key.length;
  for (let i = 0; i < key.length; i++) {
    h = Math.imul(h ^ key.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  h ^= h >>> 16;
  const u = (h >>> 0) / 4294967296;
  const jitter = Math.round((u - 0.5) * BOARD_JITTER_RANGE);
  return stars + jitter;
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
