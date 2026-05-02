// Sprint 13: recruiting action catalog.
//
// Each action costs `cost` points out of a weekly `WEEKLY_BUDGET` pool
// and raises a recruit's interest by `delta` (scaled 0–1000 int). Balance
// is tunable; Sprint 14+ may add coach-recruit-rating modifiers.

export const RECRUITING_ACTION_TYPES = [
  'CALL',
  'UNOFFICIAL_VISIT',
  'HOME_VISIT',
  'OFFICIAL_VISIT',
] as const;
export type RecruitingActionType = (typeof RECRUITING_ACTION_TYPES)[number];

export type RecruitingActionDef = { cost: number; delta: number };

export const RECRUITING_ACTIONS: Record<RecruitingActionType, RecruitingActionDef> = {
  CALL: { cost: 2, delta: 30 },
  UNOFFICIAL_VISIT: { cost: 5, delta: 70 },
  HOME_VISIT: { cost: 10, delta: 120 },
  OFFICIAL_VISIT: { cost: 15, delta: 180 },
};

/** Points available per recruiting week per user team. */
export const WEEKLY_BUDGET = 50;
