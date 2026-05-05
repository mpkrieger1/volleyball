import { z } from 'zod';
import { PlayerLineupSchema } from '../sim/lineup';
import { MatchBoxScoreSchema } from '../sim/boxScore';
import { MatchTimelineSchema } from '../sim/timeline';
import { PracticeFocusModifierSchema } from '../season/practiceFocus';

// ─────────────────────────────────────────────────────────────
// Worker-thread contract (main process ↔ simWorker thread)
// ─────────────────────────────────────────────────────────────

export const WorkerSimRequest = z.object({
  matchId: z.string(),
  homeTeamId: z.string(),
  awayTeamId: z.string(),
  homeLineup: PlayerLineupSchema,
  awayLineup: PlayerLineupSchema,
  seed: z.union([z.number().int(), z.string().min(1)]),
  // Sprint 34: optional per-side practice-focus modifiers. When omitted,
  // the worker passes `undefined` to simulateMatch and the calibration
  // byte-equality invariant holds (CLAUDE.md §Critical rules #2).
  homeModifier: PracticeFocusModifierSchema.optional(),
  awayModifier: PracticeFocusModifierSchema.optional(),
});
export type WorkerSimRequest = z.infer<typeof WorkerSimRequest>;

export const WorkerSimOk = z.object({
  ok: z.literal(true),
  matchId: z.string(),
  homeTeamId: z.string(),
  awayTeamId: z.string(),
  winnerId: z.string(),
  boxScore: MatchBoxScoreSchema,
  pbpJson: z.string(),
  setScores: z.array(z.object({ home: z.number().int(), away: z.number().int() })),
  /** Sprint 19: timeout + substitution timeline for the Match Hub ticker. */
  timeline: MatchTimelineSchema,
});
export const WorkerSimErr = z.object({
  ok: z.literal(false),
  matchId: z.string(),
  error: z.string(),
});
export const WorkerSimResponse = z.discriminatedUnion('ok', [WorkerSimOk, WorkerSimErr]);
export type WorkerSimResponse = z.infer<typeof WorkerSimResponse>;

// ─────────────────────────────────────────────────────────────
// Renderer ↔ Main IPC (season:advanceWeek / season:cancel / season:progress)
// ─────────────────────────────────────────────────────────────

export const AdvanceWeekRequest = z.object({
  slotId: z.string().min(1),
  cancellationId: z.string().optional(),
});
export type AdvanceWeekRequest = z.infer<typeof AdvanceWeekRequest>;

export const AdvanceWeekOk = z.object({
  ok: z.literal(true),
  week: z.number().int().nonnegative(),
  matchesPlayed: z.number().int().nonnegative(),
  elapsedMs: z.number().int().nonnegative(),
});
export const AdvanceWeekErr = z.object({
  ok: z.literal(false),
  error: z.object({
    code: z.enum(['NOT_FOUND', 'CANCELLED', 'INVALID_INPUT', 'INTERNAL']),
    message: z.string(),
  }),
});
export const AdvanceWeekResponse = z.discriminatedUnion('ok', [AdvanceWeekOk, AdvanceWeekErr]);
export type AdvanceWeekResponse = z.infer<typeof AdvanceWeekResponse>;

export const CancelAdvanceRequest = z.object({ cancellationId: z.string().min(1) });
export type CancelAdvanceRequest = z.infer<typeof CancelAdvanceRequest>;

export const SeasonProgressEvent = z.object({
  cancellationId: z.string(),
  week: z.number().int().nonnegative(),
  totalMatches: z.number().int().nonnegative(),
  completedMatches: z.number().int().nonnegative(),
  phase: z.enum(['sim', 'persist', 'done']),
});
export type SeasonProgressEvent = z.infer<typeof SeasonProgressEvent>;

export const GetCurrentWeekRequest = z.object({ slotId: z.string().min(1) });
export type GetCurrentWeekRequest = z.infer<typeof GetCurrentWeekRequest>;

export const GetCurrentWeekOk = z.object({
  ok: z.literal(true),
  currentWeek: z.number().int().nonnegative(),
  phase: z.string(),
});
export const GetCurrentWeekErr = z.object({
  ok: z.literal(false),
  error: z.object({
    code: z.enum(['NOT_FOUND', 'INTERNAL']),
    message: z.string(),
  }),
});
export const GetCurrentWeekResponse = z.discriminatedUnion('ok', [
  GetCurrentWeekOk,
  GetCurrentWeekErr,
]);
export type GetCurrentWeekResponse = z.infer<typeof GetCurrentWeekResponse>;

// --- season.getUserTeam / season.setUserTeam ---
// Sprint 21: closes the 11-sprint user-team-picker gap. Stores the user's
// chosen program at save creation; existing screens migrate from the
// `teams[0]` fallback to this canonical id.
export const GetUserTeamRequest = z.object({ slotId: z.string().min(1) });
export type GetUserTeamRequest = z.infer<typeof GetUserTeamRequest>;

export const GetUserTeamOk = z.object({
  ok: z.literal(true),
  userTeamId: z.string().nullable(),
});
export const GetUserTeamErr = z.object({
  ok: z.literal(false),
  error: z.object({
    code: z.enum(['NOT_FOUND', 'INTERNAL']),
    message: z.string(),
  }),
});
export const GetUserTeamResponse = z.discriminatedUnion('ok', [GetUserTeamOk, GetUserTeamErr]);
export type GetUserTeamResponse = z.infer<typeof GetUserTeamResponse>;

export const SetUserTeamRequest = z.object({
  slotId: z.string().min(1),
  teamId: z.string().min(1),
});
export type SetUserTeamRequest = z.infer<typeof SetUserTeamRequest>;

export const SetUserTeamOk = z.object({
  ok: z.literal(true),
  userTeamId: z.string(),
});
export const SetUserTeamErr = z.object({
  ok: z.literal(false),
  error: z.object({
    code: z.enum(['NOT_FOUND', 'INTERNAL']),
    message: z.string(),
  }),
});
export const SetUserTeamResponse = z.discriminatedUnion('ok', [SetUserTeamOk, SetUserTeamErr]);
export type SetUserTeamResponse = z.infer<typeof SetUserTeamResponse>;

export const SEASON_IPC_CHANNELS = {
  advanceWeek: 'season:advanceWeek',
  cancel: 'season:cancel',
  progress: 'season:progress',
  getCurrentWeek: 'season:getCurrentWeek',
  getUserTeam: 'season:getUserTeam',
  setUserTeam: 'season:setUserTeam',
} as const;
