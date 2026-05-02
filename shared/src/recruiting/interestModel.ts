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

/**
 * Sprint 25: Board-seeding score used by `openRecruitingCycle` to pick
 * which recruits fill each team's initial RecruitInterest board.
 *
 * Distinct from `computeBaseInterest` (which seeds the persisted interest
 * value) for two reasons:
 *   1. Adds a stars bonus so elite recruits rank top-of-board on every
 *      team — `computeBaseInterest` is star-agnostic by design (Sprint 13
 *      `STAR_DIFFICULTY_PER_STAR=0`), which causes ALL non-region-matching
 *      teams to score recruits identically and the id-localeCompare
 *      tiebreaker funnels every team's top-N onto the same id-sorted
 *      recruits, leaving the rest of the class with zero board entries.
 *   2. Adds deterministic per-(team, recruit) jitter to break ties on
 *      lower-tier recruits so they distribute across teams instead of
 *      clustering on id-sorted slices.
 *
 * The persisted RecruitInterest.interest stays at `computeBaseInterest`
 * so Sprint 13 commit-resolution semantics (interest^5 weighting,
 * shouldDecide thresholds) are unchanged.
 */
export const STAR_BOARD_BONUS = 80;
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
