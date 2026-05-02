// Sprint 20 chart 1: rotation-by-rotation hitting %.
//
// PBP rallies have `servingTeam` + `winningTeam` per rally. The receiving
// team rotates on side-out (winningTeam !== servingTeam → serving changes
// → the new receiver rotates). We track each team's rotation index 0..5
// across rallies of a set; on each set, BOTH teams reset to 0.
//
// For each `attack` event with outcome 'kill' or 'error', attribute K / E /
// totalAttacks to (team, current-rotation-index). Hitting% = (K - E) / TA
// scaled ×1000.

import type { MatchPbp } from '../sim/pbp';
import type { RotationHittingPctData } from './types';

type Counts = { kills: number; errors: number; totalAttacks: number };

function emptyRotationCounts(): Counts[] {
  return Array.from({ length: 6 }, () => ({ kills: 0, errors: 0, totalAttacks: 0 }));
}

function hittingPctMilli(c: Counts): number {
  if (c.totalAttacks === 0) return 0;
  return Math.round(((c.kills - c.errors) / c.totalAttacks) * 1000);
}

export function computeRotationHittingPct(pbp: MatchPbp): RotationHittingPctData {
  const homeCounts = emptyRotationCounts();
  const awayCounts = emptyRotationCounts();

  for (const set of pbp.sets) {
    let homeRotation = 0;
    let awayRotation = 0;

    for (const rally of set.rallies) {
      // Attribute attacks at the rotation state in effect at rally start.
      for (const event of rally.events) {
        if (event.kind !== 'attack') continue;
        const counts =
          event.team === 'home' ? homeCounts[homeRotation]! : awayCounts[awayRotation]!;
        counts.totalAttacks += 1;
        if (event.outcome === 'kill') counts.kills += 1;
        else if (event.outcome === 'error' || event.outcome === 'blocked') counts.errors += 1;
      }

      // Side-out: receiving team (= winning team when winner !== server) rotates.
      if (rally.winningTeam !== rally.servingTeam) {
        if (rally.winningTeam === 'home') homeRotation = (homeRotation + 1) % 6;
        else awayRotation = (awayRotation + 1) % 6;
      }
    }
  }

  return {
    home: homeCounts.map(hittingPctMilli),
    away: awayCounts.map(hittingPctMilli),
    homeCounts,
    awayCounts,
  };
}
