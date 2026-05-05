// Sprint 29 Task 29.1: full-match driver via incremental rally steps.
//
// `simulateMatchLive` is the live-mode equivalent of workers' `simulateMatch`:
// runs an entire match to completion using `simulateRallyStep`. With no
// coach inputs (Sprint 29: there are none), it MUST produce byte-identical
// rally outputs to `simulateMatch` for the same seed + team state, which
// keeps calibration determinism.
//
// Used by:
//   - tests (byte-equality with simulateMatch)
//   - Sprint 29 Task 29.5 "Sim Rest" IPC (drives an in-progress live match
//     to the end with no further user input)

import { sim } from '@vcd/shared';
import { simulateRallyStep } from './step';
import type { MatchResult } from '../match';
import type { SetResult, TeamMatchState } from '../set';

type LiveMatchState = sim.LiveMatchState;
type TeamLiveState = sim.TeamLiveState;
const { createLiveMatchState } = sim;

/** Mirror of `SimulateMatchInput` from workers' one-shot driver. */
export type SimulateMatchLiveInput = {
  seed: number | string;
  matchId?: string;
  home: TeamMatchState;
  away: TeamMatchState;
  initialServer: sim.TeamSide;
  useCoachAi?: boolean;
};

/** Convert workers' TeamMatchState (libero may be undefined) into TeamLiveState (libero strictly nullable).
 * Sprint 30: TeamLiveState gained playerIdsBySlot + bench. The byte-equality
 * test path doesn't need real player ids — empty strings suffice (the rally
 * engine only reads lineup.players ratings, never player ids).
 */
function toLive(t: TeamMatchState): TeamLiveState {
  return {
    lineup: t.lineup,
    rotation: t.rotation,
    libero: t.libero ?? null,
    setterIndex: t.setterIndex,
    playerIdsBySlot: ['', '', '', '', '', ''],
    bench: [],
    tacticalHint: 'balanced', // Sprint 31: default; sim-only path doesn't use positional rules anyway
    ...(t.system && { system: t.system }),
  };
}

/**
 * Drive a live match to completion. Returns BOTH the final LiveMatchState
 * (for callers that want richer post-state) AND a workers-compatible
 * MatchResult (for callers that need the same shape simulateMatch returns).
 */
export function simulateMatchLive(input: SimulateMatchLiveInput): {
  finalState: LiveMatchState;
  match: MatchResult;
} {
  let state = createLiveMatchState({
    matchId: input.matchId ?? `live-${input.seed}`,
    seed: input.seed,
    home: toLive(input.home),
    away: toLive(input.away),
    initialServer: input.initialServer,
    useCoachAi: input.useCoachAi ?? false,
    userTeam: 'none',
  });

  // Hard cap to prevent infinite loops on engine bugs (mirrors simulateSet's 200/set safety).
  const HARD_CAP = 5 * 200;
  let safety = 0;
  while (state.status !== 'finished') {
    safety += 1;
    if (safety > HARD_CAP) {
      throw new Error(
        `simulateMatchLive: exceeded ${HARD_CAP} rally steps; engine bug.`,
      );
    }
    const stepResult = simulateRallyStep(state);
    state = stepResult.newState;
  }

  // Convert TeamLiveState back to TeamMatchState. The `system` field is
  // optional under exactOptionalPropertyTypes so we use conditional spread
  // (CLAUDE.md "From Sprint 5").
  const fromLive = (t: TeamLiveState): TeamMatchState => ({
    lineup: t.lineup,
    rotation: t.rotation,
    libero: t.libero,
    setterIndex: t.setterIndex,
    ...(t.system && { system: t.system }),
  });

  // Convert completed sets back to the workers SetResult shape so callers
  // get an output identical to simulateMatch's MatchResult.
  const finalHomeMatch = fromLive(state.home);
  const finalAwayMatch = fromLive(state.away);
  const sets: SetResult[] = state.completedSets.map((cs) => ({
    homeScore: cs.homeScore,
    awayScore: cs.awayScore,
    rallies: cs.rallies,
    momentumAfterRally: cs.momentumAfterRally,
    finalHome: finalHomeMatch, // post-match state; per-set finals not tracked this sprint
    finalAway: finalAwayMatch,
    servingTeamEnd: cs.servingTeamEnd,
    finalMomentum: cs.finalMomentum,
    finalTimeoutsHome: cs.finalTimeoutsHome,
    finalTimeoutsAway: cs.finalTimeoutsAway,
    timeouts: cs.timeouts.map((t) => ({
      atRallyIdx: t.atRallyIdx,
      by: t.by,
      opponentRunLength: t.opponentRunLength,
      momentumBefore: t.momentumBefore,
      momentumAfter: t.momentumAfter,
    })),
  }));

  const match: MatchResult = {
    winner: state.winner!, // safe: state.status === 'finished'
    homeSetsWon: state.setsWon.home,
    awaySetsWon: state.setsWon.away,
    sets,
  };

  return { finalState: state, match };
}
