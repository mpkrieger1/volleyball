// Sprint 30 Task 30.3: user-driven substitution.
//
// Rules (NCAA-relaxed per Q10=C):
//   - Caller's team must be userTeam (not 'none').
//   - subsHome/Away must be < 15 (NCAA cap; resets per set).
//   - outIdx must be in [0..5] AND must NOT be the libero slot
//     (libero swaps are auto-handled by the rotation engine).
//   - inPlayerId must match a player in `bench`.
//   - Match must be in_progress.
//
// Effect:
//   - Atomically swap lineup.players[outIdx] (ratings) with bench player's
//     ratings.
//   - playerIdsBySlot[outIdx] becomes inPlayerId.
//   - Outgoing player joins the bench (so they can be subbed back in
//     later, subject to position eligibility at the UI layer — engine
//     accepts any player at any slot).
//   - subsHome/Away increments by 1.
//   - Appends a CoachAction{kind:'substitution', team, rallyIndex, out, in}
//     to coachActionLog.

import type {
  LiveMatchState,
  BenchPlayer,
  CoachAction,
  TeamLiveState,
} from './state';

export const SUBS_PER_SET = 15;

export type ApplyUserSubstitutionInput = {
  outIdx: number;          // 0..5
  inPlayerId: string;
};

export type ApplyUserSubstitutionOk = {
  ok: true;
  state: LiveMatchState;
  action: Extract<CoachAction, { kind: 'substitution' }>;
};
export type ApplyUserSubstitutionErr = {
  ok: false;
  code:
    | 'NO_USER_TEAM'
    | 'SUBS_EXHAUSTED'
    | 'INVALID_SLOT'
    | 'LIBERO_SLOT_SWAP_NOT_ALLOWED'
    | 'PLAYER_NOT_ON_BENCH'
    | 'INVALID_STATE';
  message: string;
};
export type ApplyUserSubstitutionResult =
  | ApplyUserSubstitutionOk
  | ApplyUserSubstitutionErr;

export function applyUserSubstitution(
  state: LiveMatchState,
  input: ApplyUserSubstitutionInput,
): ApplyUserSubstitutionResult {
  if (state.status === 'finished') {
    return { ok: false, code: 'INVALID_STATE', message: 'match is finished' };
  }
  if (state.userTeam === 'none') {
    return { ok: false, code: 'NO_USER_TEAM', message: 'no user team set' };
  }
  const team = state.userTeam;

  const subsUsed = team === 'home' ? state.subsHome : state.subsAway;
  if (subsUsed >= SUBS_PER_SET) {
    return {
      ok: false,
      code: 'SUBS_EXHAUSTED',
      message: `team has used all ${SUBS_PER_SET} substitutions for this set`,
    };
  }

  if (input.outIdx < 0 || input.outIdx > 5 || !Number.isInteger(input.outIdx)) {
    return {
      ok: false,
      code: 'INVALID_SLOT',
      message: `outIdx must be 0..5 (got ${input.outIdx})`,
    };
  }

  const teamState = team === 'home' ? state.home : state.away;

  // Libero slot is auto-handled by the engine; reject explicit user subs there.
  if (teamState.libero && input.outIdx === teamState.libero.liberoIndex) {
    return {
      ok: false,
      code: 'LIBERO_SLOT_SWAP_NOT_ALLOWED',
      message: 'libero swaps are auto-handled by the engine',
    };
  }

  const benchIdx = teamState.bench.findIndex((b) => b.playerId === input.inPlayerId);
  if (benchIdx === -1) {
    return {
      ok: false,
      code: 'PLAYER_NOT_ON_BENCH',
      message: `player ${input.inPlayerId} is not on the bench`,
    };
  }

  const incoming: BenchPlayer = teamState.bench[benchIdx]!;
  const outgoingId = teamState.playerIdsBySlot[input.outIdx]!;
  const outgoingRatings = teamState.lineup.players[input.outIdx]!;

  // Build the outgoing BenchPlayer record. Without per-player metadata in
  // the lineup (we don't carry name/position there), we fabricate a
  // minimal record from the swap context. Future passes can enrich this
  // when the renderer needs the outgoing player's full bio.
  const outgoingBench: BenchPlayer = {
    playerId: outgoingId,
    firstName: '',
    lastName: '',
    position: incoming.position, // best-effort; UI shows the slot label anyway
    jersey: 0,
    isLibero: false,
    ratings: outgoingRatings,
  };

  // Apply the swap.
  const newPlayers = [...teamState.lineup.players] as TeamLiveState['lineup']['players'];
  newPlayers[input.outIdx] = incoming.ratings;

  const newSlots = [...teamState.playerIdsBySlot] as TeamLiveState['playerIdsBySlot'];
  newSlots[input.outIdx] = incoming.playerId;

  const newBench = [
    ...teamState.bench.slice(0, benchIdx),
    ...teamState.bench.slice(benchIdx + 1),
    outgoingBench,
  ];

  const newTeamState: TeamLiveState = {
    ...teamState,
    lineup: { ...teamState.lineup, players: newPlayers },
    playerIdsBySlot: newSlots,
    bench: newBench,
  };

  const action: Extract<CoachAction, { kind: 'substitution' }> = {
    kind: 'substitution',
    team,
    rallyIndex: state.rallyCursor,
    out: outgoingId,
    in: incoming.playerId,
  };

  const newState: LiveMatchState = {
    ...state,
    home: team === 'home' ? newTeamState : state.home,
    away: team === 'away' ? newTeamState : state.away,
    subsHome: team === 'home' ? subsUsed + 1 : state.subsHome,
    subsAway: team === 'away' ? subsUsed + 1 : state.subsAway,
    coachActionLog: [...state.coachActionLog, action],
  };

  return { ok: true, state: newState, action };
}
