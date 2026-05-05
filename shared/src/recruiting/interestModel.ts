// Sprint 13 → 35 → 37: recruiting interest helpers.
//
// Sprint 13 introduced `computeBaseInterest` (prestige × weight + region
// + coach + commits). Sprint 28 added the star-prestige floor penalty.
// Sprint 35 replaced the math with the FCCD priority-driven model
// (`computeRecruitTeamInterest` in `priorityModel.ts`) and kept
// `computeBaseInterest` as a deprecated 0..1000-magnitude wrapper.
// Sprint 37 (this file) deletes the wrapper entirely; the magnitude
// conversion + Sprint 28 floor penalty live inside the small bridge
// helper `computeRecruitTeamInterestScaled` below.
//
// Why the legacy 0..1000 magnitude survives: Sprint 13 commit-resolution
// thresholds (`HOT_INTEREST_THRESHOLD = 600`, `INTEREST_FLOOR = 30`) and
// the `interest^5` weight in `pickCommittingTeam` are calibrated against
// it. Re-tuning would require regenerating the recruiting calibration
// fixtures; out of scope for v1.2.

import { RECRUITING_ACTIONS, type RecruitingActionType } from './actions';
import {
  computeRecruitTeamInterest,
  type RecruitPriorities,
} from './priorityModel';

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
 * Default priorities for legacy callers that don't have per-recruit
 * priority data (e.g. AI replenishment ranking, board seeding before
 * Sprint 35). Mirrors a "neutral" recruit with all priorities at 5/10.
 */
const DEFAULT_PRIORITIES: RecruitPriorities = {
  playingTime: 5,
  proximityToHome: 5,
  prestige: 5,
  facilities: 5,
  nilDeal: 0,
};

/**
 * Bridge from the legacy (RecruitInterestInput, TeamInterestInput) shape
 * to the priority-driven model in `priorityModel.ts`. Returns interest in
 * the legacy 0..1000 magnitude (priority helper × 10) with the Sprint 28
 * star-prestige floor penalty applied so mid-major programs stay off
 * 5-star boards.
 *
 * Used by:
 *   - `openRecruitingCycle` for board seeding (persisted RecruitInterest.interest)
 *   - `advanceRecruitingWeek` for AI replenishment ranking + per-tick recompute
 *   - `computeBoardScore` for board ranking (adds star bonus + jitter)
 *
 * Sprint 37: optional per-recruit `priorities` + `wantsToLeaveHome` (Sprint 35
 * data) and per-team `facilitiesLevel` + `academicsLevel` (Sprint 32/35) plug
 * into the priority helper so live team-attribute changes (facilities upgrade,
 * prestige bump) reflect on the next tick. Defaults preserve the Sprint 35
 * neutral-priorities behavior for legacy callers (board seeding, replenishment).
 */
export interface ComputeRecruitTeamInterestScaledOpts {
  /** Sprint 35 sampled priorities. Default = neutral 5/5/5/5 + 0 NIL. */
  priorities?: RecruitPriorities;
  /** Sprint 35 wantsToLeaveHome flag. Default = false. */
  wantsToLeaveHome?: boolean;
  /** Sprint 32 Team.facilitiesLevel (1..10). Default = 5 (mid-tier). */
  facilitiesLevel?: number;
  /** Sprint 35 Team.academicsLevel (0..100). Default = 50. */
  academicsLevel?: number;
  /** Sprint 36 caller-computed pitch-reasons points (0..75). */
  pitchBonusPoints?: number;
  /** Sprint 36 caller-computed NIL points (0..200). */
  nilBonusPoints?: number;
}

export function computeRecruitTeamInterestScaled(
  recruit: RecruitInterestInput,
  team: TeamInterestInput,
  opts: ComputeRecruitTeamInterestScaledOpts = {},
): number {
  const playingTimeLevel = Math.max(0, 100 - team.commitsAtPosition * 25);
  const score100 = computeRecruitTeamInterest({
    recruit: {
      id: '',
      stars: recruit.stars,
      hometownRegion: recruit.hometownRegion,
      wantsToLeaveHome: opts.wantsToLeaveHome ?? false,
    },
    team: {
      teamId: team.teamId,
      region: team.region,
      prestigeLevel: team.prestige,
      facilitiesLevel: opts.facilitiesLevel ?? 5,
      academicsLevel: opts.academicsLevel ?? 50,
      playingTimeLevel,
    },
    priorities: opts.priorities ?? DEFAULT_PRIORITIES,
    coachIntegrity: 50,
    coaches: [
      {
        role: 'HC',
        ratingRecruit: team.coachRatingRecruit,
        ratingDevelop: 50,
        ratingStrategy: 50,
      },
    ],
    rubberbandMultiplier: 1.0,
    ...(opts.pitchBonusPoints !== undefined && { pitchBonusPoints: opts.pitchBonusPoints }),
    ...(opts.nilBonusPoints !== undefined && { nilBonusPoints: opts.nilBonusPoints }),
  });

  const floor = STAR_PRESTIGE_FLOOR[recruit.stars];
  const gap = Math.max(0, floor - team.prestige);
  const penalty = gap * STAR_FLOOR_PENALTY_WEIGHT;

  return Math.max(0, score100 * 10 - penalty);
}

/**
 * Sprint 25: Board-seeding score used by `openRecruitingCycle` to pick
 * which recruits fill each team's initial RecruitInterest board.
 *
 * Adds:
 *   1. A small stars bonus (25) so ties between equal-base recruits go
 *      to the higher-star one. Matters because the floor penalty wipes
 *      some 5-star bases on low-prestige programs.
 *   2. Deterministic per-(team, recruit) jitter to break ties on
 *      lower-tier recruits so they distribute across teams instead of
 *      clustering on id-sorted slices.
 *
 * The persisted RecruitInterest.interest stays at the unjittered base
 * (`computeRecruitTeamInterestScaled`) so Sprint 13 commit-resolution
 * semantics (`interest^5` weighting, shouldDecide thresholds) are
 * unchanged.
 */
export const STAR_BOARD_BONUS = 25;
export const BOARD_JITTER_RANGE = 40;

export function computeBoardScore(
  recruit: RecruitInterestInput & { recruitId: string },
  team: TeamInterestInput,
): number {
  const base = computeRecruitTeamInterestScaled(recruit, team);
  const stars = base + recruit.stars * STAR_BOARD_BONUS;
  // Deterministic jitter from a stable hash of teamId+recruitId. Inline
  // xmur3-style mix keeps this pure (no rng dependency). Output range:
  // [-BOARD_JITTER_RANGE/2, +BOARD_JITTER_RANGE/2].
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

/** Clamp helper for incremental interest deltas (action ticks). */
export function applyActionDelta(
  currentInterest: number,
  action: RecruitingActionType,
): number {
  const def = RECRUITING_ACTIONS[action];
  const next = currentInterest + def.delta;
  return Math.max(0, Math.min(MAX_INTEREST, next));
}
