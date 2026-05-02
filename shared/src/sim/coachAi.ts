// Coach AI v0: single baseline archetype. Calls a timeout when trailing by a
// 3+ point run AND at least one timeout remains. Deterministic, pure.

import { z } from 'zod';

export const CoachArchetypeSchema = z.enum(['baseline']);
export type CoachArchetype = z.infer<typeof CoachArchetypeSchema>;

export type TimeoutDecisionCtx = {
  /** My team's current score in the set. */
  myScore: number;
  /** Opponent's current score. */
  theirScore: number;
  /** How many consecutive points I've lost since the last I won (0 if last point was mine). */
  opponentRunLength: number;
  /** How many timeouts I have left in this set. */
  timeoutsRemaining: number;
  archetype?: CoachArchetype;
};

export type CoachDecision = { kind: 'timeout' } | { kind: 'continue' };

export function shouldCallTimeout(ctx: TimeoutDecisionCtx): CoachDecision {
  if (ctx.timeoutsRemaining <= 0) return { kind: 'continue' };
  if (ctx.opponentRunLength >= 3) return { kind: 'timeout' };
  return { kind: 'continue' };
}
