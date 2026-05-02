// Sprint 20 chart 2: K/set vs opponent block-rating scatter.
//
// Per-match scalar approach: for each slot 0..5 on each team, plot
// (opponent's average block rating, kills/set, total kills). Points have
// playerId + name + position for tooltip + axe-friendly table.
//
// Simpler than rotation-aware blocker resolution (where we'd average only
// the 3 front-row blockers at the moment of each attack); per-match scalar
// is sufficient for the scatter visualization. Future sprint can swap in
// a more granular metric without changing the chart contract.

import type { MatchBoxScore } from '../sim/boxScore';
import type { KPerSetVsBlockData, KPerSetVsBlockPoint } from './types';

export type KPerSetVsBlockInput = {
  boxScore: MatchBoxScore;
  setsPlayed: number;
  home: {
    lineupSlots: readonly string[];
    lineupRatingsBlock: readonly number[];
    lineupPositions: readonly string[];
    lineupPlayerIds: readonly string[];
  };
  away: {
    lineupSlots: readonly string[];
    lineupRatingsBlock: readonly number[];
    lineupPositions: readonly string[];
    lineupPlayerIds: readonly string[];
  };
};

function mean(xs: readonly number[]): number {
  if (xs.length === 0) return 0;
  let sum = 0;
  for (const x of xs) sum += x;
  return sum / xs.length;
}

export function computeKPerSetVsBlock(input: KPerSetVsBlockInput): KPerSetVsBlockData {
  const sets = Math.max(1, input.setsPlayed);
  const homeOpponentBlockAvg = mean(input.away.lineupRatingsBlock);
  const awayOpponentBlockAvg = mean(input.home.lineupRatingsBlock);

  const points: KPerSetVsBlockPoint[] = [];

  for (let slot = 0; slot < 6; slot++) {
    const homeKills = input.boxScore.home.players[slot]?.kills ?? 0;
    points.push({
      playerId: input.home.lineupPlayerIds[slot] ?? `home-slot-${slot}`,
      playerName: input.home.lineupSlots[slot] ?? `#${slot}`,
      position: input.home.lineupPositions[slot] ?? '',
      isHome: true,
      killsPerSet: homeKills / sets,
      opponentBlockAvg: homeOpponentBlockAvg,
      kills: homeKills,
    });
  }
  for (let slot = 0; slot < 6; slot++) {
    const awayKills = input.boxScore.away.players[slot]?.kills ?? 0;
    points.push({
      playerId: input.away.lineupPlayerIds[slot] ?? `away-slot-${slot}`,
      playerName: input.away.lineupSlots[slot] ?? `#${slot}`,
      position: input.away.lineupPositions[slot] ?? '',
      isHome: false,
      killsPerSet: awayKills / sets,
      opponentBlockAvg: awayOpponentBlockAvg,
      kills: awayKills,
    });
  }

  return points;
}
