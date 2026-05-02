// Sprint 18: AVCA All-American selection algorithm.
//
// Pure function. Given aggregated season stats and player meta (position,
// team), returns the 28 (4 × AA_TEAM_SIZE) selections in priority order.
//
// Algorithm:
//   1. Score each eligible player against their actual position.
//   2. Group + sort by score desc within each position.
//   3. Greedy fill 1st → 2nd → 3rd → HM teams; for each team, take the
//      top n unselected players per position where n = AA_COMPOSITION[pos].
//   4. If a position pool runs out, leave that team's slot empty (the
//      algorithm does not promote a different position to fill).
//
// No duplicates: a player appears at most once across the four teams.

import { AA_COMPOSITION, AA_TEAMS } from './composition';
import { scorePlayerForAA } from './scoring';
import type { AggregatedSeasonStats, AwardSelection, PlayerPosition } from './types';

export type PlayerMeta = {
  teamId: string;
  position: PlayerPosition;
  isLibero?: boolean;
};

export type SelectInput = {
  /** Aggregated season stats keyed by playerId. */
  stats: ReadonlyMap<string, AggregatedSeasonStats>;
  /** Player metadata (team + position) keyed by playerId. */
  players: ReadonlyMap<string, PlayerMeta>;
  /**
   * Optional eligibility filter. Returns true if the player is eligible.
   * Default: setsPlayed > 0.
   */
  eligible?: (playerId: string, stats: AggregatedSeasonStats) => boolean;
};

/** Treat a player as L if isLibero, otherwise their declared position. */
function effectivePosition(meta: PlayerMeta): PlayerPosition {
  return meta.isLibero ? 'L' : meta.position;
}

export function selectAllAmericans(input: SelectInput): AwardSelection[] {
  const eligible = input.eligible ?? ((_, s) => s.setsPlayed > 0);

  type Entry = { playerId: string; teamId: string; position: PlayerPosition; score: number };
  const buckets: Record<string, Entry[]> = { OH: [], MB: [], OPP: [], S: [], L: [] };

  for (const [playerId, stats] of input.stats) {
    if (!eligible(playerId, stats)) continue;
    const meta = input.players.get(playerId);
    if (!meta) continue;
    const pos = effectivePosition(meta);
    if (!(pos in buckets)) continue; // skip DS — not an AA position
    const score = scorePlayerForAA(stats, pos);
    buckets[pos]!.push({ playerId, teamId: meta.teamId, position: pos, score });
  }

  for (const list of Object.values(buckets)) {
    list.sort((a, b) => b.score - a.score || a.playerId.localeCompare(b.playerId));
  }

  const selections: AwardSelection[] = [];
  const cursor: Record<string, number> = { OH: 0, MB: 0, OPP: 0, S: 0, L: 0 };
  for (const team of AA_TEAMS) {
    for (const [position, count] of Object.entries(AA_COMPOSITION) as [
      keyof typeof AA_COMPOSITION,
      number,
    ][]) {
      const pool = buckets[position]!;
      for (let n = 0; n < count; n++) {
        const idx = cursor[position]!;
        if (idx >= pool.length) break; // pool exhausted; leave slot empty
        const e = pool[idx]!;
        cursor[position] = idx + 1;
        selections.push({
          playerId: e.playerId,
          teamId: e.teamId,
          position: e.position,
          team,
          score: e.score,
        });
      }
    }
  }
  return selections;
}
