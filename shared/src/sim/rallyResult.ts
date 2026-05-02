import { z } from 'zod';
import { RallyEvent } from './rallyEvents';
import { TeamSideSchema } from './lineup';

export const RallyResultSchema = z.object({
  seed: z.union([z.number().int(), z.string()]),
  servingTeam: TeamSideSchema,
  winningTeam: TeamSideSchema,
  events: z.array(RallyEvent).min(2), // at minimum a serve + point
  contacts: z.number().int().nonnegative().max(40),
});
export type RallyResult = z.infer<typeof RallyResultSchema>;
