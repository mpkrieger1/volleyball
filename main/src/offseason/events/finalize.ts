// Sprint 33 — FINALIZE (preseason) event handler.
//
// Set Season.phase = REGULAR + reset phaseWeek = 0. By this point:
//   - PLAYERS_LEAVING archived seniors and cut to cap.
//   - SIGNING_DAY promoted COMMITTED recruits to Player rows.
//   - ADVANCE_YEAR aged class years and bumped Season.year.
//   - TRAINING_RESULTS applied training gains.
// Sprint 37 (post-launch UAT): FINALIZE now also generates the regular-
// season schedule so the user sees their full 13-week slate at week 0
// instead of an empty schedule. Pre-Sprint-37, the schedule was generated
// lazily on the first advanceWeek call, leaving week 0 empty in the UI.
//
// Idempotent: phase write is safe to repeat. Schedule generation is
// skipped if non-tournament Match rows for this season already exist.

import type { PrismaClient } from '@prisma/client';
import { generateAndPersistSchedule } from '../../schedule/generateAndPersist';

export type FinalizeResult = {
  event: 'FINALIZE';
  matchesGenerated: number;
};

export async function finalize(
  client: PrismaClient,
  _seasonYear: number,
  dbPath?: string,
): Promise<FinalizeResult> {
  const season = await client.season.findFirst({ orderBy: { year: 'desc' } });
  if (!season) throw new Error('No Season row.');

  // Generate schedule if not already present. Idempotent: skip when
  // any non-tournament Match rows exist for this season's calendar year.
  let matchesGenerated = 0;
  if (dbPath) {
    const yearStart = new Date(`${season.year}-08-01T00:00:00Z`);
    const yearEnd = new Date(`${season.year + 1}-08-01T00:00:00Z`);
    const existing = await client.match.count({
      where: { isTournament: false, date: { gte: yearStart, lt: yearEnd } },
    });
    if (existing === 0) {
      const result = await generateAndPersistSchedule({
        dbPath,
        seasonYear: season.year,
        seed: `season-${season.year}`,
      });
      matchesGenerated = result.stats.totalMatches;
    } else {
      matchesGenerated = existing;
    }
  }

  await client.season.update({
    where: { id: season.id },
    data: { phase: 'REGULAR', phaseWeek: 0, currentWeek: 0 },
  });
  return { event: 'FINALIZE', matchesGenerated };
}
