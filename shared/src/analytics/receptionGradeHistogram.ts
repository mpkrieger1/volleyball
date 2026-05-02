// Sprint 20 chart 3: reception grade distribution per player.
//
// Walks PBP `reception` events, tallying per (team, receiver-slot, grade).
// Maps slot index → player name via the supplied lineup. Returns one row
// per slot per team (12 rows max, suppressed if the player had 0 receptions).

import type { MatchPbp } from '../sim/pbp';
import type { ReceptionGradeHistogramData, ReceptionGradeHistogramRow } from './types';

export type ReceptionGradeHistogramInput = {
  pbp: MatchPbp;
  home: { lineupSlots: readonly string[]; lineupPlayerIds: readonly string[] };
  away: { lineupSlots: readonly string[]; lineupPlayerIds: readonly string[] };
};

type Counts = { 0: number; 1: number; 2: number; 3: number };

function emptyCounts(): Counts {
  return { 0: 0, 1: 0, 2: 0, 3: 0 };
}

export function computeReceptionGradeHistogram(
  input: ReceptionGradeHistogramInput,
): ReceptionGradeHistogramData {
  const homeBySlot: Counts[] = Array.from({ length: 6 }, emptyCounts);
  const awayBySlot: Counts[] = Array.from({ length: 6 }, emptyCounts);

  for (const set of input.pbp.sets) {
    for (const rally of set.rallies) {
      for (const event of rally.events) {
        if (event.kind !== 'reception') continue;
        const target = event.team === 'home' ? homeBySlot : awayBySlot;
        const counts = target[event.receiver]!;
        counts[event.grade] += 1;
      }
    }
  }

  const rows: ReceptionGradeHistogramRow[] = [];
  const buildRows = (
    counts: Counts[],
    side: { lineupSlots: readonly string[]; lineupPlayerIds: readonly string[] },
    isHome: boolean,
  ): void => {
    for (let slot = 0; slot < 6; slot++) {
      const c = counts[slot]!;
      const total = c[0] + c[1] + c[2] + c[3];
      if (total === 0) continue;
      rows.push({
        playerId: side.lineupPlayerIds[slot] ?? `${isHome ? 'home' : 'away'}-slot-${slot}`,
        playerName: side.lineupSlots[slot] ?? `#${slot}`,
        isHome,
        grade0: c[0],
        grade1: c[1],
        grade2: c[2],
        grade3: c[3],
        total,
      });
    }
  };
  buildRows(homeBySlot, input.home, true);
  buildRows(awayBySlot, input.away, false);

  return rows;
}
