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

// Sprint 33: event-aware advance + training-focus picker channels.

export const TRAINABLE_SKILLS = [
  'attack', 'block', 'serve', 'pass', 'set', 'dig',
  'athleticism', 'iq', 'stamina',
] as const;
export const TrainableSkillSchema = z.enum(TRAINABLE_SKILLS);

// --- advance event ---
export const AdvanceEventRequest = z.object({
  slotId: z.string().min(1),
  teamId: z.string().min(1).nullish(),
});
export type AdvanceEventRequest = z.infer<typeof AdvanceEventRequest>;
export const AdvanceEventOk = z.object({
  ok: z.literal(true),
  event: z.string().nullable(),
  cursorAfter: z.object({
    phase: z.string(),
    phaseWeek: z.number().int(),
  }),
  summary: z.unknown(),
});
export const AdvanceEventResponse = z.discriminatedUnion('ok', [AdvanceEventOk, Err]);
export type AdvanceEventResponse = z.infer<typeof AdvanceEventResponse>;

// --- get event state ---
export const EventStateRequest = z.object({
  slotId: z.string().min(1),
  teamId: z.string().min(1),
});
export type EventStateRequest = z.infer<typeof EventStateRequest>;

export const CoachSlotInfo = z.object({
  coachId: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  role: z.enum(['HC', 'AHC', 'AC']),
  ratingDevelop: z.number().int(),
  validFocuses: z.array(TrainableSkillSchema),
  defaultPicks: z.array(TrainableSkillSchema), // length 3, by slot
  currentPicks: z.array(TrainableSkillSchema.nullable()), // length 3
});
export type CoachSlotInfo = z.infer<typeof CoachSlotInfo>;

export const EventStateOk = z.object({
  ok: z.literal(true),
  phase: z.string(),
  phaseWeek: z.number().int(),
  year: z.number().int(),
  event: z.string().nullable(),
  /** TRAINING_FOCUS payload: per-coach picker info. Empty otherwise. */
  trainingFocus: z.object({
    coaches: z.array(CoachSlotInfo),
    facilitiesLevel: z.number().int(),
  }).nullable(),
});
export const EventStateResponse = z.discriminatedUnion('ok', [EventStateOk, Err]);
export type EventStateResponse = z.infer<typeof EventStateResponse>;

// --- set training focus pick ---
export const SetTrainingFocusPickRequest = z.object({
  slotId: z.string().min(1),
  teamId: z.string().min(1),
  coachId: z.string().min(1),
  slotIndex: z.number().int().min(0).max(2),
  attribute: TrainableSkillSchema,
});
export type SetTrainingFocusPickRequest = z.infer<typeof SetTrainingFocusPickRequest>;
export const SetTrainingFocusPickOk = z.object({ ok: z.literal(true) });
export const SetTrainingFocusPickResponse = z.discriminatedUnion('ok', [
  SetTrainingFocusPickOk,
  Err,
]);
export type SetTrainingFocusPickResponse = z.infer<typeof SetTrainingFocusPickResponse>;

// --- list training results ---
export const ListTrainingResultsRequest = z.object({
  slotId: z.string().min(1),
  teamId: z.string().min(1),
  seasonYear: z.number().int(),
});
export type ListTrainingResultsRequest = z.infer<typeof ListTrainingResultsRequest>;
export const TrainingResultRow = z.object({
  playerId: z.string(),
  playerName: z.string(),
  attribute: z.string(),
  gainApplied: z.number().int(),
  wasBreakthrough: z.boolean(),
});
export type TrainingResultRow = z.infer<typeof TrainingResultRow>;
export const ListTrainingResultsOk = z.object({
  ok: z.literal(true),
  rows: z.array(TrainingResultRow),
});
export const ListTrainingResultsResponse = z.discriminatedUnion('ok', [
  ListTrainingResultsOk,
  Err,
]);
export type ListTrainingResultsResponse = z.infer<typeof ListTrainingResultsResponse>;

export const OFFSEASON_IPC_CHANNELS = {
  run: 'offseason:run',
  toggleRedshirt: 'offseason:toggleRedshirt',
  preseasonState: 'offseason:preseasonState',
  startRegular: 'offseason:startRegular',
  advanceEvent: 'offseason:advanceEvent',
  getEventState: 'offseason:getEventState',
  setTrainingFocusPick: 'offseason:setTrainingFocusPick',
  listTrainingResults: 'offseason:listTrainingResults',
} as const;
