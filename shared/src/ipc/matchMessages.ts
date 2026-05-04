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

// Sprint 28: season-aggregate analytics for the Analytics screen's
// "Season" view-mode. Pulls per-match summaries + per-player season
// totals + team trend lines for the user's team.
export const SeasonAnalyticsRequest = z.object({
  slotId: z.string().min(1),
  teamId: z.string().min(1),
});
export type SeasonAnalyticsRequest = z.infer<typeof SeasonAnalyticsRequest>;

export const SeasonMatchTrend = z.object({
  matchId: z.string(),
  weekIndex: z.number().int(),
  isoDate: z.string(),
  opponentAbbr: z.string(),
  isHome: z.boolean(),
  /** This team's set count in the match. */
  setsWon: z.number().int().nonnegative(),
  setsLost: z.number().int().nonnegative(),
  /** This team's match-level hitting percent × 1000. */
  hittingPctMilli: z.number().int(),
  oppHittingPctMilli: z.number().int(),
  kills: z.number().int().nonnegative(),
  oppKills: z.number().int().nonnegative(),
});
export type SeasonMatchTrend = z.infer<typeof SeasonMatchTrend>;

export const SeasonPlayerTotal = z.object({
  playerId: z.string(),
  playerName: z.string(),
  position: z.string(),
  setsPlayed: z.number().int().nonnegative(),
  matchesPlayed: z.number().int().nonnegative(),
  kills: z.number().int().nonnegative(),
  errors: z.number().int().nonnegative(),
  totalAttacks: z.number().int().nonnegative(),
  hittingPctMilli: z.number().int(),
  killsPerSetMilli: z.number().int(),
  digs: z.number().int().nonnegative(),
  blocks: z.number().int().nonnegative(),
  aces: z.number().int().nonnegative(),
  assists: z.number().int().nonnegative(),
});
export type SeasonPlayerTotal = z.infer<typeof SeasonPlayerTotal>;

export const SeasonAnalyticsOk = z.object({
  ok: z.literal(true),
  team: z.object({
    teamId: z.string(),
    teamAbbr: z.string(),
    teamSchool: z.string(),
    seasonYear: z.number().int(),
    matchesPlayed: z.number().int().nonnegative(),
    wins: z.number().int().nonnegative(),
    losses: z.number().int().nonnegative(),
    setsWon: z.number().int().nonnegative(),
    setsLost: z.number().int().nonnegative(),
    teamHittingPctMilli: z.number().int(),
    oppHittingPctMilli: z.number().int(),
    totalKills: z.number().int().nonnegative(),
    totalAces: z.number().int().nonnegative(),
    totalBlocks: z.number().int().nonnegative(),
    totalDigs: z.number().int().nonnegative(),
  }),
  trend: z.array(SeasonMatchTrend),
  players: z.array(SeasonPlayerTotal),
});
export const SeasonAnalyticsErr = z.object({
  ok: z.literal(false),
  error: z.object({
    code: z.enum(['NOT_FOUND', 'INVALID_INPUT', 'IO_ERROR', 'INTERNAL']),
    message: z.string(),
  }),
});
export const SeasonAnalyticsResponse = z.discriminatedUnion('ok', [
  SeasonAnalyticsOk,
  SeasonAnalyticsErr,
]);
export type SeasonAnalyticsResponse = z.infer<typeof SeasonAnalyticsResponse>;

export const MATCH_IPC_CHANNELS = {
  simulate: 'match:simulate',
  listTeams: 'match:listTeams',
  getById: 'match:getById',
  getAnalytics: 'match:getAnalytics',
  listRecentMatches: 'match:listRecentMatches',
  seasonAnalytics: 'match:seasonAnalytics',
} as const;
