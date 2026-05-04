// Sprint 28 Task 28.5B: weekly budget scales with the team's coaching staff.
// Q5 from design-doc review: pool = HC base + AHC bonus + AC bonus.
// Empty assistant slots reduce the pool — incentive to keep staff filled.

import type { RecruitingActionType } from './actions';

export type StaffRecruitRatings = {
  hcRecruit: number | null;
  ahcRecruit: number | null;
  acRecruit: number | null;
};

const BASE_POINTS = 20;
const HC_DIVISOR = 5;
const AHC_DIVISOR = 10;
const AC_DIVISOR = 15;

/**
 * Compute weekly recruiting budget for a team.
 *
 * Total = BASE_POINTS + HC.recruit/HC_DIVISOR + AHC.recruit/AHC_DIVISOR + AC.recruit/AC_DIVISOR.
 * Missing assistants contribute 0. HC missing is unusual (HC-always-filled
 * invariant) — if it happens, treat as 0.
 *
 * Ratings ~50–95 give totals roughly in [30, 50] points.
 */
export function deriveWeeklyBudget(staff: StaffRecruitRatings): {
  total: number;
  breakdown: { base: number; hc: number; ahc: number; ac: number };
} {
  const base = BASE_POINTS;
  const hc = staff.hcRecruit ? Math.round(staff.hcRecruit / HC_DIVISOR) : 0;
  const ahc = staff.ahcRecruit ? Math.round(staff.ahcRecruit / AHC_DIVISOR) : 0;
  const ac = staff.acRecruit ? Math.round(staff.acRecruit / AC_DIVISOR) : 0;
  return {
    total: base + hc + ahc + ac,
    breakdown: { base, hc, ahc, ac },
  };
}

export type ActionAffordability = {
  action: RecruitingActionType;
  cost: number;
  affordable: boolean;
};
