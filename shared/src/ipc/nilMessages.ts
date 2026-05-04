import { z } from 'zod';

const ErrCode = z.enum([
  'NOT_FOUND',
  'INVALID_AMOUNT',
  'INSUFFICIENT_BUDGET',
  'BOOSTER_NOT_FOUND',
  'PLAYER_NOT_ON_TEAM',
  'NIL_CLOSED',
  'INTERNAL',
]);
const Err = z.object({
  ok: z.literal(false),
  error: z.object({ code: ErrCode, message: z.string() }),
});

export const StateRequest = z.object({
  slotId: z.string().min(1),
  teamId: z.string().min(1),
});
export type StateRequest = z.infer<typeof StateRequest>;

export const NilRosterRowView = z.object({
  playerId: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  position: z.string(),
  classYear: z.string(),
  overall: z.number().int(),
  valueCents: z.number().int(),
  currentNilCents: z.number().int(),
});
export type NilRosterRowView = z.infer<typeof NilRosterRowView>;

export const StateOk = z.object({
  ok: z.literal(true),
  collectiveBudget: z.number().int(),
  totalSpent: z.number().int(),
  remaining: z.number().int(),
  enthusiasm: z.number().int(),
  roster: z.array(NilRosterRowView),
  /** Sprint 28: current Season.phase, surfaced so the renderer can gate the
   * NIL UI without an extra IPC call. NIL is open during OFFSEASON /
   * RECRUITING / PORTAL / PRESEASON; closed once REGULAR begins. */
  phase: z.string(),
  isOpen: z.boolean(),
});
export const StateResponse = z.discriminatedUnion('ok', [StateOk, Err]);
export type StateResponse = z.infer<typeof StateResponse>;

export const AssignRequest = z.object({
  slotId: z.string().min(1),
  teamId: z.string().min(1),
  playerId: z.string().min(1),
  amountCents: z.number().int().nonnegative(),
});
export type AssignRequest = z.infer<typeof AssignRequest>;
export const AssignOk = z.object({
  ok: z.literal(true),
  newTotalSpent: z.number().int(),
  remaining: z.number().int(),
  playerValueCents: z.number().int(),
});
export const AssignResponse = z.discriminatedUnion('ok', [AssignOk, Err]);
export type AssignResponse = z.infer<typeof AssignResponse>;

export const RevokeRequest = z.object({
  slotId: z.string().min(1),
  teamId: z.string().min(1),
  playerId: z.string().min(1),
});
export type RevokeRequest = z.infer<typeof RevokeRequest>;
export const RevokeOk = z.object({
  ok: z.literal(true),
  removed: z.boolean(),
});
export const RevokeResponse = z.discriminatedUnion('ok', [RevokeOk, Err]);
export type RevokeResponse = z.infer<typeof RevokeResponse>;

export const AutoDistributeRequest = z.object({
  slotId: z.string().min(1),
  teamId: z.string().min(1),
});
export type AutoDistributeRequest = z.infer<typeof AutoDistributeRequest>;
export const AutoDistributeOk = z.object({
  ok: z.literal(true),
  dealsCreated: z.number().int(),
  totalSpent: z.number().int(),
});
export const AutoDistributeResponse = z.discriminatedUnion('ok', [AutoDistributeOk, Err]);
export type AutoDistributeResponse = z.infer<typeof AutoDistributeResponse>;

export const NIL_IPC_CHANNELS = {
  state: 'nil:state',
  assign: 'nil:assign',
  revoke: 'nil:revoke',
  autoDistribute: 'nil:auto-distribute',
} as const;
