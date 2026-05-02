import { z } from 'zod';
import { PlayerRatingsSchema } from './ratings';

export const TeamSideSchema = z.enum(['home', 'away']);
export type TeamSide = z.infer<typeof TeamSideSchema>;

// Sprint 3: flat 6-player lineup. Rotation + libero rules land in Sprint 4.
export const PlayerLineupSchema = z.object({
  team: TeamSideSchema,
  players: z
    .array(PlayerRatingsSchema)
    .length(6, 'A lineup must have exactly 6 players.'),
});
export type PlayerLineup = z.infer<typeof PlayerLineupSchema>;
