// Sprint 18: zod schemas for awards aggregation + selection.

import { z } from 'zod';

export const PLAYER_POSITIONS = ['OH', 'MB', 'OPP', 'S', 'L', 'DS'] as const;
export const PlayerPositionSchema = z.enum(PLAYER_POSITIONS);
export type PlayerPosition = z.infer<typeof PlayerPositionSchema>;

/**
 * Per-player season stat aggregate. Inputs to AA scoring + UI.
 *
 * Per-set rate divisor is the player's setsPlayed (sum of Set rows for
 * matches they appeared in — Sprint 6 limitation: rotation per set is not
 * tracked, so all 6 starters are credited with every set of every match
 * they played).
 */
export const AggregatedSeasonStatsSchema = z.object({
  playerId: z.string(),
  matchesPlayed: z.number().int().nonnegative(),
  setsPlayed: z.number().int().nonnegative(),
  kills: z.number().int().nonnegative(),
  errors: z.number().int().nonnegative(),
  totalAttacks: z.number().int().nonnegative(),
  /** Hitting % scaled ×1000 (e.g., 0.453 → 453). */
  hittingPctMilli: z.number().int(),
  assists: z.number().int().nonnegative(),
  serviceAces: z.number().int().nonnegative(),
  serviceErrors: z.number().int().nonnegative(),
  receptionErrors: z.number().int().nonnegative(),
  digs: z.number().int().nonnegative(),
  blockSolos: z.number().int().nonnegative(),
  blockAssists: z.number().int().nonnegative(),
});
export type AggregatedSeasonStats = z.infer<typeof AggregatedSeasonStatsSchema>;

/** A single AA team-slot allocation. */
export const AwardSelectionSchema = z.object({
  playerId: z.string(),
  teamId: z.string(),
  position: PlayerPositionSchema,
  /** Which AA team — first / second / third / hm. */
  team: z.enum(['first', 'second', 'third', 'hm']),
  /** Position-specific score used to rank within the position bucket. */
  score: z.number(),
});
export type AwardSelection = z.infer<typeof AwardSelectionSchema>;
