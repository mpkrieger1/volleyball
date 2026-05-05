// Sprint 33 Task 33.2 — phase-event calendar.
//
// Replaces the implicit "phase + currentWeek" model with an explicit
// per-phase ordered event sequence the user advances through one event at
// a time. `Season.phaseWeek` is the index into the active phase's list.
//
// Mirrors FCCD's offseason+preseason event calendar (15 + 7 in FCCD
// football; VCD compresses to 11 + 5 for v1.2).
//
// Pure module — no IO, no Prisma. Consumed by `advanceOffseasonEvent`
// (main) + `OffseasonPanel` (renderer).

export type OffseasonEvent =
  | 'YEAR_SUMMARY'
  | 'COACH_LEVELING'
  | 'COACH_CAROUSEL'
  | 'PLAYERS_LEAVING'
  | 'PLAYERS_TRANSFERRING'
  | 'RECRUITING_1'
  | 'RECRUITING_2'
  | 'RECRUITING_3'
  | 'SIGNING_DAY'
  | 'BOOSTER_UPDATES'
  | 'ADVANCE_YEAR';

// Sprint 37 (post-launch UAT): POSITION_CHANGES removed from the PRESEASON
// calendar. The v1.2 handler was a no-op stub with no UI and the screen
// rendered an Advance button with nothing for the user to do. v1.3 will
// add a real position-change UI (player picker + position validation) and
// re-introduce the event then.
export type PreseasonEvent =
  | 'TRAINING_FOCUS'
  | 'TRAINING_RESULTS'
  | 'GAMEPLAN'
  | 'FINALIZE';

export const OFFSEASON_EVENTS: readonly OffseasonEvent[] = [
  'YEAR_SUMMARY',
  'COACH_LEVELING',
  'COACH_CAROUSEL',
  'PLAYERS_LEAVING',
  'PLAYERS_TRANSFERRING',
  'RECRUITING_1',
  'RECRUITING_2',
  'RECRUITING_3',
  'SIGNING_DAY',
  'BOOSTER_UPDATES',
  'ADVANCE_YEAR',
] as const;

export const PRESEASON_EVENTS: readonly PreseasonEvent[] = [
  'TRAINING_FOCUS',
  'TRAINING_RESULTS',
  'GAMEPLAN',
  'FINALIZE',
] as const;

/** All Season.phase values. The event-driven phases are OFFSEASON + PRESEASON. */
export type SeasonPhase =
  | 'PRESEASON'
  | 'REGULAR'
  | 'CONF_TOURNEY'
  | 'NCAA'
  | 'OFFSEASON'
  | 'RECRUITING'
  | 'PORTAL';

export type EventCursor = {
  phase: SeasonPhase;
  phaseWeek: number;
};

/**
 * Resolve the active event at this cursor. Returns null when:
 *   - phase has no event sequence (REGULAR / NCAA / etc.)
 *   - phaseWeek is past the last event (caller should advance phase next)
 */
export function getCurrentEvent(
  cursor: EventCursor,
): OffseasonEvent | PreseasonEvent | null {
  if (cursor.phase === 'OFFSEASON') {
    return cursor.phaseWeek < OFFSEASON_EVENTS.length
      ? OFFSEASON_EVENTS[cursor.phaseWeek]!
      : null;
  }
  if (cursor.phase === 'PRESEASON') {
    return cursor.phaseWeek < PRESEASON_EVENTS.length
      ? PRESEASON_EVENTS[cursor.phaseWeek]!
      : null;
  }
  return null;
}

/**
 * The next cursor after one advance:
 *   - mid-sequence: bump phaseWeek by 1.
 *   - last event of OFFSEASON: → PRESEASON / phaseWeek=0.
 *   - last event of PRESEASON: → REGULAR / phaseWeek=0.
 *   - any other phase: returned unchanged (undefined behavior; callers
 *     gate on getCurrentEvent first).
 */
export function nextPhaseTransition(cursor: EventCursor): EventCursor {
  if (cursor.phase === 'OFFSEASON') {
    if (cursor.phaseWeek + 1 >= OFFSEASON_EVENTS.length) {
      return { phase: 'PRESEASON', phaseWeek: 0 };
    }
    return { phase: 'OFFSEASON', phaseWeek: cursor.phaseWeek + 1 };
  }
  if (cursor.phase === 'PRESEASON') {
    if (cursor.phaseWeek + 1 >= PRESEASON_EVENTS.length) {
      return { phase: 'REGULAR', phaseWeek: 0 };
    }
    return { phase: 'PRESEASON', phaseWeek: cursor.phaseWeek + 1 };
  }
  return cursor;
}
