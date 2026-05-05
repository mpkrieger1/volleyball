import { z } from 'zod';

export const GenerateScheduleRequest = z.object({
  slotId: z.string().min(1),
  seasonYear: z.number().int(),
  seed: z.union([z.number().int(), z.string().min(1)]),
});
export type GenerateScheduleRequest = z.infer<typeof GenerateScheduleRequest>;

export const GenerateScheduleOk = z.object({
  ok: z.literal(true),
  stats: z.object({
    totalMatches: z.number().int().nonnegative(),
    confMatches: z.number().int().nonnegative(),
    nonConfMatches: z.number().int().nonnegative(),
    tournamentMatches: z.number().int().nonnegative(),
  }),
});
export const GenerateScheduleErr = z.object({
  ok: z.literal(false),
  error: z.object({
    code: z.enum(['NOT_FOUND', 'INVALID_INPUT', 'IO_ERROR', 'INTERNAL']),
    message: z.string(),
  }),
});
export const GenerateScheduleResponse = z.discriminatedUnion('ok', [
  GenerateScheduleOk,
  GenerateScheduleErr,
]);
export type GenerateScheduleResponse = z.infer<typeof GenerateScheduleResponse>;

export const ListTeamScheduleRequest = z.object({
  slotId: z.string().min(1),
  teamId: z.string().min(1),
});
export type ListTeamScheduleRequest = z.infer<typeof ListTeamScheduleRequest>;

export const TeamScheduleRow = z.object({
  matchId: z.string(),
  weekIndex: z.number().int(),
  isoDate: z.string(),
  opponentId: z.string(),
  opponentSchool: z.string(),
  opponentAbbr: z.string(),
  isHome: z.boolean(),
  isConference: z.boolean(),
  isTournament: z.boolean(),
  isNeutralSite: z.boolean(),
  winnerId: z.string().nullable(),
  // Sprint 28: per-match set scores so the schedule UI can render results
  // for completed matches. Both sides null when match is unplayed.
  homeSetsWon: z.number().int().nullable(),
  awaySetsWon: z.number().int().nullable(),
  // Sprint 28: tournament round name (e.g. 'CT_R1', 'NCAA_R64'). Null for
  // regular-season matches. Lets the UI render "CT R1" instead of just a
  // week number for tournament rows.
  tournamentRound: z.string().nullable(),
  // Sprint 37 (post-launch UAT): opponent team overall (avg of player
  // overalls). Distinct from prestige; null if opponent has no players.
  opponentOverall: z.number().int().nullable(),
});
export type TeamScheduleRow = z.infer<typeof TeamScheduleRow>;

export const ListTeamScheduleOk = z.object({
  ok: z.literal(true),
  rows: z.array(TeamScheduleRow),
});
export const ListTeamScheduleErr = z.object({
  ok: z.literal(false),
  error: z.object({
    code: z.enum(['NOT_FOUND', 'IO_ERROR']),
    message: z.string(),
  }),
});
export const ListTeamScheduleResponse = z.discriminatedUnion('ok', [
  ListTeamScheduleOk,
  ListTeamScheduleErr,
]);
export type ListTeamScheduleResponse = z.infer<typeof ListTeamScheduleResponse>;

export const SCHEDULE_IPC_CHANNELS = {
  generate: 'schedule:generate',
  listForTeam: 'schedule:listForTeam',
} as const;
