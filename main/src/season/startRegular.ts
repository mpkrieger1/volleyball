// Sprint 16: transition Season.phase PRESEASON → REGULAR. Completes the
// state machine (previously only PRESEASON→REGULAR was missing).
//
// Sprint 27 (Task 27.1): auto-generates the schedule for the season's year
// IF no schedule exists yet (idempotent). The user no longer sees a
// "Generate Schedule" button anywhere in the UI; schedule materializes
// automatically here on the offseason→regular transition.

import { PrismaClient } from '@prisma/client';
import { generateAndPersistSchedule } from '../schedule/generateAndPersist';

export type StartRegularInput = { dbPath: string; seed?: string | number };
export type StartRegularResult =
  | { ok: true; phase: 'REGULAR'; year: number; matchesGenerated: number }
  | { ok: false; code: 'NOT_IN_PRESEASON' | 'NO_SEASON'; message: string };

export async function startRegular(input: StartRegularInput): Promise<StartRegularResult> {
  const client = new PrismaClient({ datasources: { db: { url: `file:${input.dbPath}` } } });
  try {
    const season = await client.season.findFirst({ orderBy: { year: 'desc' } });
    if (!season) return { ok: false, code: 'NO_SEASON', message: 'No Season row.' };
    if (season.phase !== 'PRESEASON') {
      return {
        ok: false,
        code: 'NOT_IN_PRESEASON',
        message: `Season.phase must be PRESEASON (got ${season.phase}).`,
      };
    }

    // Sprint 27 Task 27.1: auto-generate schedule if not present.
    // Idempotency check: if any non-tournament Match rows exist for this
    // season year already, skip generation. The Match table has Match.date
    // but not seasonYear directly; year is encoded via the date — we use
    // the calendar-year filter on date.
    const yearStart = new Date(`${season.year}-08-01T00:00:00Z`);
    const yearEnd = new Date(`${season.year + 1}-08-01T00:00:00Z`);
    const existingCount = await client.match.count({
      where: {
        isTournament: false,
        date: { gte: yearStart, lt: yearEnd },
      },
    });
    let matchesGenerated = 0;
    if (existingCount === 0) {
      const seed = input.seed ?? `season-${season.year}`;
      const result = await generateAndPersistSchedule({
        dbPath: input.dbPath,
        seasonYear: season.year,
        seed,
      });
      matchesGenerated = result.stats.totalMatches;
    } else {
      matchesGenerated = existingCount;
    }

    await client.season.update({
      where: { id: season.id },
      data: { phase: 'REGULAR' },
    });
    return { ok: true, phase: 'REGULAR', year: season.year, matchesGenerated };
  } finally {
    await client.$disconnect();
  }
}
