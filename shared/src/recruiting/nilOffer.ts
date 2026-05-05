// Sprint 36 Task 36.3 — NIL offer-to-points conversion.
//
// Port-adapted from FCCD module 64485:
//   priorityWeight = max(1, priorities.nilDeal)
//   baseline       = NIL_BASELINE_CENTS[recruit.stars]
//   ratio          = offerCents / baseline
//   points         = round(75 × priorityWeight × ratio)
//   cap            = MAX_NIL_POINTS = 200 (below FCCD's untyped result to
//                                          keep NIL from dominating).

import type { RecruitPriorities } from './priorityModel';

export type StarTier = 1 | 2 | 3 | 4 | 5;

/** Baseline NIL offer per star tier (in cents). $250k for 5★, $5k for 1★. */
export const NIL_BASELINE_CENTS: Record<StarTier, number> = {
  5: 25_000_000,
  4: 10_000_000,
  3: 4_000_000,
  2: 1_500_000,
  1: 500_000,
};

/** Sprint 36 cap on NIL bonus points. Combined cap with pitch reasons
 *  is `MAX_BONUS_POINTS = 150` enforced inside `computeRecruitTeamInterest`. */
export const MAX_NIL_POINTS = 200;

/** Stars-based baseline NIL offer (cents). Defaults to 1★ baseline if
 *  stars is out of range. */
export function getNilOfferBaselineCents(recruit: { stars: number }): number {
  const tier = (Math.min(5, Math.max(1, Math.round(recruit.stars))) as StarTier);
  return NIL_BASELINE_CENTS[tier];
}

const NIL_POINTS_FACTOR = 75;

export function convertNilOfferToPoints(args: {
  offerCents: number;
  recruit: { stars: number };
  priorities: RecruitPriorities;
}): number {
  if (args.offerCents <= 0) return 0;
  const priorityWeight = Math.max(1, args.priorities.nilDeal);
  const baseline = getNilOfferBaselineCents(args.recruit);
  if (baseline <= 0) return 0;
  const ratio = args.offerCents / baseline;
  const raw = Math.round(NIL_POINTS_FACTOR * priorityWeight * ratio);
  return Math.max(0, Math.min(MAX_NIL_POINTS, raw));
}
