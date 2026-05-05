// Sprint 31 Task 31.4: key-rally detector for the smart-pause banner.
//
// Set point: either team is one rally away from winning the set AND
// leads by ≥ 1. (Win-by-2 means leading by exactly 1 at target-1 still
// counts as set point because the very next rally COULD win it.)
//
// Match point: set point in a context where the leader could win the
// match by winning this set (i.e. they have setsToWin - 1 sets already).
//
// Pure function — pure read of state. No side effects. Used by:
//   - liveMatchService.smartPauseReason → adds 'key_rally' trigger
//   - LivePlayHub renders a banner pre-rally (Continue / Call timeout)

import type { LiveMatchState } from './state';

const SETS_TO_WIN = 3;

export type KeyRallyResult = {
  setPoint: boolean;
  matchPoint: boolean;
  /** Which side has the set/match point. null when neither does. */
  leader: 'home' | 'away' | null;
};

export function isKeyRally(state: LiveMatchState): KeyRallyResult {
  if (state.status === 'finished') return { setPoint: false, matchPoint: false, leader: null };
  const { home, away, targetScore } = state.currentSet;
  const leader: 'home' | 'away' | null = home > away ? 'home' : away > home ? 'away' : null;
  if (!leader) return { setPoint: false, matchPoint: false, leader: null };

  const leaderScore = leader === 'home' ? home : away;
  const trailerScore = leader === 'home' ? away : home;

  // Set point: leader has reached at least target-1 AND leads by ≥ 1.
  // Note: at scores like 24-23, the leader could win on the next rally; at
  // 25-25 (deuce), neither side can — both >= target but only by 0.
  const setPoint = leaderScore >= targetScore - 1 && leaderScore - trailerScore >= 1;

  // Match point: setPoint AND leader is one set short of winning.
  const leaderSetsWon = leader === 'home' ? state.setsWon.home : state.setsWon.away;
  const matchPoint = setPoint && leaderSetsWon === SETS_TO_WIN - 1;

  return { setPoint, matchPoint, leader };
}
