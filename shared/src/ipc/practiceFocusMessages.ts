// Sprint 34 — practiceFocus IPC channels.

import { z } from 'zod';
import { PracticeFocusModifierSchema } from '../season/practiceFocus';

const ErrCode = z.enum([
  'NOT_FOUND',
  'NO_SEASON',
  'WEEK_ALREADY_PLAYED',
  'INVALID_INPUT',
  'INTERNAL',
]);
const Err = z.object({
  ok: z.literal(false),
  error: z.object({ code: ErrCode, message: z.string() }),
});

const OffenseFocusSchema = z.enum([
  'POWER_HITTING',
  'BALL_CONTROL',
  'SERVE_AGGRESSION',
  'TRANSITION_OFFENSE',
]);
const DefenseFocusSchema = z.enum([
  'BLOCK_HEAVY',
  'DEFEND_TIPS_ROLLS',
  'DEFEND_POWER_HITTING',
  'SERVE_RECEIVE_FOCUS',
]);

const OpponentSummarySchema = z.object({
  serveAceRate: z.number(),
  aceAllowedRate: z.number(),
  hittingPct: z.number(),
  blockPerSet: z.number(),
  digPerSet: z.number(),
  attackErrorRate: z.number(),
});

// --- getWeekState ---
export const GetWeekStateRequest = z.object({
  slotId: z.string().min(1),
  teamId: z.string().min(1),
  week: z.number().int(),
});
export type GetWeekStateRequest = z.infer<typeof GetWeekStateRequest>;

export const GetWeekStateOk = z.object({
  ok: z.literal(true),
  week: z.number().int(),
  offenseFocus: OffenseFocusSchema,
  defenseFocus: DefenseFocusSchema,
  autoOffenseSuggestion: OffenseFocusSchema,
  autoDefenseSuggestion: DefenseFocusSchema,
  opponentSummary: OpponentSummarySchema,
  fromUserPick: z.boolean(),
  /** True when a next match exists for this team in the requested week. */
  hasUpcomingMatch: z.boolean(),
  opponentTeamId: z.string().nullable(),
});
export const GetWeekStateResponse = z.discriminatedUnion('ok', [GetWeekStateOk, Err]);
export type GetWeekStateResponse = z.infer<typeof GetWeekStateResponse>;

// --- setPick ---
export const SetPickRequest = z.object({
  slotId: z.string().min(1),
  teamId: z.string().min(1),
  week: z.number().int(),
  offenseFocus: OffenseFocusSchema,
  defenseFocus: DefenseFocusSchema,
});
export type SetPickRequest = z.infer<typeof SetPickRequest>;

export const SetPickOk = z.object({ ok: z.literal(true) });
export const SetPickResponse = z.discriminatedUnion('ok', [SetPickOk, Err]);
export type SetPickResponse = z.infer<typeof SetPickResponse>;

export const PRACTICE_FOCUS_IPC_CHANNELS = {
  getWeekState: 'practiceFocus:getWeekState',
  setPick: 'practiceFocus:setPick',
} as const;

// Re-export modifier schema for convenience (downstream callers).
export { PracticeFocusModifierSchema };
