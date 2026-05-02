// Sprint 20: paginated list of recently played matches (winnerId set),
// used by the AnalyticsView match-selector dropdown.

import type { Prisma, PrismaClient } from '@prisma/client';
import type { matchIpc } from '@vcd/shared';

type ClientLike = PrismaClient | Prisma.TransactionClient;

export async function listRecentMatches(
  client: ClientLike,
  limit = 50,
): Promise<matchIpc.RecentMatchSummary[]> {
  const rows = await client.match.findMany({
    where: { winnerId: { not: null } },
    orderBy: { date: 'desc' },
    take: limit,
    include: {
      homeTeam: { select: { id: true, schoolName: true, abbr: true } },
      awayTeam: { select: { id: true, schoolName: true, abbr: true } },
    },
  });

  return rows.map((r) => {
    const box = r.boxScoreJson ? JSON.parse(r.boxScoreJson) : null;
    return {
      matchId: r.id,
      date: r.date.toISOString(),
      week: r.week,
      homeTeamId: r.homeTeam.id,
      homeName: r.homeTeam.schoolName,
      homeAbbr: r.homeTeam.abbr,
      homeSetsWon: box?.homeSetsWon ?? 0,
      awayTeamId: r.awayTeam.id,
      awayName: r.awayTeam.schoolName,
      awayAbbr: r.awayTeam.abbr,
      awaySetsWon: box?.awaySetsWon ?? 0,
      isTournament: r.isTournament,
    };
  });
}
