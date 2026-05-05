// Sprint 33 — ADVANCE_YEAR event handler.
//
// Bumps Season.year, ages every Player.classYear (FR→SO etc., with SR/GR
// already removed by PLAYERS_LEAVING), resets stats counters, clears
// nationalChampionTeamId, and runs `pruneOldSeasons` to keep save-file size
// bounded (PRD §3.5; load-bearing for the long-dynasty save-size budget).
//
// Idempotency: keys on Season.year. If the year matches the *next* year
// (i.e. we already bumped), skip the year+age block; pruning is naturally
// idempotent.

import { PrismaClient } from '@prisma/client';
import { offseason } from '@vcd/shared';
import { pruneOldSeasons } from '../../save/pruneOldSeasons';

const DEFAULT_RETAIN_SEASONS = 1;
const DEFAULT_RETAIN_ARCHIVE_YEARS = 3;

export type AdvanceYearResult = {
  event: 'ADVANCE_YEAR';
  newYear: number;
  matchesDeleted: number;
  archivesDeleted: number;
};

export async function advanceYear(
  dbPath: string,
  seasonYear: number,
): Promise<AdvanceYearResult> {
  const client = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });
  let newYear: number;
  let matchesDeleted = 0;
  let archivesDeleted = 0;
  try {
    const season = await client.season.findFirst({ orderBy: { year: 'desc' } });
    if (!season) throw new Error('No Season row.');

    if (season.year === seasonYear) {
      // Year not yet bumped — do the year++ + age block.
      const players = await client.player.findMany({
        select: { id: true, classYear: true },
      });
      const updates: Array<{ id: string; nextClassYear: offseason.ClassYear }> = [];
      for (const p of players) {
        const adv = offseason.advanceClass({
          classYear: p.classYear as offseason.ClassYear,
        });
        if (adv.graduates || !adv.nextClassYear) continue;
        if (adv.nextClassYear === p.classYear) continue;
        updates.push({ id: p.id, nextClassYear: adv.nextClassYear });
      }

      await client.$transaction(
        async (tx) => {
          for (const u of updates) {
            await tx.player.update({
              where: { id: u.id },
              data: { classYear: u.nextClassYear, redshirtLocked: false },
            });
          }
          await tx.season.update({
            where: { id: season.id },
            data: {
              year: seasonYear + 1,
              currentWeek: 0,
              recruitingWeek: 0,
              portalWeek: 0,
              nationalChampionTeamId: null,
            },
          });
        },
        { maxWait: 30_000, timeout: 120_000 },
      );
      newYear = seasonYear + 1;
    } else {
      newYear = season.year;
    }

    // Prune (always safe to run; it short-circuits when nothing to delete).
    const prune = await pruneOldSeasons(client, {
      currentYear: newYear,
      retainSeasons: DEFAULT_RETAIN_SEASONS,
      retainArchiveYears: DEFAULT_RETAIN_ARCHIVE_YEARS,
    });
    matchesDeleted = prune.matchesDeleted + prune.tournamentMatchesNulled;
    archivesDeleted = prune.archivesDeleted;
    if (prune.matchesDeleted > 0 || prune.tournamentMatchesNulled > 0 || prune.archivesDeleted > 0) {
      await client.$executeRawUnsafe('VACUUM');
    }
  } finally {
    await client.$disconnect();
  }

  return { event: 'ADVANCE_YEAR', newYear, matchesDeleted, archivesDeleted };
}
