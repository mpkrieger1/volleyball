// Sprint 18: aggregate per-match PlayerMatchStat rows into season totals.
//
// Pure function. Per-set rate divisor is the SUM of Set rows for the
// matches the player appeared in. (Sprint 6 limitation: rotation is not
// tracked per set; all 6 starters of a match are credited with every set
// of that match — see CLAUDE.md "From Sprint 4" / "From Sprint 6".)

import type { AggregatedSeasonStats } from './types';
import type { PlayerMatchStatRow } from '../sim/playerMatchStatBuilder';

/** Source row shape — superset of PlayerMatchStatRow with Prisma-level id. */
export type RawPlayerMatchStatRow = PlayerMatchStatRow & { id?: string };

/**
 * Aggregate one player's per-match stat rows into season totals.
 *
 * @param playerId        canonical player id (used for output)
 * @param rows            PlayerMatchStat rows for this player only
 * @param setsPerMatch    matchId → number of Set rows played in that match
 */
export function aggregatePlayerSeasonStats(
  playerId: string,
  rows: readonly RawPlayerMatchStatRow[],
  setsPerMatch: ReadonlyMap<string, number>,
): AggregatedSeasonStats {
  let kills = 0;
  let errors = 0;
  let totalAttacks = 0;
  let assists = 0;
  let serviceAces = 0;
  let serviceErrors = 0;
  let receptionErrors = 0;
  let digs = 0;
  let blockSolos = 0;
  let blockAssists = 0;
  let setsPlayed = 0;
  const matchIds = new Set<string>();

  for (const r of rows) {
    matchIds.add(r.matchId);
    setsPlayed += setsPerMatch.get(r.matchId) ?? 0;
    kills += r.kills;
    errors += r.errors;
    totalAttacks += r.totalAttacks;
    assists += r.assists;
    serviceAces += r.serviceAces;
    serviceErrors += r.serviceErrors;
    receptionErrors += r.receptionErrors;
    digs += r.digs;
    blockSolos += r.blockSolos;
    blockAssists += r.blockAssists;
  }

  const hittingPctMilli =
    totalAttacks > 0 ? Math.round(((kills - errors) / totalAttacks) * 1000) : 0;

  return {
    playerId,
    matchesPlayed: matchIds.size,
    setsPlayed,
    kills,
    errors,
    totalAttacks,
    hittingPctMilli,
    assists,
    serviceAces,
    serviceErrors,
    receptionErrors,
    digs,
    blockSolos,
    blockAssists,
  };
}

/**
 * Group a flat array of stat rows by playerId and aggregate each group.
 */
export function aggregateAllPlayers(
  rows: readonly RawPlayerMatchStatRow[],
  setsPerMatch: ReadonlyMap<string, number>,
): Map<string, AggregatedSeasonStats> {
  const byPlayer = new Map<string, RawPlayerMatchStatRow[]>();
  for (const r of rows) {
    let list = byPlayer.get(r.playerId);
    if (!list) {
      list = [];
      byPlayer.set(r.playerId, list);
    }
    list.push(r);
  }
  const result = new Map<string, AggregatedSeasonStats>();
  for (const [playerId, playerRows] of byPlayer) {
    result.set(playerId, aggregatePlayerSeasonStats(playerId, playerRows, setsPerMatch));
  }
  return result;
}
