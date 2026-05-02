import { z } from 'zod';
import { TeamSideSchema } from './lineup';

// A player slot is 0–5 pointing into the corresponding team's flat lineup.
const slot = z.number().int().min(0).max(5);

export const ServeEvent = z.object({
  kind: z.literal('serve'),
  tick: z.number().int().nonnegative(),
  team: TeamSideSchema,
  server: slot,
  quality: z.enum(['ace', 'error', 'in_play']),
  inPlayGrade: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
});
export type ServeEvent = z.infer<typeof ServeEvent>;

export const ReceptionEvent = z.object({
  kind: z.literal('reception'),
  tick: z.number().int().nonnegative(),
  team: TeamSideSchema,
  receiver: slot,
  grade: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
});
export type ReceptionEvent = z.infer<typeof ReceptionEvent>;

export const SetEvent = z.object({
  kind: z.literal('set'),
  tick: z.number().int().nonnegative(),
  team: TeamSideSchema,
  setter: slot,
  quality: z.enum(['bad', 'ok', 'good', 'perfect']),
});
export type SetEvent = z.infer<typeof SetEvent>;

export const AttackEvent = z.object({
  kind: z.literal('attack'),
  tick: z.number().int().nonnegative(),
  team: TeamSideSchema,
  attacker: slot,
  outcome: z.enum(['kill', 'error', 'blocked', 'dug']),
});
export type AttackEvent = z.infer<typeof AttackEvent>;

export const DigEvent = z.object({
  kind: z.literal('dig'),
  tick: z.number().int().nonnegative(),
  team: TeamSideSchema,
  digger: slot,
  grade: z.union([z.literal(0), z.literal(1), z.literal(2)]),
});
export type DigEvent = z.infer<typeof DigEvent>;

export const PointEvent = z.object({
  kind: z.literal('point'),
  tick: z.number().int().nonnegative(),
  winner: TeamSideSchema,
  reason: z.enum([
    'kill',
    'attack_error',
    'block',
    'service_ace',
    'service_error',
    'contact_cap',
    'rotation_violation',
  ]),
});
export type PointEvent = z.infer<typeof PointEvent>;

export const RallyEvent = z.discriminatedUnion('kind', [
  ServeEvent,
  ReceptionEvent,
  SetEvent,
  AttackEvent,
  DigEvent,
  PointEvent,
]);
export type RallyEvent = z.infer<typeof RallyEvent>;
