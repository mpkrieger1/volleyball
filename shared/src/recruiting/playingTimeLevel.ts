// Sprint 35 Task 35.2 — playing-time level helper for the FCCD-style
// recruiting model. Maps a team's roster outlook at a given position to
// a 0..100 "open slots" score. FCCD uses a similar
// `getMaxYoungPlayersByPosition` cap concept.

import type { Position } from './types';

/** Sprint 35: per-position roster cap — what the AI considers a "full" depth chart. */
export const POSITION_CAPS: Record<Position, number> = {
  OH: 4,
  MB: 3,
  OPP: 2,
  S: 2,
  L: 1,
  DS: 2,
};

export interface PlayingTimeArgs {
  /** Returners at the recruit's position on the team. */
  returnersAtPosition: number;
  /** Position cap (use POSITION_CAPS[recruit.position]). */
  positionCap: number;
}

/**
 * 100 = open competition (zero returners), 0 = position is saturated.
 * Above-cap returners clamp to 0 (no slots regardless of how oversold).
 */
export function computePlayingTimeLevel(args: PlayingTimeArgs): number {
  if (args.positionCap <= 0) return 0;
  const occupied = Math.min(Math.max(args.returnersAtPosition, 0), args.positionCap);
  return Math.round(((args.positionCap - occupied) / args.positionCap) * 100);
}
