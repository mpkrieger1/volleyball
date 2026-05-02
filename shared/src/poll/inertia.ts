// Prior-rank inertia + movement clamps. Enforces PRD Sprint 9 exit tests
// 2 (no team that lost last 3 rises) and 3 (no >8-spot jump without a
// top-10 upset win).
//
// Rank-slot assignment algorithm:
//   1. Compute each team's allowed final-rank range [lo, hi] from prevRank
//      + upset flag + 0-3 flag.
//   2. Walk teams in newPoll order (best-score first). Assign each to the
//      smallest unassigned rank within their allowed range.
//   3. Teams whose range is fully blocked drop off this week; they go to
//      the overflow pool.
//   4. Any remaining 1..25 slots fill from the overflow pool.

import type { PollRow } from './aggregate';
import type { TeamMetrics } from './teamMetrics';

/** Teams that won a match this week where the loser was top-10 in prevPoll. */
export type UpsetInfo = ReadonlyArray<{ winnerTeamId: string }>;

export const MAX_NON_UPSET_MOVE = 8;
/** Normal per-week rise cap (slower than drop — mirrors real poll inertia). */
export const MAX_NORMAL_RISE = 4;
/** Normal per-week drop cap. */
export const MAX_NORMAL_DROP = 6;
/** A team unranked last week enters no higher than this rank. */
export const FIRST_TIME_ENTRY_FLOOR = 20;

export function applyInertia(
  prevPoll: PollRow[] | null,
  newPoll: PollRow[],
  metrics: Map<string, TeamMetrics>,
  upsets: UpsetInfo,
): PollRow[] {
  if (!prevPoll || prevPoll.length === 0) return newPoll;

  const prevRank = new Map<string, number>();
  for (const r of prevPoll) prevRank.set(r.teamId, r.rank);
  const upsetWinners = new Set(upsets.map((u) => u.winnerTeamId));

  function rangeFor(teamId: string): { lo: number; hi: number } {
    const prev = prevRank.get(teamId);
    const m = metrics.get(teamId);
    const lost3 = m ? m.last3Wins === 0 && m.last3Losses >= 3 : false;
    const isUpsetter = upsetWinners.has(teamId);

    if (prev == null) {
      return { lo: FIRST_TIME_ENTRY_FLOOR, hi: 25 };
    }
    if (lost3) {
      return { lo: prev, hi: Math.min(25, prev + MAX_NORMAL_DROP) };
    }
    if (isUpsetter) {
      return { lo: 1, hi: Math.min(25, prev + MAX_NORMAL_DROP) };
    }
    return {
      lo: Math.max(1, prev - MAX_NORMAL_RISE),
      hi: Math.min(25, prev + MAX_NORMAL_DROP),
    };
  }

  const assigned = new Map<number, PollRow>();

  for (const row of newPoll) {
    const { lo, hi } = rangeFor(row.teamId);
    for (let r = lo; r <= hi; r++) {
      if (!assigned.has(r)) {
        assigned.set(r, row);
        break;
      }
    }
    // If no slot in [lo, hi] was free, the team drops off this week. Empty
    // slots are NOT filled by overflow — doing so would violate the
    // movement cap (that was the whole point of the range constraint).
  }

  const result: PollRow[] = [];
  for (let r = 1; r <= 25; r++) {
    const a = assigned.get(r);
    if (a) {
      result.push({
        rank: r,
        teamId: a.teamId,
        points: a.points,
        firstPlaceVotes: a.firstPlaceVotes,
      });
    }
  }
  return result;
}

/**
 * Helper: compute upset info from a list of this-week matches + the
 * previous-week poll. "Upset" = winning team beat a team ranked top-10
 * last week.
 */
export function detectUpsets(
  thisWeekMatches: Array<{ winnerId: string; homeTeamId: string; awayTeamId: string }>,
  prevPoll: PollRow[] | null,
): UpsetInfo {
  if (!prevPoll) return [];
  const prevTop10 = new Set(prevPoll.filter((r) => r.rank <= 10).map((r) => r.teamId));
  const upsets: Array<{ winnerTeamId: string }> = [];
  for (const m of thisWeekMatches) {
    const loser = m.winnerId === m.homeTeamId ? m.awayTeamId : m.homeTeamId;
    if (prevTop10.has(loser)) {
      upsets.push({ winnerTeamId: m.winnerId });
    }
  }
  return upsets;
}
