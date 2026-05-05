// Sprint 30 Task 30.1: user-driven timeout application.
//
// User clicks "Call Timeout" → optionally picks a skill in the talk modal
// → IPC → service calls applyUserTimeout. Updates state in-place (no rally
// played); returns the new state + the action log entry for persistence.
//
// Rules:
//   - Caller's userTeam must be 'home' or 'away' (not 'none').
//   - Caller's TimeoutLedger.remaining must be > 0 (NCAA 2/set cap).
//   - Opponent's continuous momentum is halved via existing
//     sim.resetOnTimeout (TIMEOUT_MOMENTUM_RESET_FACTOR=0.5).
//   - If a skill is provided, replaces any existing activeBoost with a
//     fresh one for (userTeam, skill, boostDurationFor(hcStrategy)).
//   - Appends a CoachAction{kind:'timeout', team, rallyIndex, skill?} to
//     coachActionLog at rallyIndex = current rallyCursor.

import { attemptTimeout } from '../timeout';
import { resetOnTimeout as resetMomentumOnTimeout } from '../momentum';
import { createBoost } from './skillBoost';
import type { LiveMatchState, SkillKey, CoachAction } from './state';

export type ApplyUserTimeoutOk = {
  ok: true;
  state: LiveMatchState;
  action: Extract<CoachAction, { kind: 'timeout' }>;
};
export type ApplyUserTimeoutErr = {
  ok: false;
  code: 'NO_USER_TEAM' | 'NO_TIMEOUTS_LEFT' | 'INVALID_STATE';
  message: string;
};
export type ApplyUserTimeoutResult = ApplyUserTimeoutOk | ApplyUserTimeoutErr;

export type ApplyUserTimeoutInput = {
  /**
   * Head coach's strategy rating (0..100). Used for skill-boost duration.
   * The service caches this in the registry entry at startLiveMatch time;
   * 50 (default Coach.ratingStrategy) is the safe fallback.
   */
  hcStrategy: number;
  /** Optional skill to talk about. When undefined, no boost is applied. */
  skill?: SkillKey;
};

export function applyUserTimeout(
  state: LiveMatchState,
  input: ApplyUserTimeoutInput,
): ApplyUserTimeoutResult {
  if (state.status === 'finished') {
    return { ok: false, code: 'INVALID_STATE', message: 'match is finished' };
  }
  if (state.userTeam === 'none') {
    return {
      ok: false,
      code: 'NO_USER_TEAM',
      message: 'no user team set; cannot call user timeout',
    };
  }
  const team = state.userTeam;

  const myTimeouts = team === 'home' ? state.timeoutsHome : state.timeoutsAway;
  const res = attemptTimeout(myTimeouts, state.currentSet.rallyIdxInSet);
  if (!res.ok) {
    return {
      ok: false,
      code: 'NO_TIMEOUTS_LEFT',
      message: res.message,
    };
  }

  const newMomentum = resetMomentumOnTimeout(state.momentum, team);
  const newActiveBoost = input.skill
    ? createBoost(team, input.skill, input.hcStrategy)
    : state.activeBoost; // null → null when no skill provided

  const action: Extract<CoachAction, { kind: 'timeout' }> = {
    kind: 'timeout',
    team,
    rallyIndex: state.rallyCursor,
    ...(input.skill ? { skill: input.skill } : {}),
  };

  const newState: LiveMatchState = {
    ...state,
    momentum: newMomentum,
    timeoutsHome: team === 'home' ? res.ledger : state.timeoutsHome,
    timeoutsAway: team === 'away' ? res.ledger : state.timeoutsAway,
    activeBoost: newActiveBoost,
    coachActionLog: [...state.coachActionLog, action],
  };

  return { ok: true, state: newState, action };
}
