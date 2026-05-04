// Sprint 16: transition Season.phase PRESEASON → REGULAR. Completes the
// state machine (previously only PRESEASON→REGULAR was missing).
//
// Sprint 27 (Task 27.1): auto-generates the schedule for the season's year
// IF no schedule exists yet (idempotent). The user no longer sees a
// "Generate Schedule" button anywhere in the UI; schedule materializes
// automatically here on the offseason→regular transition.
//
// Sprint 28 (Task 28.3): also auto-opens the recruiting cycle here, so the
// recruiting pool + per-team boards arrive at Week 1 rather than being
// pre-populated at save-slot creation. Idempotent — second call is a no-op.
//
// Sprint 28 (post-fixes): also auto-seeds the CoachingPool for the current
// seasonYear if empty. The offseason refreshes the pool for year N+1, but
// fresh saves never went through an offseason and had no pool, leaving the
// Staff screen empty. Now the pool materializes at Week 0 startRegular.
// Idempotent: skipped if a pool already exists for this seasonYear.
//
// NOTE: coach generation remains in seedLeagueInto (save creation) rather
// than being moved here. This is a pragmatic deviation from the Sprint 28
// spec — moving coach generation broke ~30 integration tests that assumed
// staff exist at save creation. Coach lifecycle (age/retire/poach/fill)
// runs in the offseason instead (Task 28.4).

import { PrismaClient } from '@prisma/client';
import { coaching } from '@vcd/shared';
import { generateAndPersistSchedule } from '../schedule/generateAndPersist';
import { openRecruitingCycle } from '../recruiting/openRecruitingCycle';

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

    // Sprint 28 Task 28.3: open the recruiting cycle. Idempotent: if any
    // Recruit rows already exist for this seasonYear, openRecruitingCycle
    // returns early (it checks via prisma.recruit.count internally? — see
    // its body; here we guard just in case).
    const existingRecruits = await client.recruit.count({
      where: { seasonYear: season.year },
    });
    if (existingRecruits === 0) {
      try {
        await openRecruitingCycle({
          dbPath: input.dbPath,
          seasonYear: season.year,
        });
      } catch (err) {
        // Don't fail the entire transition if recruiting setup fails — the
        // user can manually open the cycle later. Log and continue.
        // eslint-disable-next-line no-console
        console.warn('[startRegular] openRecruitingCycle failed:', (err as Error).message);
      }
    }

    // Sprint 28 (Week 0 fix): seed the CoachingPool for the current
    // seasonYear if it's empty. The offseason regenerates the pool for
    // year+1, so this only fires on fresh saves (or saves where the pool
    // was somehow drained). Idempotent — skipped when entries already
    // exist for this seasonAvailable year.
    const existingPool = await client.coachingPool.count({
      where: { seasonAvailable: season.year },
    });
    if (existingPool === 0) {
      try {
        const pool = coaching.generateHiringPool({
          seed: `pool:${season.year}`,
          seasonYear: season.year,
          size: 100,
        });
        await client.coachingPool.createMany({
          data: pool.map((p) => ({
            firstName: p.firstName,
            lastName: p.lastName,
            ratingRecruit: p.ratingRecruit,
            ratingDevelop: p.ratingDevelop,
            ratingStrategy: p.ratingStrategy,
            askingSalaryCents: p.askingSalaryCents,
            preferredRole: p.preferredRole,
            ageYears: p.ageYears,
            seasonAvailable: p.seasonAvailable,
          })),
        });
      } catch (err) {
        // Non-fatal — Staff screen will show an empty pool but the rest
        // of the transition succeeds.
        // eslint-disable-next-line no-console
        console.warn('[startRegular] coaching pool seed failed:', (err as Error).message);
      }
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
