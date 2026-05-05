// Sprint 33 — YEAR_SUMMARY event handler.
//
// Read-only: snapshots end-of-year payload (national champion, awards
// summary, top-25 final poll). The actual snapshot UI is read from
// existing Sprint 18 tables. This handler is a no-op on the data side;
// it just acknowledges the event.

import type { PrismaClient } from '@prisma/client';

export type YearSummaryResult = {
  event: 'YEAR_SUMMARY';
  championTeamId: string | null;
  awardsCount: number;
};

export async function yearSummary(
  client: PrismaClient,
  seasonYear: number,
): Promise<YearSummaryResult> {
  const season = await client.season.findFirst({ where: { year: seasonYear } });
  const awardsCount = await client.award.count({ where: { seasonYear } });
  return {
    event: 'YEAR_SUMMARY',
    championTeamId: season?.nationalChampionTeamId ?? null,
    awardsCount,
  };
}
