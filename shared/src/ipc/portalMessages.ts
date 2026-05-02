import { z } from 'zod';

export const PORTAL_ACTION_TYPES = [
  'CALL',
  'UNOFFICIAL_VISIT',
  'HOME_VISIT',
  'OFFICIAL_VISIT',
  'OFFER_NIL',
] as const;
export const PortalActionType = z.enum(PORTAL_ACTION_TYPES);
export type PortalActionType = z.infer<typeof PortalActionType>;

const ErrCode = z.enum([
  'NOT_FOUND',
  'INVALID_INPUT',
  'NOT_PORTAL_PHASE',
  'INSUFFICIENT_BUDGET',
  'PORTAL_ENTRY_NOT_ACTIVE',
  'INVALID_NIL_AMOUNT',
  'INTERNAL',
]);
const Err = z.object({
  ok: z.literal(false),
  error: z.object({ code: ErrCode, message: z.string() }),
});

// --- open ---
export const OpenRequest = z.object({ slotId: z.string().min(1) });
export type OpenRequest = z.infer<typeof OpenRequest>;
export const OpenOk = z.object({
  ok: z.literal(true),
  entrants: z.number().int().nonnegative(),
  interestsSeeded: z.number().int().nonnegative(),
});
export const OpenResponse = z.discriminatedUnion('ok', [OpenOk, Err]);
export type OpenResponse = z.infer<typeof OpenResponse>;

// --- action ---
export const ActionRequest = z.object({
  slotId: z.string().min(1),
  teamId: z.string().min(1),
  transferPortalId: z.string().min(1),
  action: PortalActionType,
  nilAmountCents: z.number().int().nonnegative().optional(),
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
  signedCount: z.number().int(),
  unsignedCount: z.number().int(),
  nilDealsCreated: z.number().int(),
});
export const CloseResponse = z.discriminatedUnion('ok', [CloseOk, Err]);
export type CloseResponse = z.infer<typeof CloseResponse>;

// --- state ---
export const StateRequest = z.object({
  slotId: z.string().min(1),
  teamId: z.string().min(1),
});
export type StateRequest = z.infer<typeof StateRequest>;

export const PortalEntryView = z.object({
  transferPortalId: z.string(),
  playerId: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  position: z.string(),
  classYear: z.string(),
  overall: z.number().int(),
  originTeamId: z.string(),
  status: z.string(),
  myInterest: z.number().int(),
  actionsSpent: z.number().int(),
  lastNilOffer: z.number().int(),
});
export type PortalEntryView = z.infer<typeof PortalEntryView>;

export const StateOk = z.object({
  ok: z.literal(true),
  phase: z.string(),
  week: z.number().int(),
  budgetRemaining: z.number().int(),
  incoming: z.array(PortalEntryView),
  outgoing: z.array(PortalEntryView),
});
export const StateResponse = z.discriminatedUnion('ok', [StateOk, Err]);
export type StateResponse = z.infer<typeof StateResponse>;

export const PORTAL_IPC_CHANNELS = {
  open: 'portal:open',
  action: 'portal:action',
  advance: 'portal:advance',
  close: 'portal:close',
  state: 'portal:state',
} as const;
