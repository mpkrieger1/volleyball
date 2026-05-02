import { z } from 'zod';

const ErrCode = z.enum([
  'NOT_FOUND',
  'NO_SEASON',
  'INSUFFICIENT_BUDGET',
  'INVALID_ROLE',
  'COACH_NOT_ON_TEAM',
  'POOL_EMPTY',
  'INTERNAL',
]);
const Err = z.object({
  ok: z.literal(false),
  error: z.object({ code: ErrCode, message: z.string() }),
});

export const CoachRole = z.enum(['HC', 'AHC', 'AC']);
export type CoachRole = z.infer<typeof CoachRole>;

export const StaffRow = z.object({
  coachId: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  role: CoachRole,
  contractYears: z.number().int(),
  salaryCents: z.number().int(),
  ratingRecruit: z.number().int(),
  ratingDevelop: z.number().int(),
  ratingStrategy: z.number().int(),
  hireSeason: z.number().int(),
});
export type StaffRow = z.infer<typeof StaffRow>;

export const PoolRow = z.object({
  poolId: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  preferredRole: CoachRole,
  askingSalaryCents: z.number().int(),
  ratingRecruit: z.number().int(),
  ratingDevelop: z.number().int(),
  ratingStrategy: z.number().int(),
  ageYears: z.number().int(),
});
export type PoolRow = z.infer<typeof PoolRow>;

// --- list staff ---
export const ListStaffRequest = z.object({
  slotId: z.string().min(1),
  teamId: z.string().min(1),
});
export type ListStaffRequest = z.infer<typeof ListStaffRequest>;
export const ListStaffOk = z.object({
  ok: z.literal(true),
  staff: z.array(StaffRow),
  operatingBudgetCents: z.number().int(),
});
export const ListStaffResponse = z.discriminatedUnion('ok', [ListStaffOk, Err]);
export type ListStaffResponse = z.infer<typeof ListStaffResponse>;

// --- list pool ---
export const ListPoolRequest = z.object({ slotId: z.string().min(1) });
export type ListPoolRequest = z.infer<typeof ListPoolRequest>;
export const ListPoolOk = z.object({
  ok: z.literal(true),
  pool: z.array(PoolRow),
});
export const ListPoolResponse = z.discriminatedUnion('ok', [ListPoolOk, Err]);
export type ListPoolResponse = z.infer<typeof ListPoolResponse>;

// --- hire ---
export const HireRequest = z.object({
  slotId: z.string().min(1),
  teamId: z.string().min(1),
  poolId: z.string().min(1),
  role: CoachRole,
  contractYears: z.number().int().min(1).max(8),
  salaryCents: z.number().int().min(0),
});
export type HireRequest = z.infer<typeof HireRequest>;
export const HireOk = z.object({
  ok: z.literal(true),
  coachId: z.string(),
  replacedCoachId: z.string().nullable(),
});
export const HireResponse = z.discriminatedUnion('ok', [HireOk, Err]);
export type HireResponse = z.infer<typeof HireResponse>;

// --- fire ---
export const FireRequest = z.object({
  slotId: z.string().min(1),
  teamId: z.string().min(1),
  coachId: z.string().min(1),
});
export type FireRequest = z.infer<typeof FireRequest>;
export const FireOk = z.object({
  ok: z.literal(true),
  buyoutCents: z.number().int(),
  newBudgetCents: z.number().int(),
  backfilledCoachId: z.string().nullable(),
});
export const FireResponse = z.discriminatedUnion('ok', [FireOk, Err]);
export type FireResponse = z.infer<typeof FireResponse>;

export const COACHING_IPC_CHANNELS = {
  listStaff: 'coaching:listStaff',
  listPool: 'coaching:listPool',
  hire: 'coaching:hire',
  fire: 'coaching:fire',
} as const;
