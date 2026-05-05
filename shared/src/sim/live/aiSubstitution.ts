// Sprint 30 Task 30.3 + Retro fix #6: AI opponent substitution decision.
//
// Improved model:
//   - When team-level fatigue exceeds threshold, find the lowest-rated
//     non-libero on-court player.
//   - Look up the OUTGOING player's position via the bios map (passed
//     by the caller — registry knows the bio).
//   - Pick the freshest same-position bench player. Falls back to ANY
//     non-libero bench player if no same-position match exists.
//   - Caller enforces a 5-rally cooldown via lastAiSubRallyIdx in the
//     registry — the function itself is stateless.
//
// Deterministic given (state, biosMap). No RNG used.

import type { LiveMatchState, BenchPlayer, TeamSide } from './state';
import { teamShouldConsiderSub, pickFreshestBenchAtPosition } from './fatigue';

export const AI_SUB_COOLDOWN_RALLIES = 5;

export type AiSubDecision =
  | { kind: 'sub'; outIdx: number; inPlayerId: string }
  | { kind: 'pass' };

/**
 * Decide whether the AI should sub for the given team this rally.
 * Pure function — does not mutate state. Returns the chosen sub or
 * 'pass' (no action). Caller enforces the cooldown.
 *
 * @param outgoingBios Optional id→bio lookup for on-court players. When
 *   present, the algorithm can position-match (e.g. swap an OPP for an
 *   OPP). When absent (legacy path), falls back to "any non-libero."
 */
export function aiPickSubstitution(
  state: LiveMatchState,
  team: TeamSide,
  outgoingBios?: Map<string, BenchPlayer>,
): AiSubDecision {
  if (!teamShouldConsiderSub(state, team)) return { kind: 'pass' };
  const subsUsed = team === 'home' ? state.subsHome : state.subsAway;
  if (subsUsed >= 15) return { kind: 'pass' };

  const teamState = team === 'home' ? state.home : state.away;

  // Pick the lowest-rated on-court attacker (overall=attack+block+stamina/3)
  // that is NOT the libero slot.
  let weakestSlot = -1;
  let weakestScore = Infinity;
  for (let i = 0; i < 6; i++) {
    if (teamState.libero && i === teamState.libero.liberoIndex) continue;
    const p = teamState.lineup.players[i]!;
    const score = (p.attack + p.block + p.stamina) / 3;
    if (score < weakestScore) {
      weakestScore = score;
      weakestSlot = i;
    }
  }
  if (weakestSlot === -1) return { kind: 'pass' };

  const benchCandidates = teamState.bench.filter((b) => !b.isLibero);
  if (benchCandidates.length === 0) return { kind: 'pass' };

  // Position-match: if we have bios for the outgoing player, prefer a
  // same-position bench replacement (real volleyball convention — coaches
  // don't put an OPP in for an MB).
  let incoming: BenchPlayer | undefined;
  if (outgoingBios) {
    const outgoingId = teamState.playerIdsBySlot[weakestSlot];
    const outgoingPos = outgoingId ? outgoingBios.get(outgoingId)?.position : undefined;
    if (outgoingPos) {
      const sameSlot = pickFreshestBenchAtPosition(benchCandidates, outgoingPos);
      if (sameSlot) incoming = sameSlot;
    }
  }
  // Fallback: any non-libero bench player, deterministic by id sort.
  if (!incoming) {
    incoming = [...benchCandidates].sort((a, b) =>
      a.playerId.localeCompare(b.playerId),
    )[0];
  }
  if (!incoming) return { kind: 'pass' };

  return { kind: 'sub', outIdx: weakestSlot, inPlayerId: incoming.playerId };
}
