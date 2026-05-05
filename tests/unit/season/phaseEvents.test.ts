// Sprint 33 Task 33.2 — phase event calendar.

import { describe, it, expect } from 'vitest';
import { season } from '@vcd/shared';

describe('OFFSEASON_EVENTS / PRESEASON_EVENTS arrays', () => {
  it('OFFSEASON_EVENTS has exactly 11 events in spec order', () => {
    expect(season.OFFSEASON_EVENTS).toEqual([
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
    ]);
  });

  it('PRESEASON_EVENTS has exactly 4 events in spec order', () => {
    // Sprint 37 (post-launch UAT): POSITION_CHANGES dropped — v1.2 was a
    // no-op stub with no UI and the screen rendered an Advance button
    // with nothing for the user to do. v1.3 will reintroduce with a real
    // position-change picker.
    expect(season.PRESEASON_EVENTS).toEqual([
      'TRAINING_FOCUS',
      'TRAINING_RESULTS',
      'GAMEPLAN',
      'FINALIZE',
    ]);
  });
});

describe('getCurrentEvent', () => {
  it('OFFSEASON phase resolves by index', () => {
    expect(season.getCurrentEvent({ phase: 'OFFSEASON', phaseWeek: 0 })).toBe('YEAR_SUMMARY');
    expect(season.getCurrentEvent({ phase: 'OFFSEASON', phaseWeek: 5 })).toBe('RECRUITING_1');
    expect(season.getCurrentEvent({ phase: 'OFFSEASON', phaseWeek: 10 })).toBe('ADVANCE_YEAR');
  });

  it('PRESEASON phase resolves by index', () => {
    expect(season.getCurrentEvent({ phase: 'PRESEASON', phaseWeek: 0 })).toBe('TRAINING_FOCUS');
    expect(season.getCurrentEvent({ phase: 'PRESEASON', phaseWeek: 3 })).toBe('FINALIZE');
  });

  it('returns null when phaseWeek is past the last event (sentinel = "advance phase")', () => {
    expect(season.getCurrentEvent({ phase: 'OFFSEASON', phaseWeek: 11 })).toBeNull();
    expect(season.getCurrentEvent({ phase: 'PRESEASON', phaseWeek: 4 })).toBeNull();
  });

  it('returns null for non-event phases (REGULAR, NCAA, ...)', () => {
    expect(season.getCurrentEvent({ phase: 'REGULAR', phaseWeek: 0 })).toBeNull();
    expect(season.getCurrentEvent({ phase: 'NCAA', phaseWeek: 0 })).toBeNull();
  });
});

describe('nextPhaseTransition', () => {
  it('OFFSEASON last event → PRESEASON, phaseWeek=0', () => {
    expect(season.nextPhaseTransition({ phase: 'OFFSEASON', phaseWeek: 10 })).toEqual({
      phase: 'PRESEASON',
      phaseWeek: 0,
    });
  });

  it('PRESEASON last event → REGULAR, phaseWeek=0', () => {
    expect(season.nextPhaseTransition({ phase: 'PRESEASON', phaseWeek: 3 })).toEqual({
      phase: 'REGULAR',
      phaseWeek: 0,
    });
  });

  it('mid-sequence advance just bumps phaseWeek', () => {
    expect(season.nextPhaseTransition({ phase: 'OFFSEASON', phaseWeek: 3 })).toEqual({
      phase: 'OFFSEASON',
      phaseWeek: 4,
    });
    expect(season.nextPhaseTransition({ phase: 'PRESEASON', phaseWeek: 1 })).toEqual({
      phase: 'PRESEASON',
      phaseWeek: 2,
    });
  });
});

describe('sequence integrity', () => {
  it('walking from (OFFSEASON, 0) yields all 11+4 events before transitioning to REGULAR', () => {
    const seen: string[] = [];
    let cursor: season.EventCursor = { phase: 'OFFSEASON', phaseWeek: 0 };
    // Cap at 25 to prevent runaway loops.
    for (let i = 0; i < 25; i++) {
      const ev = season.getCurrentEvent(cursor);
      if (ev) seen.push(ev);
      cursor = season.nextPhaseTransition(cursor);
      if (cursor.phase === 'REGULAR') break;
    }
    expect(seen).toEqual([
      ...season.OFFSEASON_EVENTS,
      ...season.PRESEASON_EVENTS,
    ]);
    expect(cursor).toEqual({ phase: 'REGULAR', phaseWeek: 0 });
  });
});
