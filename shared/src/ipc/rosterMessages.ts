// Sprint 28 (Task 28.1 + 28.2): IPC contracts for the Roster screen and
// the Player Profile modal.
//
// `roster.listForTeam` returns all Player rows for a team (typically 12-18).
// `roster.getProfile` returns one player's full profile: bio + ratings +
// season stats + career stats. The latter is computed on read from
// PlayerMatchStat — no derived storage.

import { z } from 'zod';

export const ListRosterRequest = z.object({
  slotId: z.string().min(1),
  teamId: z.string().min(1),
});
export type ListRosterRequest = z.infer<typeof ListRosterRequest>;

export const RosterPlayer = z.object({
  id: z.string(),
  jersey: z.number().int(),
  firstName: z.string(),
  lastName: z.string(),
  position: z.string(),
  classYear: z.string(),
  height: z.number().int(), // cm
  isLibero: z.boolean(),
  /** 0..100 derived overall (avg of position-relevant ratings). */
  overall: z.number().int(),
  /** 0..100 potential ceiling from the generator. */
  potential: z.number().int(),
  /** Whether the player has used their redshirt year. */
  redshirtUsed: z.boolean(),
  isCaptain: z.boolean(),
});
export type RosterPlayer = z.infer<typeof RosterPlayer>;

export const ListRosterOk = z.object({
  ok: z.literal(true),
  players: z.array(RosterPlayer),
});
export const ListRosterErr = z.object({
  ok: z.literal(false),
  error: z.object({
    code: z.enum(['NOT_FOUND', 'INVALID_INPUT', 'IO_ERROR', 'INTERNAL']),
    message: z.string(),
  }),
});
export const ListRosterResponse = z.discriminatedUnion('ok', [ListRosterOk, ListRosterErr]);
export type ListRosterResponse = z.infer<typeof ListRosterResponse>;

export const GetPlayerProfileRequest = z.object({
  slotId: z.string().min(1),
  playerId: z.string().min(1),
});
export type GetPlayerProfileRequest = z.infer<typeof GetPlayerProfileRequest>;

export const PlayerRatings = z.object({
  attack: z.number().int(),
  block: z.number().int(),
  serve: z.number().int(),
  pass: z.number().int(),
  set: z.number().int(),
  dig: z.number().int(),
  athleticism: z.number().int(),
  iq: z.number().int(),
  stamina: z.number().int(),
});
export type PlayerRatings = z.infer<typeof PlayerRatings>;

export const PlayerSeasonStats = z.object({
  setsPlayed: z.number().int().nonnegative(),
  matchesPlayed: z.number().int().nonnegative(),
  kills: z.number().int().nonnegative(),
  errors: z.number().int().nonnegative(),
  totalAttacks: z.number().int().nonnegative(),
  /** Hitting % × 1000 (e.g. 0.250 → 250). */
  hittingPctMilli: z.number().int(),
  digs: z.number().int().nonnegative(),
  blocks: z.number().int().nonnegative(),
  aces: z.number().int().nonnegative(),
  assists: z.number().int().nonnegative(),
});
export type PlayerSeasonStats = z.infer<typeof PlayerSeasonStats>;

export const PlayerProfile = z.object({
  id: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  jersey: z.number().int(),
  position: z.string(),
  classYear: z.string(),
  height: z.number().int(), // cm
  hometownCity: z.string().nullable(),
  hometownState: z.string().nullable(),
  isLibero: z.boolean(),
  isCaptain: z.boolean(),
  redshirtUsed: z.boolean(),
  overall: z.number().int(),
  potential: z.number().int(),
  ratings: PlayerRatings,
  teamAbbr: z.string(),
  teamSchool: z.string(),
  /** Stats for the current (most recent) season. */
  currentSeasonStats: PlayerSeasonStats,
  /** Aggregate across all seasons. Equal to currentSeasonStats for first-year players. */
  careerStats: PlayerSeasonStats,
  /**
   * Sprint 28: total NIL deal value for this player in cents (0 if none).
   * Surfaced on the profile so the user can see what their players are
   * earning. Whole-dollar display per CLAUDE.md money convention.
   */
  nilCents: z.number().int().nonnegative(),
});
export type PlayerProfile = z.infer<typeof PlayerProfile>;

export const GetPlayerProfileOk = z.object({
  ok: z.literal(true),
  profile: PlayerProfile,
});
export const GetPlayerProfileErr = z.object({
  ok: z.literal(false),
  error: z.object({
    code: z.enum(['NOT_FOUND', 'INVALID_INPUT', 'IO_ERROR', 'INTERNAL']),
    message: z.string(),
  }),
});
export const GetPlayerProfileResponse = z.discriminatedUnion('ok', [
  GetPlayerProfileOk,
  GetPlayerProfileErr,
]);
export type GetPlayerProfileResponse = z.infer<typeof GetPlayerProfileResponse>;

export const ROSTER_IPC_CHANNELS = {
  listForTeam: 'roster:listForTeam',
  getProfile: 'roster:getProfile',
} as const;
