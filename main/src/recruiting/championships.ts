// Sprint 37 (lifted from Sprint 36 carry-forward) — championship history
// aggregator for the CoachPedigree pitch reason.
//
// Sources:
//   - National championships: `Season.nationalChampionTeamId == teamId`
//     across all Season rows.
//   - Conference championships: `Match.tournamentRound === 'CT_F'` AND
//     `Match.winnerId === teamId` (Sprint 11 conference final marker).
//
// Attribution: v1.2 has no HC-history audit table, so all championships
// within `Coach.hireSeason..now` are credited to the CURRENT HC. This
// over-counts when an HC has been at the team for many years AND there
// were multiple HCs in that window. Acceptable for v1.2; v1.3 may add
// an HC-tenure table.

import type { Prisma, PrismaClient } from '@prisma/client';
import type { recruiting } from '@vcd/shared';

type ClientLike = PrismaClient | Prisma.TransactionClient;

export async function loadHcChampionships(args: {
  client: ClientLike;
  teamId: string;
  hcId: string;
  hcHireSeason: number;
}): Promise<recruiting.ChampionshipsHistory> {
  const [natRows, confRows] = await Promise.all([
    args.client.season.findMany({
      where: {
        nationalChampionTeamId: args.teamId,
        year: { gte: args.hcHireSeason },
      },
      select: { year: true },
    }),
    args.client.match.findMany({
      where: {
        tournamentRound: 'CT_F',
        winnerId: args.teamId,
      },
      select: { id: true, date: true },
    }),
  ]);
  // Filter conf champs by date >= hire season's calendar start (Aug of
  // hireSeason). Approximation: any match dated on/after `hireSeason`
  // counts.
  const hireDateLowerBound = new Date(`${args.hcHireSeason}-08-01T00:00:00Z`);
  const confChampYears: number[] = [];
  for (const m of confRows) {
    if (m.date >= hireDateLowerBound) {
      confChampYears.push(m.date.getUTCFullYear());
    }
  }
  return {
    coachId: args.hcId,
    nationalChampYears: natRows.map((r) => r.year),
    confChampYears,
  };
}
