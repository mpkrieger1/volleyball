// Sprint 36 Task 36.6 — AI recruiting heuristic.
//
// Given a non-user team's current state, plan the per-tick decisions:
//   1. NIL allocation across top-10 board recruits (proportional to
//      headroom × stars; trailing teams can over-allocate one moonshot).
//   2. Pitch-reasons auto-apply (always-on for AI; baked into the
//      interest re-computation by the IPC layer / advanceRecruitingWeek
//      which calls computePitchReasons + passes the bonus to the
//      priority helper).
//
// Pure planner — no IO. Returns a list of write specs that the caller
// applies via $transaction array form.

const TOP_N = 10;
const TRAILING_THRESHOLD = 0.5;
const MOONSHOT_OFFER_MULT = 1.5;

export interface AiBoardEntry {
  recruitId: string;
  stars: number;
  currentInterest: number;
  baselineNilCents: number;
}

export interface AiPlanArgs {
  teamId: string;
  nilBudgetCents: number;
  nilBudgetUsedCents: number;
  /** Top-10 board recruits (already sorted by interest desc). */
  topRecruits: AiBoardEntry[];
  /** Highest current-leader interest across all teams' top boards (for trailing-detect). */
  leaderInterest: number;
}

export interface AiNilPlan {
  recruitId: string;
  newOfferCents: number;
}

/**
 * Plan NIL allocation. Pure: given budget + top-10 + leader info, return
 * how many cents to put on each recruit. Caller computes the write delta
 * vs. existing offers.
 */
export function planNilAllocation(args: AiPlanArgs): AiNilPlan[] {
  const remaining = Math.max(0, args.nilBudgetCents - args.nilBudgetUsedCents);
  if (remaining <= 0 || args.topRecruits.length === 0) return [];
  const top = args.topRecruits.slice(0, TOP_N);

  // Compute headroom × stars per recruit.
  const MAX_INTEREST = 1000;
  const headroomScores = top.map((r) => ({
    recruitId: r.recruitId,
    score: Math.max(0, MAX_INTEREST - r.currentInterest) * Math.max(1, r.stars),
    baseline: r.baselineNilCents,
  }));
  const totalScore = headroomScores.reduce((a, b) => a + b.score, 0);

  // Trailing-team detection: my top recruit's interest is < 50% of leader's.
  const myTopInterest = top[0]?.currentInterest ?? 0;
  const trailing = args.leaderInterest > 0 && myTopInterest < TRAILING_THRESHOLD * args.leaderInterest;

  const plans: AiNilPlan[] = [];
  if (trailing) {
    // Moonshot: dump the budget onto the top-1 recruit, capped at 1.5× baseline.
    const tgt = top[0]!;
    const cap = Math.round(tgt.baselineNilCents * MOONSHOT_OFFER_MULT);
    plans.push({
      recruitId: tgt.recruitId,
      newOfferCents: Math.min(remaining, cap),
    });
    return plans;
  }

  // Normal allocation: proportional to headroom score, capped at 1.0× baseline.
  if (totalScore <= 0) return plans;
  for (const h of headroomScores) {
    const share = h.score / totalScore;
    const proposed = Math.round(remaining * share);
    const cap = h.baseline; // 1.0× baseline ceiling
    plans.push({
      recruitId: h.recruitId,
      newOfferCents: Math.min(proposed, cap),
    });
  }
  return plans;
}
