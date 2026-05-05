// Sprint 29 Task 29.6: coach action log scaffolding.
//
// This file is the canonical home for the CoachAction discriminated union.
// The schema is also re-exported from state.ts for convenience (so the
// state module's LiveMatchState reference resolves), but Sprint 30/31
// helpers (timeout-call, substitution, rotation-set) live HERE.
//
// Sprint 29 scope: type + schema only. The action log is written (always
// `[]` this sprint, since no user-driven actions exist yet) but never
// read back. Sprint 30 adds timeouts/subs that append, Sprint 31 adds
// rotation-set actions, and a v1.x "watch your match back" replay
// will consume the log.

import { z } from 'zod';
import { TeamSideSchema } from '../lineup';
import { RotationStateSchema } from '../rotation';
import { SkillKeySchema } from './skills';

export const CoachActionTimeoutSchema = z.object({
  kind: z.literal('timeout'),
  team: TeamSideSchema,
  rallyIndex: z.number().int().nonnegative(),
  skill: SkillKeySchema.optional(),
});

export const CoachActionSubstitutionSchema = z.object({
  kind: z.literal('substitution'),
  team: TeamSideSchema,
  rallyIndex: z.number().int().nonnegative(),
  out: z.string(),
  in: z.string(),
});

export const CoachActionRotationSchema = z.object({
  kind: z.literal('rotation'),
  team: TeamSideSchema,
  setIndex: z.number().int().min(0).max(4),
  rotation: RotationStateSchema,
  system: z.enum(['5-1', '6-2']),
  libero: z.string(),
  hint: z.enum(['aggressive', 'balanced', 'defensive']),
});

export const CoachActionLogSchema = z.array(
  z.discriminatedUnion('kind', [
    CoachActionTimeoutSchema,
    CoachActionSubstitutionSchema,
    CoachActionRotationSchema,
  ]),
);
export type CoachActionLog = z.infer<typeof CoachActionLogSchema>;

/**
 * Serialize a coach-action log to a string ready for Match.coachActionsJson.
 * Returns 'null' when input is undefined to distinguish sim-only matches
 * (column = NULL) from live matches with no actions (column = '[]').
 */
export function serializeCoachActionLog(log: CoachActionLog | undefined): string | null {
  if (log === undefined) return null;
  return JSON.stringify(log);
}

/**
 * Parse Match.coachActionsJson back into a typed log. Returns undefined
 * when the column is NULL (sim-only matches) so callers can distinguish
 * "no log exists" from "log exists with zero entries."
 */
export function parseCoachActionLog(json: string | null): CoachActionLog | undefined {
  if (json === null || json === undefined) return undefined;
  return CoachActionLogSchema.parse(JSON.parse(json));
}
