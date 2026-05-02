// Sprint 14: portal pursuit + NIL leverage.
//
// Actions mirror recruiting (CALL/UNOFFICIAL/HOME/OFFICIAL) PLUS a new
// OFFER_NIL action that adds interest proportional to the offer amount.
// Weekly budget is tighter than recruiting's (30 vs 50) because the
// portal cycle is shorter (6 weeks vs 12).

import { RECRUITING_ACTIONS } from '../recruiting/actions';
import { MAX_INTEREST } from '../recruiting/interestModel';

export const PORTAL_ACTION_TYPES = [
  'CALL',
  'UNOFFICIAL_VISIT',
  'HOME_VISIT',
  'OFFICIAL_VISIT',
  'OFFER_NIL',
] as const;
export type PortalActionType = (typeof PORTAL_ACTION_TYPES)[number];

export type PortalActionDef = { cost: number; delta: number };

/**
 * Point costs for portal actions. OFFER_NIL is free in weekly points
 * but constrained by the team's NIL cap (Sprint 15 booster budget).
 */
export const PORTAL_ACTIONS: Record<Exclude<PortalActionType, 'OFFER_NIL'>, PortalActionDef> = {
  CALL: RECRUITING_ACTIONS.CALL,
  UNOFFICIAL_VISIT: RECRUITING_ACTIONS.UNOFFICIAL_VISIT,
  HOME_VISIT: RECRUITING_ACTIONS.HOME_VISIT,
  OFFICIAL_VISIT: RECRUITING_ACTIONS.OFFICIAL_VISIT,
};

export const OFFER_NIL_COST = 0;

export const PORTAL_WEEKLY_BUDGET = 30;
/** Season-wide NIL cap per team (cents). Sprint 15 replaces with Booster. */
export const PORTAL_NIL_CAP_CENTS = 50_000_00; // $50,000

/**
 * NIL offer → interest bump. Linear up to +300 at $30k. Top-quartile NIL
 * (≥ $20k) produces a ≥200-point bump, enough to overcome a peer team's
 * typical CALL-tick deltas for several weeks.
 */
export function applyNilBump(currentInterest: number, nilAmountCents: number): number {
  const dollars = nilAmountCents / 100;
  const bump = Math.min(300, Math.round(dollars / 100));
  return Math.max(0, Math.min(MAX_INTEREST, currentInterest + bump));
}

/**
 * Base interest for a team pursuing a portal player. Mirrors
 * `computeBaseInterest` from recruiting but the inputs are different:
 * portal targets don't have star ratings or hometowns in our model.
 */
export type PortalTeamLike = {
  teamId: string;
  prestige: number;
  coachRatingRecruit: number;
};

export type PortalPlayerLike = {
  overall: number;
};

export const PORTAL_PRESTIGE_WEIGHT = 3.0;
export const PORTAL_COACH_WEIGHT = 1.0;

/** Returns int 0..250 base interest. */
export function computePortalBaseInterest(
  player: PortalPlayerLike,
  team: PortalTeamLike,
): number {
  // Good players naturally get more interest everywhere. Higher overall
  // → every pursuing team starts with a bump.
  const overallBump = Math.max(0, player.overall - 50) * 1.2;
  const score =
    team.prestige * PORTAL_PRESTIGE_WEIGHT +
    team.coachRatingRecruit * PORTAL_COACH_WEIGHT +
    overallBump;
  return Math.max(0, Math.round(score));
}
