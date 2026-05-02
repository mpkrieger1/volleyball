// Sprint 19: match timeline (timeouts + substitutions) for the Match Hub
// ticker. Persisted as JSON in `Match.timelineJson`. Renderer splices these
// banner events into the PBP playback by tick / rally index.
//
// **Substitutions are a forward-looking field.** Production matches don't
// currently track libero entries/exits or starter↔bench swaps (Sprint 4
// substitutionLedger isn't exercised). Sprint 19 ships an empty array; a
// future sprint that wires sub tracking can populate it.

import { z } from 'zod';

export const TimeoutEventSchema = z.object({
  /** Set index this timeout occurred in (0..4). */
  setIndex: z.number().int().min(0).max(4),
  /** 0-based rally index within the set. */
  atRallyIdx: z.number().int().nonnegative(),
  /** Which team called it. */
  by: z.enum(['home', 'away']),
  /** Score at the moment of the timeout. */
  scoreHome: z.number().int().nonnegative(),
  scoreAway: z.number().int().nonnegative(),
  /** Opponent's run length at the moment of the timeout (UX context). */
  opponentRunLength: z.number().int().nonnegative(),
});
export type TimeoutEvent = z.infer<typeof TimeoutEventSchema>;

export const SubstitutionEventSchema = z.object({
  setIndex: z.number().int().min(0).max(4),
  atRallyIdx: z.number().int().nonnegative(),
  team: z.enum(['home', 'away']),
  /** 'libero_in' / 'libero_out' for libero swaps; 'sub_in' / 'sub_out' for real subs. */
  kind: z.enum(['libero_in', 'libero_out', 'sub_in', 'sub_out']),
  slotIndex: z.number().int().min(0).max(5),
});
export type SubstitutionEvent = z.infer<typeof SubstitutionEventSchema>;

export const MatchTimelineSchema = z.object({
  timeouts: z.array(TimeoutEventSchema),
  substitutions: z.array(SubstitutionEventSchema),
});
export type MatchTimeline = z.infer<typeof MatchTimelineSchema>;

export const EMPTY_MATCH_TIMELINE: MatchTimeline = { timeouts: [], substitutions: [] };
