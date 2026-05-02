// Sprint 19: pre-match scout report — opponent system, top-3 K/set hitters,
// recent form (last 5 matches' W/L sequence).

import { z } from 'zod';

export const ScoutReportRequest = z.object({
  slotId: z.string().min(1),
  opponentTeamId: z.string().min(1),
  /** Optional cutoff. Default: now. Used so the scout shows only stats
   *  earned BEFORE the upcoming match. */
  throughDate: z.string().datetime().optional(),
});
export type ScoutReportRequest = z.infer<typeof ScoutReportRequest>;

export const ScoutHitter = z.object({
  playerId: z.string(),
  playerName: z.string(),
  position: z.string(),
  killsPerSet: z.number(),
  matchesPlayed: z.number().int().nonnegative(),
});
export type ScoutHitter = z.infer<typeof ScoutHitter>;

export const RecentFormEntry = z.object({
  matchId: z.string(),
  date: z.string(),
  result: z.enum(['W', 'L']),
  opponentTeamId: z.string(),
  opponentName: z.string(),
  opponentAbbr: z.string(),
  setsFor: z.number().int().nonnegative(),
  setsAgainst: z.number().int().nonnegative(),
});
export type RecentFormEntry = z.infer<typeof RecentFormEntry>;

export const ScoutReportOk = z.object({
  ok: z.literal(true),
  opponentTeamId: z.string(),
  opponentName: z.string(),
  opponentAbbr: z.string(),
  /** From Team.preferredSystem. '5-1' | '6-2'. */
  system: z.string(),
  /** Top 3 OH/OPP scorers by season K/set. May be < 3 if no data. */
  topHitters: z.array(ScoutHitter).max(3),
  /** Last ≤5 matches, oldest → newest. */
  recentForm: z.array(RecentFormEntry).max(5),
});
export const ScoutReportErr = z.object({
  ok: z.literal(false),
  error: z.object({
    code: z.enum(['NOT_FOUND', 'IO_ERROR', 'INTERNAL']),
    message: z.string(),
  }),
});
export const ScoutReportResponse = z.discriminatedUnion('ok', [ScoutReportOk, ScoutReportErr]);
export type ScoutReportResponse = z.infer<typeof ScoutReportResponse>;

export const SCOUT_IPC_CHANNELS = {
  scoutReport: 'match:scoutReport',
} as const;
