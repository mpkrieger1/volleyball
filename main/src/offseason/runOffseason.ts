// Sprint 33: `runOffseason` is now a thin loop that drives
// `advanceOffseasonEvent` until the calendar lands in REGULAR. Replaces
// the original Sprint 16 single-transaction implementation; the per-event
// handlers live in `events/*.ts` and are individually idempotent.
//
// Used by:
//   - integration tests (`tests/integration/offseason/runOffseason.test.ts`)
//     that pre-date the event split
//   - a future debug "skip every event" button (out of scope for v1.2)
//
// The legacy `RunOffseasonResult` shape is preserved by aggregating
// per-event summaries into the same fields callers expect.

import { PrismaClient } from '@prisma/client';
import { advanceOffseasonEvent } from './advanceOffseasonEvent';

export type RunOffseasonInput = {
  dbPath: string;
  /** Unused — retained for source-compat. The orchestrator owns seeding now. */
  seed?: string;
};

export type RunOffseasonResult = {
  playersGraduated: number;
  playersCut: number;
  teamsUpdated: number;
  newSeasonYear: number;
};

const MAX_EVENTS = 32; // 11 OFFSEASON + 5 PRESEASON + slack for skipped null events

export async function runOffseason(input: RunOffseasonInput): Promise<RunOffseasonResult> {
  let playersGraduated = 0;
  let playersCut = 0;
  let teamsUpdated = 0;

  for (let i = 0; i < MAX_EVENTS; i++) {
    // Stop when phase becomes REGULAR (FINALIZE wrote it).
    const c = new PrismaClient({ datasources: { db: { url: `file:${input.dbPath}` } } });
    let isRegular: boolean;
    try {
      const s = await c.season.findFirstOrThrow({ orderBy: { year: 'desc' } });
      isRegular = s.phase === 'REGULAR';
    } finally {
      await c.$disconnect();
    }
    if (isRegular) break;

    const result = await advanceOffseasonEvent({ dbPath: input.dbPath });
    if (!result.ok) {
      throw new Error(`advanceOffseasonEvent failed: ${result.message}`);
    }
    const summary = result.summary as Record<string, unknown> | null;
    if (summary && typeof summary === 'object') {
      if (summary.event === 'PLAYERS_LEAVING') {
        playersGraduated += Number(summary.graduated ?? 0);
        playersCut += Number(summary.cut ?? 0);
      }
      if (summary.event === 'BOOSTER_UPDATES') {
        teamsUpdated += Number(summary.teamsUpdated ?? 0);
      }
    }
  }

  // Read the final year off Season.
  const c = new PrismaClient({ datasources: { db: { url: `file:${input.dbPath}` } } });
  let newSeasonYear: number;
  try {
    const s = await c.season.findFirstOrThrow({ orderBy: { year: 'desc' } });
    newSeasonYear = s.year;
  } finally {
    await c.$disconnect();
  }

  return { playersGraduated, playersCut, teamsUpdated, newSeasonYear };
}
