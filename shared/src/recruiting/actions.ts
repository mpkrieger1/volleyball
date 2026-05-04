// Sprint 28 Task 28.5B: action catalog rewrite.
//
// Replaces Sprint 13's CALL/UNOFFICIAL_VISIT/HOME_VISIT/OFFICIAL_VISIT with
// 5 actions per user spec (Q4):
//   - SCOUT: reveals scout-report letter grades (no interest gain).
//   - PHONE_CALL: small interest gain, low cost.
//   - HOME_VISIT: medium interest gain.
//   - OFFER_SCHOLARSHIP: large interest gain, high cost. Once-per-recruit.
//   - CAMP_INVITE: medium-low interest gain, scales with team prestige.
//
// Costs are scaled against the new tiered budget (see budget.ts).

export const RECRUITING_ACTION_TYPES = [
  'SCOUT',
  'PHONE_CALL',
  'HOME_VISIT',
  'OFFER_SCHOLARSHIP',
  'CAMP_INVITE',
] as const;
export type RecruitingActionType = (typeof RECRUITING_ACTION_TYPES)[number];

export type RecruitingActionDef = {
  cost: number;
  delta: number;
  /** True if the action's primary effect is a scout-report reveal, not interest. */
  scoutOnly: boolean;
};

export const RECRUITING_ACTIONS: Record<RecruitingActionType, RecruitingActionDef> = {
  SCOUT: { cost: 3, delta: 0, scoutOnly: true },
  PHONE_CALL: { cost: 2, delta: 30, scoutOnly: false },
  HOME_VISIT: { cost: 10, delta: 120, scoutOnly: false },
  OFFER_SCHOLARSHIP: { cost: 15, delta: 200, scoutOnly: false },
  CAMP_INVITE: { cost: 6, delta: 70, scoutOnly: false },
};

export const RECRUITING_ACTION_LABELS: Record<RecruitingActionType, string> = {
  SCOUT: 'Scout',
  PHONE_CALL: 'Phone Call',
  HOME_VISIT: 'Home Visit',
  OFFER_SCHOLARSHIP: 'Offer Scholarship',
  CAMP_INVITE: 'Camp Invite',
};

/** Default base budget; overridden per team via deriveWeeklyBudget(). */
export const WEEKLY_BUDGET = 50;
