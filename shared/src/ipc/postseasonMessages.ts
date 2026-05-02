import { z } from 'zod';

export const TOURNAMENT_ROUNDS_ENUM = [
  'CT_R1',
  'CT_SF',
  'CT_F',
  'NCAA_R64',
  'NCAA_R32',
  'NCAA_S16',
  'NCAA_E8',
  'NCAA_FF',
  'NCAA_CHAMP',
] as const;
export const TournamentRound = z.enum(TOURNAMENT_ROUNDS_ENUM);
export type TournamentRound = z.infer<typeof TournamentRound>;

const ErrCode = z.enum(['NOT_FOUND', 'INVALID_INPUT', 'INTERNAL']);
const Err = z.object({ ok: z.literal(false), error: z.object({ code: ErrCode, message: z.string() }) });

// --- start CT ---
export const StartCtRequest = z.object({ slotId: z.string().min(1) });
export type StartCtRequest = z.infer<typeof StartCtRequest>;
export const StartCtOk = z.object({
  ok: z.literal(true),
  matchesCreated: z.number().int().nonnegative(),
});
export const StartCtResponse = z.discriminatedUnion('ok', [StartCtOk, Err]);
export type StartCtResponse = z.infer<typeof StartCtResponse>;

// --- start NCAA ---
export const StartNcaaRequest = z.object({
  slotId: z.string().min(1),
  seasonYear: z.number().int(),
});
export type StartNcaaRequest = z.infer<typeof StartNcaaRequest>;
export const StartNcaaOk = z.object({
  ok: z.literal(true),
  r64MatchesCreated: z.number().int().nonnegative(),
  autoBidCount: z.number().int().nonnegative(),
});
export const StartNcaaResponse = z.discriminatedUnion('ok', [StartNcaaOk, Err]);
export type StartNcaaResponse = z.infer<typeof StartNcaaResponse>;

// --- advance round ---
export const AdvanceRoundRequest = z.object({
  slotId: z.string().min(1),
  round: TournamentRound,
});
export type AdvanceRoundRequest = z.infer<typeof AdvanceRoundRequest>;
export const AdvanceRoundOk = z.object({
  ok: z.literal(true),
  round: TournamentRound,
  matchesPlayed: z.number().int().nonnegative(),
  nextRoundCreated: z.number().int().nonnegative(),
  championTeamId: z.string().optional(),
});
export const AdvanceRoundResponse = z.discriminatedUnion('ok', [AdvanceRoundOk, Err]);
export type AdvanceRoundResponse = z.infer<typeof AdvanceRoundResponse>;

// --- state (renderer loads current post-season state) ---
export const GetStateRequest = z.object({ slotId: z.string().min(1) });
export type GetStateRequest = z.infer<typeof GetStateRequest>;

export const TourneyMatchView = z.object({
  matchId: z.string(),
  round: TournamentRound,
  bracketSlot: z.number().int().nonnegative(),
  bracketGroupKey: z.string(),
  homeTeamId: z.string(),
  awayTeamId: z.string(),
  homeTeamAbbr: z.string(),
  awayTeamAbbr: z.string(),
  homeTeamSchool: z.string(),
  awayTeamSchool: z.string(),
  winnerId: z.string().nullable(),
  setScores: z.array(z.object({ home: z.number().int(), away: z.number().int() })),
});
export type TourneyMatchView = z.infer<typeof TourneyMatchView>;

export const GetStateOk = z.object({
  ok: z.literal(true),
  phase: z.string(),
  seasonYear: z.number().int(),
  championTeamId: z.string().nullable(),
  championTeamSchool: z.string().nullable(),
  matches: z.array(TourneyMatchView),
});
export const GetStateResponse = z.discriminatedUnion('ok', [GetStateOk, Err]);
export type GetStateResponse = z.infer<typeof GetStateResponse>;

export const POSTSEASON_IPC_CHANNELS = {
  startCt: 'postseason:start-ct',
  startNcaa: 'postseason:start-ncaa',
  advanceRound: 'postseason:advance-round',
  getState: 'postseason:state',
} as const;
