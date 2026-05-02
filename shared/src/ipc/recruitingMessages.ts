import { z } from 'zod';

export const RECRUITING_ACTION_TYPES = [
  'CALL',
  'UNOFFICIAL_VISIT',
  'HOME_VISIT',
  'OFFICIAL_VISIT',
] as const;
export const RecruitingActionType = z.enum(RECRUITING_ACTION_TYPES);
export type RecruitingActionType = z.infer<typeof RecruitingActionType>;

const ErrCode = z.enum(['NOT_FOUND', 'INVALID_INPUT', 'NOT_RECRUITING', 'INSUFFICIENT_BUDGET', 'RECRUIT_NOT_PENDING', 'INTERNAL']);
const Err = z.object({
  ok: z.literal(false),
  error: z.object({ code: ErrCode, message: z.string() }),
});

// --- open ---
export const OpenCycleRequest = z.object({
  slotId: z.string().min(1),
  seasonYear: z.number().int(),
  classSize: z.number().int().positive().optional(),
});
export type OpenCycleRequest = z.infer<typeof OpenCycleRequest>;
export const OpenCycleOk = z.object({
  ok: z.literal(true),
  recruitsCreated: z.number().int().nonnegative(),
  interestsSeeded: z.number().int().nonnegative(),
});
export const OpenCycleResponse = z.discriminatedUnion('ok', [OpenCycleOk, Err]);
export type OpenCycleResponse = z.infer<typeof OpenCycleResponse>;

// --- action ---
export const ActionRequest = z.object({
  slotId: z.string().min(1),
  teamId: z.string().min(1),
  recruitId: z.string().min(1),
  action: RecruitingActionType,
});
export type ActionRequest = z.infer<typeof ActionRequest>;
export const ActionOk = z.object({
  ok: z.literal(true),
  newInterest: z.number().int(),
  budgetRemaining: z.number().int(),
  week: z.number().int(),
});
export const ActionResponse = z.discriminatedUnion('ok', [ActionOk, Err]);
export type ActionResponse = z.infer<typeof ActionResponse>;

// --- advance ---
export const AdvanceRequest = z.object({
  slotId: z.string().min(1),
  userTeamId: z.string().nullable().optional(),
});
export type AdvanceRequest = z.infer<typeof AdvanceRequest>;
export const AdvanceOk = z.object({
  ok: z.literal(true),
  week: z.number().int(),
  aiActionsApplied: z.number().int(),
  commitsResolved: z.number().int(),
});
export const AdvanceResponse = z.discriminatedUnion('ok', [AdvanceOk, Err]);
export type AdvanceResponse = z.infer<typeof AdvanceResponse>;

// --- close ---
export const CloseRequest = z.object({ slotId: z.string().min(1) });
export type CloseRequest = z.infer<typeof CloseRequest>;
export const CloseOk = z.object({
  ok: z.literal(true),
  uncommittedCount: z.number().int(),
});
export const CloseResponse = z.discriminatedUnion('ok', [CloseOk, Err]);
export type CloseResponse = z.infer<typeof CloseResponse>;

// --- state (board snapshot) ---
export const StateRequest = z.object({
  slotId: z.string().min(1),
  teamId: z.string().min(1),
});
export type StateRequest = z.infer<typeof StateRequest>;

export const BoardRecruitView = z.object({
  recruitId: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  position: z.string(),
  stars: z.number().int(),
  height: z.number().int().nullable(),
  hometownCity: z.string().nullable(),
  hometownState: z.string().nullable(),
  hometownRegion: z.string().nullable(),
  commitState: z.string(),
  commitTeamId: z.string().nullable(),
  interest: z.number().int(),
});
export type BoardRecruitView = z.infer<typeof BoardRecruitView>;

export const StateOk = z.object({
  ok: z.literal(true),
  phase: z.string(),
  week: z.number().int(),
  budgetRemaining: z.number().int(),
  recruits: z.array(BoardRecruitView),
});
export const StateResponse = z.discriminatedUnion('ok', [StateOk, Err]);
export type StateResponse = z.infer<typeof StateResponse>;

export const RECRUITING_IPC_CHANNELS = {
  open: 'recruiting:open',
  action: 'recruiting:action',
  advance: 'recruiting:advance',
  close: 'recruiting:close',
  state: 'recruiting:state',
} as const;
