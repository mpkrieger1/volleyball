// Sprint 27 (Task 27.5): IPC contracts for the Standings screen.
//
// Single overview channel returns three datasets:
//   - Per-conference standings (sortable W-L / conf record)
//   - Latest-week RPI snapshot top-25 (empty during PRESEASON/REGULAR
//     since RPI is captured at bracket-generation time only — Sprint 11
//     pattern; mid-season weekly RPI is a v1.1 enhancement)
//   - Top stat leaders (per-category, top 20 by raw count)
//
// Renderer-side `useStandingsStore` calls `getOverview` on tab activation
// and lazy-hydrates each tab as the user navigates.

import { z } from 'zod';

export const GetStandingsOverviewRequest = z.object({
  slotId: z.string().min(1),
});
export type GetStandingsOverviewRequest = z.infer<typeof GetStandingsOverviewRequest>;

export const ConferenceStandingRow = z.object({
  conferenceId: z.string(),
  conferenceName: z.string(),
  conferenceAbbr: z.string(),
  teamId: z.string(),
  teamSchool: z.string(),
  teamAbbr: z.string(),
  rank: z.number().int().positive(),
  confWins: z.number().int().nonnegative(),
  confLosses: z.number().int().nonnegative(),
  overallWins: z.number().int().nonnegative(),
  overallLosses: z.number().int().nonnegative(),
});
export type ConferenceStandingRow = z.infer<typeof ConferenceStandingRow>;

export const RpiTop25Row = z.object({
  rank: z.number().int().positive(),
  teamId: z.string(),
  teamSchool: z.string(),
  teamAbbr: z.string(),
  rpiMilli: z.number().int(), // RPI × 1000
  wins: z.number().int().nonnegative(),
  losses: z.number().int().nonnegative(),
});
export type RpiTop25Row = z.infer<typeof RpiTop25Row>;

export const StatLeaderRow = z.object({
  rank: z.number().int().positive(),
  playerId: z.string(),
  playerName: z.string(),
  teamAbbr: z.string(),
  position: z.string(),
  /** Raw stat value (kills, assists, etc.). */
  value: z.number(),
  /** Per-set normalized value × 1000 (so client can render to 3 decimals). */
  perSetMilli: z.number().int(),
  setsPlayed: z.number().int().nonnegative(),
});
export type StatLeaderRow = z.infer<typeof StatLeaderRow>;

export const StatCategorySchema = z.enum([
  'kills',
  'assists',
  'digs',
  'blocks',
  'aces',
]);
export type StatCategory = z.infer<typeof StatCategorySchema>;

export const StandingsOverviewOk = z.object({
  ok: z.literal(true),
  conferenceStandings: z.array(ConferenceStandingRow),
  rpiTop25: z.array(RpiTop25Row),
  /** Top 20 per category, keyed by category name. */
  statLeaders: z.record(StatCategorySchema, z.array(StatLeaderRow)),
});
export const StandingsOverviewErr = z.object({
  ok: z.literal(false),
  error: z.object({
    code: z.enum(['NOT_FOUND', 'INVALID_INPUT', 'IO_ERROR', 'INTERNAL']),
    message: z.string(),
  }),
});
export const StandingsOverviewResponse = z.discriminatedUnion('ok', [
  StandingsOverviewOk,
  StandingsOverviewErr,
]);
export type StandingsOverviewResponse = z.infer<typeof StandingsOverviewResponse>;

export const STANDINGS_IPC_CHANNELS = {
  getOverview: 'standings:getOverview',
} as const;
