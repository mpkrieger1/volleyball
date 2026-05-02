// Sprint 18: builds the per-player stat row inputs for a completed match.
//
// The box score (`MatchBoxScore`) is keyed by `slotIndex` (0..5). Persisting
// to the `PlayerMatchStat` table requires a real `playerId`. The caller must
// supply a 6-element array per side mapping slot index → Player.id (see
// `main/src/match/pickStarters.ts` for the picking logic).
//
// Invariants (verified by tests/unit/sim/playerMatchStatBuilder.test.ts):
//   - Output length is exactly 12 (6 home + 6 away).
//   - Σ rows[home].kills === boxScore.home.totals.kills.
//   - Σ rows[away].digs === boxScore.away.totals.digs.
//   - Slot order is preserved (home rows precede away rows).

import type { MatchBoxScore } from './boxScore';

/**
 * Plain-object shape compatible with `Prisma.PlayerMatchStatCreateManyInput`.
 * Defined locally to keep `shared/` Prisma-agnostic (cross-process boundary).
 */
export type PlayerMatchStatRow = {
  playerId: string;
  matchId: string;
  kills: number;
  errors: number;
  totalAttacks: number;
  hittingPct: number;
  assists: number;
  serviceAces: number;
  serviceErrors: number;
  receptionErrors: number;
  digs: number;
  blockSolos: number;
  blockAssists: number;
  rotationMinutes: number;
};

export type BuildPlayerMatchStatRowsInput = {
  matchId: string;
  homePlayerIds: readonly string[];
  awayPlayerIds: readonly string[];
  boxScore: MatchBoxScore;
};

export function buildPlayerMatchStatRows(
  input: BuildPlayerMatchStatRowsInput,
): PlayerMatchStatRow[] {
  if (input.homePlayerIds.length !== 6) {
    throw new Error(`homePlayerIds must have length 6 (got ${input.homePlayerIds.length})`);
  }
  if (input.awayPlayerIds.length !== 6) {
    throw new Error(`awayPlayerIds must have length 6 (got ${input.awayPlayerIds.length})`);
  }

  const rows: PlayerMatchStatRow[] = [];
  for (let slot = 0; slot < 6; slot++) {
    const home = input.boxScore.home.players[slot]!;
    rows.push({
      playerId: input.homePlayerIds[slot]!,
      matchId: input.matchId,
      kills: home.kills,
      errors: home.errors,
      totalAttacks: home.totalAttacks,
      hittingPct: home.hittingPctMilli,
      assists: home.assists,
      serviceAces: home.serviceAces,
      serviceErrors: home.serviceErrors,
      receptionErrors: home.receptionErrors,
      digs: home.digs,
      blockSolos: home.blockSolos,
      blockAssists: home.blockAssists,
      rotationMinutes: home.rotationMinutes,
    });
  }
  for (let slot = 0; slot < 6; slot++) {
    const away = input.boxScore.away.players[slot]!;
    rows.push({
      playerId: input.awayPlayerIds[slot]!,
      matchId: input.matchId,
      kills: away.kills,
      errors: away.errors,
      totalAttacks: away.totalAttacks,
      hittingPct: away.hittingPctMilli,
      assists: away.assists,
      serviceAces: away.serviceAces,
      serviceErrors: away.serviceErrors,
      receptionErrors: away.receptionErrors,
      digs: away.digs,
      blockSolos: away.blockSolos,
      blockAssists: away.blockAssists,
      rotationMinutes: away.rotationMinutes,
    });
  }
  return rows;
}
