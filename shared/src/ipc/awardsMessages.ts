// Sprint 18: IPC contract for AVCA All-American screen + career history.

import { z } from 'zod';

const ErrCode = z.enum(['NOT_FOUND', 'NO_SEASON', 'NO_AWARDS', 'INTERNAL']);
const Err = z.object({
  ok: z.literal(false),
  error: z.object({ code: ErrCode, message: z.string() }),
});

export const AaTeam = z.enum(['first', 'second', 'third', 'hm']);
export type AaTeam = z.infer<typeof AaTeam>;

export const AaCategory = z.enum(['AA_FIRST', 'AA_SECOND', 'AA_THIRD', 'AA_HM']);
export type AaCategory = z.infer<typeof AaCategory>;

export const AwardEntry = z.object({
  playerId: z.string(),
  playerName: z.string(),
  position: z.enum(['OH', 'MB', 'OPP', 'S', 'L', 'DS']),
  isLibero: z.boolean(),
  teamId: z.string(),
  teamName: z.string(),
  teamAbbr: z.string(),
  classYear: z.string(),
  /** Position-specific primary stat (K/set, A/set, D/set, etc.). */
  primaryStat: z.object({ label: z.string(), value: z.number() }),
  /** Number of prior AA awards (any team) for this player. */
  priorAaCount: z.number().int().nonnegative(),
});
export type AwardEntry = z.infer<typeof AwardEntry>;

// --- listForSeason ---
export const ListForSeasonRequest = z.object({
  slotId: z.string().min(1),
  seasonYear: z.number().int(),
});
export type ListForSeasonRequest = z.infer<typeof ListForSeasonRequest>;
export const ListForSeasonOk = z.object({
  ok: z.literal(true),
  seasonYear: z.number().int(),
  teams: z.object({
    first: z.array(AwardEntry),
    second: z.array(AwardEntry),
    third: z.array(AwardEntry),
    hm: z.array(AwardEntry),
  }),
  /** Seasons that have any award rows (for the dropdown). */
  availableSeasons: z.array(z.number().int()),
});
export const ListForSeasonResponse = z.discriminatedUnion('ok', [ListForSeasonOk, Err]);
export type ListForSeasonResponse = z.infer<typeof ListForSeasonResponse>;

// --- careerForPlayer ---
export const CareerForPlayerRequest = z.object({
  slotId: z.string().min(1),
  playerId: z.string().min(1),
});
export type CareerForPlayerRequest = z.infer<typeof CareerForPlayerRequest>;
export const CareerEntry = z.object({
  seasonYear: z.number().int(),
  category: AaCategory,
  team: AaTeam,
});
export type CareerEntry = z.infer<typeof CareerEntry>;
export const CareerForPlayerOk = z.object({
  ok: z.literal(true),
  playerId: z.string(),
  awards: z.array(CareerEntry),
});
export const CareerForPlayerResponse = z.discriminatedUnion('ok', [CareerForPlayerOk, Err]);
export type CareerForPlayerResponse = z.infer<typeof CareerForPlayerResponse>;

export const AWARDS_IPC_CHANNELS = {
  listForSeason: 'awards:listForSeason',
  careerForPlayer: 'awards:careerForPlayer',
} as const;
