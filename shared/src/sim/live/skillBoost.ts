// Sprint 30 Task 30.2: skill-talk boost engine.
//
// User calls a timeout AND picks a skill (serve/pass/attack/block/dig/set).
// That team's chosen skill rating is multiplied by 1.05 for the next N
// "match points" (= rallies played by either team), where:
//
//   N = max(7, 5 + round(HC.strategy / 10))
//
// HC.strategy spans 0..100 → N spans 7..15.
//
// Boost decrements by 1 each rally. Clears at N === 0. A second timeout
// with a different skill REPLACES the existing boost (not stacking same-team).
//
// Stacks MULTIPLICATIVELY with live-mode momentum bonus
// (sim.liveSkillMultiplier from Sprint 29 Task 29.2):
//   effective = momentumMult × boostMult
// e.g. +3 momentum (1.025) × attack-talk (1.05) = 1.07625

import type { LiveMatchState, ActiveBoost, SkillKey, TeamSide } from './state';
import { liveSkillMultiplier } from './momentum';

/** Per-skill boost multiplier when the team has skill-talked that skill. */
export const SKILL_BOOST_MULT = 1.05;

/** Floor on boost duration regardless of HC.strategy. */
export const SKILL_BOOST_DURATION_FLOOR = 7;

/**
 * Compute boost duration in points from a head coach's strategy rating.
 * Returns max(floor, 5 + round(strategy/10)).
 */
export function boostDurationFor(hcStrategy: number): number {
  const raw = 5 + Math.round(hcStrategy / 10);
  return Math.max(SKILL_BOOST_DURATION_FLOOR, raw);
}

/**
 * Build a fresh ActiveBoost for the given team, skill, and HC.strategy.
 * Sprint 30 callers: applyUserTimeout in userTimeout.ts.
 */
export function createBoost(team: TeamSide, skill: SkillKey, hcStrategy: number): ActiveBoost {
  return {
    team,
    skill,
    pointsRemaining: boostDurationFor(hcStrategy),
  };
}

/**
 * Effective multiplier for a single (team, skill) cell, combining the
 * live-momentum tier multiplier with the skill-talk boost (if any).
 *
 * - When useLiveMomentum is false → momentum component is 1.0
 * - When activeBoost is null OR for a different (team, skill) → boost is 1.0
 * - Otherwise both components stack multiplicatively.
 */
export function effectiveSkillMultiplier(
  state: LiveMatchState,
  team: TeamSide,
  skill: SkillKey,
): number {
  const momMult = state.useLiveMomentum
    ? liveSkillMultiplier(team === 'home' ? state.liveMomentum.home : state.liveMomentum.away)
    : 1.0;
  const boostMult = state.activeBoost && state.activeBoost.team === team && state.activeBoost.skill === skill
    ? SKILL_BOOST_MULT
    : 1.0;
  return momMult * boostMult;
}

/**
 * Build the per-team per-skill multiplier matrix for one rally. Used by
 * step.ts to pre-multiply lineup ratings before passing to the rally FSM.
 *
 * Returns the SAME 1.0 baseline for every cell when both momentum and
 * boost are inactive — preserves byte-equality with simulateMatch.
 */
export type TeamSkillMultipliers = Record<SkillKey, number>;

export function buildSkillMultipliers(state: LiveMatchState, team: TeamSide): TeamSkillMultipliers {
  return {
    serve: effectiveSkillMultiplier(state, team, 'serve'),
    pass: effectiveSkillMultiplier(state, team, 'pass'),
    attack: effectiveSkillMultiplier(state, team, 'attack'),
    block: effectiveSkillMultiplier(state, team, 'block'),
    dig: effectiveSkillMultiplier(state, team, 'dig'),
    set: effectiveSkillMultiplier(state, team, 'set'),
  };
}

/**
 * Decrement the active boost's pointsRemaining by 1. Clears the boost
 * (sets activeBoost = null) when pointsRemaining reaches 0.
 *
 * Called once per rally by step.ts AFTER the rally plays.
 */
export function decrementBoost(state: LiveMatchState): LiveMatchState {
  if (!state.activeBoost) return state;
  const next = state.activeBoost.pointsRemaining - 1;
  if (next <= 0) {
    return { ...state, activeBoost: null };
  }
  return {
    ...state,
    activeBoost: { ...state.activeBoost, pointsRemaining: next },
  };
}

/**
 * Returns true iff every multiplier in the matrix is exactly 1.0
 * (no momentum bonus, no boost). Used by the rally engine for a
 * fast-path skip when no scaling is needed.
 */
export function isUnitMultiplier(m: TeamSkillMultipliers): boolean {
  return (
    m.serve === 1.0 && m.pass === 1.0 && m.attack === 1.0 &&
    m.block === 1.0 && m.dig === 1.0 && m.set === 1.0
  );
}
