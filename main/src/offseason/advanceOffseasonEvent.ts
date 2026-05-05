// Sprint 33 Task 33.3 — orchestrator that resolves the active offseason
// or preseason event from `(Season.phase, Season.phaseWeek)`, dispatches
// to the per-event handler, then advances the cursor.
//
// Per-event handler responsibilities are split across `events/*.ts`. Each
// handler is small + idempotent. The orchestrator's only job is dispatch +
// cursor advance. After a handler succeeds, phaseWeek is incremented (or
// phase transitions per `nextPhaseTransition`).

import { PrismaClient } from '@prisma/client';
import { season as seasonNs } from '@vcd/shared';
import { yearSummary } from './events/yearSummary';
import { coachLeveling } from './events/coachLeveling';
import { coachCarousel } from './events/coachCarousel';
import { playersLeaving } from './events/playersLeaving';
import { playersTransferring } from './events/playersTransferring';
import { recruitingWeek } from './events/recruitingWeek';
import { signingDay } from './events/signingDay';
import { boosterUpdates } from './events/boosterUpdates';
import { advanceYear } from './events/advanceYear';
import { positionChanges } from './events/positionChanges';
import { trainingFocus } from './events/trainingFocus';
import { trainingResults } from './events/trainingResults';
import { gameplan } from './events/gameplan';
import { finalize } from './events/finalize';

export type AdvanceOffseasonEventInput = {
  dbPath: string;
  /** Optional user team id; passed to TRAINING_FOCUS for picker validation. */
  userTeamId?: string | null;
};

export type AdvanceOffseasonEventResult =
  | {
      ok: true;
      event: seasonNs.OffseasonEvent | seasonNs.PreseasonEvent | null;
      cursorBefore: seasonNs.EventCursor;
      cursorAfter: seasonNs.EventCursor;
      summary: unknown;
    }
  | {
      ok: false;
      code: 'NO_SEASON' | 'NOT_AN_EVENT_PHASE' | 'INTERNAL';
      message: string;
    };

export async function advanceOffseasonEvent(
  input: AdvanceOffseasonEventInput,
): Promise<AdvanceOffseasonEventResult> {
  const client = new PrismaClient({ datasources: { db: { url: `file:${input.dbPath}` } } });
  let cursorBefore: seasonNs.EventCursor;
  let seasonYear: number;
  try {
    const s = await client.season.findFirst({ orderBy: { year: 'desc' } });
    if (!s) {
      return { ok: false, code: 'NO_SEASON', message: 'No Season row.' };
    }
    cursorBefore = { phase: s.phase as seasonNs.SeasonPhase, phaseWeek: s.phaseWeek };
    seasonYear = s.year;
  } finally {
    await client.$disconnect();
  }

  const event = seasonNs.getCurrentEvent(cursorBefore);
  if (event === null) {
    // Past the last event of the current phase — just transition.
    const next = seasonNs.nextPhaseTransition(cursorBefore);
    const c = new PrismaClient({ datasources: { db: { url: `file:${input.dbPath}` } } });
    try {
      const s = await c.season.findFirstOrThrow({ orderBy: { year: 'desc' } });
      await c.season.update({
        where: { id: s.id },
        data: { phase: next.phase, phaseWeek: next.phaseWeek },
      });
    } finally {
      await c.$disconnect();
    }
    return {
      ok: true,
      event: null,
      cursorBefore,
      cursorAfter: next,
      summary: { transitioned: true },
    };
  }

  let summary: unknown;
  // Some handlers need the dbPath (they spin up their own clients for
  // multi-step transactions); others take a single client. Use a fresh
  // client for the latter.
  const handlerClient = new PrismaClient({
    datasources: { db: { url: `file:${input.dbPath}` } },
  });
  try {
    switch (event) {
      case 'YEAR_SUMMARY':
        summary = await yearSummary(handlerClient, seasonYear);
        break;
      case 'COACH_LEVELING':
        summary = await coachLeveling(handlerClient, seasonYear);
        break;
      case 'COACH_CAROUSEL':
        summary = await coachCarousel(handlerClient, seasonYear);
        break;
      case 'PLAYERS_LEAVING':
        summary = await playersLeaving(handlerClient, seasonYear);
        break;
      case 'PLAYERS_TRANSFERRING':
        summary = await playersTransferring(input.dbPath, seasonYear);
        break;
      case 'RECRUITING_1':
      case 'RECRUITING_2':
      case 'RECRUITING_3':
        summary = await recruitingWeek(input.dbPath, seasonYear, event);
        break;
      case 'SIGNING_DAY':
        summary = await signingDay(input.dbPath);
        break;
      case 'BOOSTER_UPDATES':
        summary = await boosterUpdates(handlerClient, seasonYear);
        break;
      case 'ADVANCE_YEAR':
        summary = await advanceYear(input.dbPath, seasonYear);
        break;
      case 'POSITION_CHANGES':
        summary = await positionChanges(handlerClient, seasonYear);
        break;
      case 'TRAINING_FOCUS':
        summary = await trainingFocus(handlerClient, seasonYear, input.userTeamId ?? null);
        break;
      case 'TRAINING_RESULTS':
        summary = await trainingResults(handlerClient, seasonYear);
        break;
      case 'GAMEPLAN':
        summary = await gameplan(handlerClient, seasonYear);
        break;
      case 'FINALIZE':
        summary = await finalize(handlerClient, seasonYear);
        break;
    }
  } finally {
    await handlerClient.$disconnect();
  }

  // Advance cursor. FINALIZE wrote phase=REGULAR itself, so don't double-advance.
  if (event === 'FINALIZE') {
    return {
      ok: true,
      event,
      cursorBefore,
      cursorAfter: { phase: 'REGULAR', phaseWeek: 0 },
      summary,
    };
  }
  const next = seasonNs.nextPhaseTransition(cursorBefore);
  const c = new PrismaClient({ datasources: { db: { url: `file:${input.dbPath}` } } });
  try {
    const s = await c.season.findFirstOrThrow({ orderBy: { year: 'desc' } });
    await c.season.update({
      where: { id: s.id },
      data: { phase: next.phase, phaseWeek: next.phaseWeek },
    });
  } finally {
    await c.$disconnect();
  }

  return { ok: true, event, cursorBefore, cursorAfter: next, summary };
}
