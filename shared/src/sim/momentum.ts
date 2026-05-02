// Match-level momentum state. One scalar per team in [-1.0, +1.0]. Evolves
// after each point; clamped on every update. Feeds a small bias into attack
// probabilities to produce visible "runs" in sim output without dominating
// the underlying rating math.

import { z } from 'zod';
import type { TeamSide } from './lineup';
import { TUNING } from './tuning';

export const MomentumStateSchema = z.object({
  home: z.number().min(-1).max(1),
  away: z.number().min(-1).max(1),
  lastWinner: z.enum(['home', 'away']).nullable(),
  runLength: z.number().int().nonnegative(),
});
export type MomentumState = z.infer<typeof MomentumStateSchema>;

const clamp = (v: number): number => Math.max(-1, Math.min(1, v));

export function initialMomentum(): MomentumState {
  return { home: 0, away: 0, lastWinner: null, runLength: 0 };
}

/**
 * Update momentum after a point. Winning a point nudges the winner's momentum
 * upward and the opponent's downward. A 3+ point run adds the run bonus on top.
 */
export function updateOnPoint(state: MomentumState, winner: TeamSide): MomentumState {
  const runLength = state.lastWinner === winner ? state.runLength + 1 : 1;
  const delta =
    TUNING.MOMENTUM_PER_POINT + (runLength >= 3 ? TUNING.MOMENTUM_RUN_BONUS : 0);
  return {
    home: clamp(winner === 'home' ? state.home + delta : state.home - delta),
    away: clamp(winner === 'away' ? state.away + delta : state.away - delta),
    lastWinner: winner,
    runLength,
  };
}

/**
 * A timeout called by `teamCallingTimeout` reduces the OPPOSITE team's momentum
 * magnitude by TIMEOUT_MOMENTUM_RESET_FACTOR. Own momentum is unchanged.
 */
export function resetOnTimeout(
  state: MomentumState,
  teamCallingTimeout: TeamSide,
): MomentumState {
  const opposite: TeamSide = teamCallingTimeout === 'home' ? 'away' : 'home';
  const shrunk = state[opposite] * (1 - TUNING.TIMEOUT_MOMENTUM_RESET_FACTOR);
  return {
    ...state,
    [opposite]: shrunk,
    // Reset run-length too — the timeout narratively "breaks" the run.
    runLength: 0,
  } as MomentumState;
}

/**
 * Attack-probability bias for the attacking team in [-BIAS_MAX, +BIAS_MAX].
 * Positive momentum → slight kill-rate boost; negative → slight penalty.
 */
export function attackMomentumBonus(
  state: MomentumState,
  attackingTeam: TeamSide,
): number {
  const m = attackingTeam === 'home' ? state.home : state.away;
  return m * TUNING.MOMENTUM_ATTACK_BIAS_MAX;
}

/** True when the winning team has taken ≥ MOMENTUM_SWING_THRESHOLD since a prior state. */
export function swingOccurred(prev: MomentumState, curr: MomentumState): boolean {
  const dHome = Math.abs(curr.home - prev.home);
  const dAway = Math.abs(curr.away - prev.away);
  return Math.max(dHome, dAway) >= TUNING.MOMENTUM_SWING_THRESHOLD;
}
