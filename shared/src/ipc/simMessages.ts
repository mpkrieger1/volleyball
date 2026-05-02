import { z } from 'zod';
import { PlayerLineupSchema, TeamSideSchema } from '../sim/lineup';
import { RallyResultSchema } from '../sim/rallyResult';

export const SimulateRallyRequest = z.object({
  kind: z.literal('simulate_rally'),
  seed: z.union([z.number().int(), z.string().min(1)]),
  home: PlayerLineupSchema,
  away: PlayerLineupSchema,
  servingTeam: TeamSideSchema,
});
export type SimulateRallyRequest = z.infer<typeof SimulateRallyRequest>;

export const SimulateRallyOk = z.object({
  ok: z.literal(true),
  result: RallyResultSchema,
});
export const SimulateRallyErr = z.object({
  ok: z.literal(false),
  error: z.object({
    code: z.enum(['INVALID_INPUT', 'INTERNAL']),
    message: z.string(),
  }),
});
export const SimulateRallyResponse = z.discriminatedUnion('ok', [SimulateRallyOk, SimulateRallyErr]);
export type SimulateRallyResponse = z.infer<typeof SimulateRallyResponse>;

export const SIM_IPC_CHANNELS = {
  rally: 'sim:rally',
} as const;
