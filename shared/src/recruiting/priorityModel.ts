// Sprint 35 — FCCD-style priority-driven recruiting interest model.
//
// Port of FCCD modules 1392 (`derivePriorityLevels`) + 61861
// (`getRecruitTeamInterestScore`). The legacy `computeBaseInterest` is
// retained as a deprecated wrapper for one sprint to avoid breaking
// portal pursuit + dynasty smoke tests; Sprint 36 deletes it.
//
// Pure module — no IO, no Prisma. Consumed by `openRecruitingCycle`,
// `advanceRecruitingWeek`, `closeRecruitingCycle`, and the Sprint 36 UI.

import { createRng, type Rng } from '../rng';
import { pickCoachRating, type CoachLike } from '../coaching/roleEffect';
import type { Region } from './types';
import { getRecruiterQuality, RECRUITER_QUALITY_MULTIPLIER } from './recruiterQuality';

export type RecruitPriorityKey =
  | 'playingTime'
  | 'proximityToHome'
  | 'prestige'
  | 'facilities'
  | 'nilDeal';

export interface RecruitPriorities {
  /** All values are 0..10. Higher = recruit cares more. */
  playingTime: number;
  proximityToHome: number;
  prestige: number;
  facilities: number;
  nilDeal: number;
}

export interface PriorityRecruit {
  id: string;
  stars: 1 | 2 | 3 | 4 | 5;
  hometownRegion: Region | string;
  wantsToLeaveHome: boolean;
}

export interface TeamAttributeLevels {
  teamId: string;
  region: Region | string;
  /** Team.prestige passed through (already 0..100). */
  prestigeLevel: number;
  /** Sprint 32 Team.facilitiesLevel (1..10). Mapped to 0..100 in derivePriorityLevels. */
  facilitiesLevel: number;
  /** Sprint 35 Team.academicsLevel (0..100). Reserved priority slot — not weighted in v1.2. */
  academicsLevel: number;
  /** Computed by `computePlayingTimeLevel` from roster outlook (0..100). */
  playingTimeLevel: number;
}

/**
 * Map (recruit, team) to per-priority levels in [0, 100]. The recruit's
 * priorities multiply against these to produce the final interest score.
 */
export function derivePriorityLevels(
  recruit: PriorityRecruit,
  team: TeamAttributeLevels,
): Record<RecruitPriorityKey, number> {
  const sameRegion = recruit.hometownRegion === team.region;
  // Default polarity: same region → high proximity score.
  // wantsToLeaveHome flips polarity (recruit penalizes home-region teams).
  let proximity = sameRegion ? 100 : 0;
  if (recruit.wantsToLeaveHome) {
    proximity = 100 - proximity;
  }

  return {
    playingTime: clamp(team.playingTimeLevel, 0, 100),
    proximityToHome: proximity,
    prestige: clamp(team.prestigeLevel, 0, 100),
    facilities: clamp(team.facilitiesLevel * 10, 0, 100), // 1..10 → 10..100
    // nilDeal is ignored in v1.2 — Sprint 36 wires it via Team NIL pool.
    nilDeal: 0,
  };
}

/**
 * FCCD priority sort weights (module 61861). Higher weight = more
 * influence on the final dot product.
 */
const PRIORITY_WEIGHTS: Record<RecruitPriorityKey, number> = {
  prestige: 4,
  playingTime: 3,
  proximityToHome: 2,
  facilities: 1,
  nilDeal: 1,
};

export interface ComputeInterestArgs {
  recruit: PriorityRecruit;
  team: TeamAttributeLevels;
  priorities: RecruitPriorities;
  /** 0..100; v1.2 default 50 (no integrity modifier). Sprint 36 may surface. */
  coachIntegrity: number;
  /** Team's coach roster — pickCoachRating selects the recruiting-effect coach. */
  coaches: CoachLike[];
  /** 1.0 by default; Sprint 36 wires the FCCD rubberband catch-up curve. */
  rubberbandMultiplier: number;
  /** Sprint 36: pitch-reasons total (0..75); caller-computed via computePitchReasons. */
  pitchBonusPoints?: number;
  /** Sprint 36: NIL bonus (0..200); caller-computed via convertNilOfferToPoints. */
  nilBonusPoints?: number;
}

/** Sprint 36: combined cap for pitch-reasons + NIL bonus add-ins. */
export const MAX_BONUS_POINTS = 150;

/**
 * Resolved interest score in [0, 100]. Used as the BASE for board seeding,
 * weekly recompute, and final commit resolution. Persisted earned points
 * (RecruitInterest.interest field) ride on top of this.
 *
 * Sprint 36: optional `pitchBonusPoints` and `nilBonusPoints` add-ins
 * (caller-computed) flow through the same clamp. The combined add-ins
 * cap at MAX_BONUS_POINTS=150; pitch reasons separately cap at 75
 * (`MAX_TOTAL_PITCH_BONUS` in pitchReasons.ts) and NIL at 200
 * (`MAX_NIL_POINTS` in nilOffer.ts).
 */
export function computeRecruitTeamInterest(args: ComputeInterestArgs): number {
  const levels = derivePriorityLevels(args.recruit, args.team);

  // Skip nilDeal in v1.2 priority dot product (NIL is a separate bonus
  // add-in via `nilBonusPoints`). The other 4 priorities contribute.
  const keys: RecruitPriorityKey[] = ['playingTime', 'proximityToHome', 'prestige', 'facilities'];
  let total = 0;
  let weight = 0;
  for (const k of keys) {
    const p = args.priorities[k];
    const w = PRIORITY_WEIGHTS[k];
    weight += p * w;
    total += levels[k] * p * w;
  }
  const noPriorities = weight <= 0 || total <= 0;
  // Coach integrity modulates the raw score (FCCD's `coachIntegrity` field).
  // v1.2 defaults to 50; integrityMod = 0..1.
  const integrityMod = clamp(args.coachIntegrity, 0, 100) / 100;
  let raw = noPriorities ? 0 : (total / weight) * integrityMod;

  // Sprint 36: Coach.ratingRecruit + recruiter-quality multiplier.
  // pickCoachRating returns the BEST coach for the recruiting effect; the
  // RECRUITER_QUALITY_MULTIPLIER then scales the coach's contribution.
  const coachRecruit = pickCoachRating(args.coaches, 'recruiting');
  const quality = getRecruiterQuality(coachRecruit);
  const qualityMult = RECRUITER_QUALITY_MULTIPLIER[quality];
  // Re-anchor at 1.0 mediocre baseline so existing calibration holds:
  // base coachMod 0.9..1.1, scaled by quality multiplier (mediocre=1.0).
  const coachMod = (0.9 + (coachRecruit / 100) * 0.2) * (0.5 + 0.5 * qualityMult);
  raw *= coachMod * args.rubberbandMultiplier;

  // Sprint 36: pitch + NIL bonus add-ins, jointly capped.
  const pitch = clamp(args.pitchBonusPoints ?? 0, 0, MAX_BONUS_POINTS);
  const nil = clamp(args.nilBonusPoints ?? 0, 0, MAX_BONUS_POINTS);
  const totalBonus = clamp(pitch + nil, 0, MAX_BONUS_POINTS);

  return clamp(Math.round(raw + totalBonus), 0, 100);
}

/**
 * Sample priorities for a generated recruit. Box-Muller per component
 * with mean=5, sd=2; clipped to [0, 10]. wantsToLeaveHome flips at 15%.
 */
export function sampleRecruitPriorities(
  rng: Rng,
): { priorities: RecruitPriorities; wantsToLeaveHome: boolean } {
  const sample = (): number => {
    // Box-Muller: two uniform samples → one normal sample.
    const u1 = Math.max(rng.next(), 1e-12);
    const u2 = rng.next();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return clamp(Math.round(5 + 2 * z), 0, 10);
  };
  return {
    priorities: {
      playingTime: sample(),
      proximityToHome: sample(),
      prestige: sample(),
      facilities: sample(),
      nilDeal: sample(),
    },
    wantsToLeaveHome: rng.next() < 0.15,
  };
}

/**
 * Deterministic per-recruit priorities. Used by the legacy backfill
 * (`backfillRecruitingCore`) so save-reload produces the same priorities.
 */
export function priorityFromId(
  id: string,
): { priorities: RecruitPriorities; wantsToLeaveHome: boolean } {
  return sampleRecruitPriorities(createRng(`recruit-priorities:${id}`));
}

function clamp(x: number, lo: number, hi: number): number {
  if (x < lo) return lo;
  if (x > hi) return hi;
  return x;
}
