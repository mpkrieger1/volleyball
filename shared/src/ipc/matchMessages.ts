import { z } from 'zod';
import { MatchBoxScoreSchema } from '../sim/boxScore';
import { MatchPbpSchema } from '../sim/pbp';
import { MatchTimelineSchema } from '../sim/timeline';

export const SimulateMatchRequest = z.object({
  slotId: z.string().min(1),
  homeTeamId: z.string().min(1),
  awayTeamId: z.string().min(1),
  seed: z.union([z.number().int(), z.string().min(1)]),
});
export type SimulateMatchRequest = z.infer<typeof SimulateMatchRequest>;

export const SimulateMatchOk = z.object({
  ok: z.literal(true),
  matchId: z.string(),
  boxScore: MatchBoxScoreSchema,
  pbpChars: z.number().int().nonnegative(),
});
export const SimulateMatchErr = z.object({
  ok: z.literal(false),
  error: z.object({
    code: z.enum(['NOT_FOUND', 'INVALID_INPUT', 'IO_ERROR', 'INTERNAL']),
    message: z.string(),
  }),
});
export const SimulateMatchResponse = z.discriminatedUnion('ok', [SimulateMatchOk, SimulateMatchErr]);
export type SimulateMatchResponse = z.infer<typeof SimulateMatchResponse>;

export const ListTeamsRequest = z.object({ slotId: z.string().min(1) });
export type ListTeamsRequest = z.infer<typeof ListTeamsRequest>;

export const TeamSummary = z.object({
  id: z.string(),
  schoolName: z.string(),
  abbr: z.string(),
  conferenceId: z.string(),
  primaryColor: z.string(),
  secondaryColor: z.string(),
  prestige: z.number().int(),
});
export type TeamSummary = z.infer<typeof TeamSummary>;

export const ListTeamsOk = z.object({ ok: z.literal(true), teams: z.array(TeamSummary) });
export const ListTeamsErr = z.object({
  ok: z.literal(false),
  error: z.object({
    code: z.enum(['NOT_FOUND', 'IO_ERROR']),
    message: z.string(),
  }),
});
export const ListTeamsResponse = z.discriminatedUnion('ok', [ListTeamsOk, ListTeamsErr]);
export type ListTeamsResponse = z.infer<typeof ListTeamsResponse>;

// --- match.getById ---
// Sprint 19: load a stored match's full replay payload by id.
export const GetMatchByIdRequest = z.object({
  slotId: z.string().min(1),
  matchId: z.string().min(1),
});
export type GetMatchByIdRequest = z.infer<typeof GetMatchByIdRequest>;

export const MatchSideMeta = z.object({
  teamId: z.string(),
  teamName: z.string(),
  teamAbbr: z.string(),
  primaryColor: z.string(),
  secondaryColor: z.string(),
  /** Slot 0..5 → player display name (Sprint 18 pickStartersForTeam). */
  lineupSlots: z.array(z.string()).length(6),
});
export type MatchSideMeta = z.infer<typeof MatchSideMeta>;

export const SetSummary = z.object({
  index: z.number().int().nonnegative(),
  home: z.number().int().nonnegative(),
  away: z.number().int().nonnegative(),
  durationSec: z.number().int().nonnegative(),
});
export type SetSummary = z.infer<typeof SetSummary>;

export const GetMatchByIdOk = z.object({
  ok: z.literal(true),
  match: z.object({
    id: z.string(),
    date: z.string(),
    week: z.number().int(),
    isTournament: z.boolean(),
    tournamentRound: z.string().nullable(),
    homeTeamId: z.string(),
    awayTeamId: z.string(),
    winnerId: z.string().nullable(),
    homeSetsWon: z.number().int(),
    awaySetsWon: z.number().int(),
  }),
  home: MatchSideMeta,
  away: MatchSideMeta,
  boxScore: MatchBoxScoreSchema,
  pbp: MatchPbpSchema,
  timeline: MatchTimelineSchema,
  sets: z.array(SetSummary),
});
export const GetMatchByIdErr = z.object({
  ok: z.literal(false),
  error: z.object({
    code: z.enum(['NOT_FOUND', 'IO_ERROR', 'INTERNAL']),
    message: z.string(),
  }),
});
export const GetMatchByIdResponse = z.discriminatedUnion('ok', [GetMatchByIdOk, GetMatchByIdErr]);
export type GetMatchByIdResponse = z.infer<typeof GetMatchByIdResponse>;

// --- match.getAnalytics ---
// Sprint 20: extends getMatchById response with per-slot block ratings +
// positions for the analytics K/set vs opponent block scatter chart.
export const GetMatchAnalyticsRequest = z.object({
  slotId: z.string().min(1),
  matchId: z.string().min(1),
});
export type GetMatchAnalyticsRequest = z.infer<typeof GetMatchAnalyticsRequest>;

export const MatchAnalyticsSideMeta = MatchSideMeta.extend({
  /** Slot 0..5 → Player.ratingBlock for the lineup picked at match time. */
  lineupRatingsBlock: z.array(z.number().int()).length(6),
  /** Slot 0..5 → Player.position labels. */
  lineupPositions: z.array(z.string()).length(6),
  /** Slot 0..5 → Player.id (for chart hover/aggregation keys). */
  lineupPlayerIds: z.array(z.string()).length(6),
});
export type MatchAnalyticsSideMeta = z.infer<typeof MatchAnalyticsSideMeta>;

export const GetMatchAnalyticsOk = z.object({
  ok: z.literal(true),
  match: GetMatchByIdOk.shape.match,
  home: MatchAnalyticsSideMeta,
  away: MatchAnalyticsSideMeta,
  boxScore: MatchBoxScoreSchema,
  pbp: MatchPbpSchema,
  timeline: MatchTimelineSchema,
  sets: z.array(SetSummary),
  setsPlayed: z.number().int().nonnegative(),
});
export const GetMatchAnalyticsErr = z.object({
  ok: z.literal(false),
  error: z.object({
    code: z.enum(['NOT_FOUND', 'IO_ERROR', 'INTERNAL']),
    message: z.string(),
  }),
});
export const GetMatchAnalyticsResponse = z.discriminatedUnion('ok', [
  GetMatchAnalyticsOk,
  GetMatchAnalyticsErr,
]);
export type GetMatchAnalyticsResponse = z.infer<typeof GetMatchAnalyticsResponse>;

// --- match.listRecentMatches ---
// Sprint 20: dropdown source for the AnalyticsView match selector.
export const ListRecentMatchesRequest = z.object({
  slotId: z.string().min(1),
  limit: z.number().int().positive().max(200).optional(),
});
export type ListRecentMatchesRequest = z.infer<typeof ListRecentMatchesRequest>;

export const RecentMatchSummary = z.object({
  matchId: z.string(),
  date: z.string(),
  week: z.number().int(),
  homeTeamId: z.string(),
  homeName: z.string(),
  homeAbbr: z.string(),
  homeSetsWon: z.number().int(),
  awayTeamId: z.string(),
  awayName: z.string(),
  awayAbbr: z.string(),
  awaySetsWon: z.number().int(),
  isTournament: z.boolean(),
});
export type RecentMatchSummary = z.infer<typeof RecentMatchSummary>;

export const ListRecentMatchesOk = z.object({
  ok: z.literal(true),
  matches: z.array(RecentMatchSummary),
});
export const ListRecentMatchesErr = z.object({
  ok: z.literal(false),
  error: z.object({ code: z.enum(['NOT_FOUND', 'IO_ERROR']), message: z.string() }),
});
export const ListRecentMatchesResponse = z.discriminatedUnion('ok', [
  ListRecentMatchesOk,
  ListRecentMatchesErr,
]);
export type ListRecentMatchesResponse = z.infer<typeof ListRecentMatchesResponse>;

export const MATCH_IPC_CHANNELS = {
  simulate: 'match:simulate',
  listTeams: 'match:listTeams',
  getById: 'match:getById',
  getAnalytics: 'match:getAnalytics',
  listRecentMatches: 'match:listRecentMatches',
} as const;
