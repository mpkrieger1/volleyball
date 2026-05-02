// Sprint 18: position-specific AA scoring.
//
// Pure function. Scores rank players WITHIN a position bucket — no
// cross-position normalization (AA selection picks N best per position,
// not globally). Higher = better.
//
// Weight structure is locked in this sprint; numerics tunable via constants.
// Tests in tests/unit/awards/scoring.test.ts assert monotonicity in each
// position's primary signal.

import type { AggregatedSeasonStats, PlayerPosition } from './types';

export type ScoreInputs = {
  killsPerSet: number;
  assistsPerSet: number;
  digsPerSet: number;
  blocksPerSet: number;
  acesPerSet: number;
  /** 0..1 (real, not scaled). 0.453 = 45.3%. */
  hittingPct: number;
  /** Reception errors per set — lower is better. */
  receptionErrorsPerSet: number;
};

export function deriveInputs(stats: AggregatedSeasonStats): ScoreInputs {
  const sets = Math.max(1, stats.setsPlayed);
  return {
    killsPerSet: stats.kills / sets,
    assistsPerSet: stats.assists / sets,
    digsPerSet: stats.digs / sets,
    /** Block-assist counts as half a block (standard NCAA convention). */
    blocksPerSet: (stats.blockSolos + stats.blockAssists * 0.5) / sets,
    acesPerSet: stats.serviceAces / sets,
    hittingPct: stats.hittingPctMilli / 1000,
    receptionErrorsPerSet: stats.receptionErrors / sets,
  };
}

export function scorePlayerForAA(
  stats: AggregatedSeasonStats,
  position: PlayerPosition,
): number {
  const i = deriveInputs(stats);
  switch (position) {
    case 'OH':
      // Outside hitter: kills lead, hitting% + back-row defense matter.
      return (
        40 * i.killsPerSet +
        25 * i.hittingPct +
        15 * i.digsPerSet +
        10 * i.acesPerSet -
        10 * i.receptionErrorsPerSet
      );
    case 'MB':
      // Middle blocker: efficiency + blocks dominate.
      return 35 * i.hittingPct + 30 * i.blocksPerSet + 25 * i.killsPerSet;
    case 'OPP':
      // Opposite: high-volume scorer; modest blocking.
      return (
        50 * i.killsPerSet +
        30 * i.hittingPct +
        10 * i.blocksPerSet +
        10 * i.acesPerSet
      );
    case 'S':
      // Setter: assist volume rules; defense + serving as tiebreakers.
      return (
        65 * i.assistsPerSet +
        15 * i.digsPerSet +
        10 * i.hittingPct +
        10 * i.acesPerSet
      );
    case 'L':
      // Libero: digs and reception cleanliness.
      return 55 * i.digsPerSet - 30 * i.receptionErrorsPerSet;
    case 'DS':
      // Defensive specialist — score similarly to L but slightly weaker.
      return 45 * i.digsPerSet - 25 * i.receptionErrorsPerSet;
  }
}
