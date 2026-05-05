// Sprint 30 Task 30.3: lightweight fatigue model used by AI sub decisions.
//
// fatigue = setsPlayed * 0.5 + ralliesPlayedThisSet * 0.02
//
// Range: 0 (fresh) → ~3+ (deep into match 5). Threshold for AI subs is
// > 2.0 (locked in spec). Pure formula; no random draws.

import type { LiveMatchState, BenchPlayer, TeamSide } from './state';

export const FATIGUE_PER_SET = 0.5;
export const FATIGUE_PER_RALLY = 0.02;
export const AI_SUB_FATIGUE_THRESHOLD = 2.0;

export type FatigueInput = {
  setsPlayed: number;
  ralliesPlayedThisSet: number;
};

export function computeFatigue(input: FatigueInput): number {
  return input.setsPlayed * FATIGUE_PER_SET + input.ralliesPlayedThisSet * FATIGUE_PER_RALLY;
}

/**
 * Approximate per-slot on-court fatigue from match-level state. Every
 * starter accumulates one rally per rally played in the current set (no
 * sub tracking yet — Sprint 31+ refines per-player tracking).
 */
export function fatigueForOnCourt(state: LiveMatchState): number {
  return computeFatigue({
    setsPlayed: state.completedSets.length,
    ralliesPlayedThisSet: state.currentSet.rallyIdxInSet,
  });
}

/** True iff the AI's sub-decision threshold is exceeded for this team. */
export function teamShouldConsiderSub(state: LiveMatchState, _team: TeamSide): boolean {
  // Sprint 30: simple per-team threshold; ignores per-player fatigue tracking.
  // Per-player tracking lands when subs change the bench composition mid-match.
  return fatigueForOnCourt(state) >= AI_SUB_FATIGUE_THRESHOLD;
}

/** Pick the freshest bench player for the requested position (lowest fatigue). */
export function pickFreshestBenchAtPosition(
  bench: readonly BenchPlayer[],
  position: string,
): BenchPlayer | null {
  const candidates = bench.filter((b) => b.position === position && !b.isLibero);
  if (candidates.length === 0) return null;
  // Sprint 30: bench fatigue defaults to 0 (no per-player history yet).
  // Tiebreak by playerId for determinism.
  return [...candidates].sort((a, b) => a.playerId.localeCompare(b.playerId))[0] ?? null;
}
