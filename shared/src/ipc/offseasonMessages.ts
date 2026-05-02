import { z } from 'zod';

const ErrCode = z.enum([
  'NOT_FOUND',
  'NOT_IN_OFFSEASON',
  'NOT_IN_PRESEASON',
  'NO_SEASON',
  'REDSHIRT_LOCKED',
  'PLAYER_NOT_ON_TEAM',
  'INTERNAL',
]);
const Err = z.object({
  ok: z.literal(false),
  error: z.object({ code: ErrCode, message: z.string() }),
});

// --- run offseason ---
export const RunRequest = z.object({ slotId: z.string().min(1) });
export type RunRequest = z.infer<typeof RunRequest>;
export const RunOk = z.object({
  ok: z.literal(true),
  playersGraduated: z.number().int(),
  playersCut: z.number().int(),
  teamsUpdated: z.number().int(),
  newSeasonYear: z.number().int(),
});
export const RunResponse = z.discriminatedUnion('ok', [RunOk, Err]);
export type RunResponse = z.infer<typeof RunResponse>;

// --- toggle redshirt ---
export const ToggleRedshirtRequest = z.object({
  slotId: z.string().min(1),
  teamId: z.string().min(1),
  playerId: z.string().min(1),
  redshirtUsed: z.boolean(),
});
export type ToggleRedshirtRequest = z.infer<typeof ToggleRedshirtRequest>;
export const ToggleRedshirtOk = z.object({
  ok: z.literal(true),
  redshirtUsed: z.boolean(),
});
export const ToggleRedshirtResponse = z.discriminatedUnion('ok', [ToggleRedshirtOk, Err]);
export type ToggleRedshirtResponse = z.infer<typeof ToggleRedshirtResponse>;

// --- preseason state ---
export const PreseasonStateRequest = z.object({
  slotId: z.string().min(1),
  teamId: z.string().min(1),
});
export type PreseasonStateRequest = z.infer<typeof PreseasonStateRequest>;

export const PreseasonRosterRow = z.object({
  playerId: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  position: z.string(),
  classYear: z.string(),
  overall: z.number().int(),
  redshirtUsed: z.boolean(),
  redshirtLocked: z.boolean(),
});
export type PreseasonRosterRow = z.infer<typeof PreseasonRosterRow>;

export const PreseasonStateOk = z.object({
  ok: z.literal(true),
  phase: z.string(),
  year: z.number().int(),
  roster: z.array(PreseasonRosterRow),
});
export const PreseasonStateResponse = z.discriminatedUnion('ok', [PreseasonStateOk, Err]);
export type PreseasonStateResponse = z.infer<typeof PreseasonStateResponse>;

// --- start regular ---
export const StartRegularRequest = z.object({ slotId: z.string().min(1) });
export type StartRegularRequest = z.infer<typeof StartRegularRequest>;
export const StartRegularOk = z.object({
  ok: z.literal(true),
  phase: z.string(),
  year: z.number().int(),
});
export const StartRegularResponse = z.discriminatedUnion('ok', [StartRegularOk, Err]);
export type StartRegularResponse = z.infer<typeof StartRegularResponse>;

export const OFFSEASON_IPC_CHANNELS = {
  run: 'offseason:run',
  toggleRedshirt: 'offseason:toggleRedshirt',
  preseasonState: 'offseason:preseasonState',
  startRegular: 'offseason:startRegular',
} as const;
