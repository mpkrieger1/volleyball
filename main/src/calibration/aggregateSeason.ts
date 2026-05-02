// Sprint 22: load the post-season DB state and compute top-25 team
// aggregates ready for benchmark comparison.

import type { Prisma, PrismaClient } from '@prisma/client';
import { calibration, awards } from '@vcd/shared';

type ClientLike = PrismaClient | Prisma.TransactionClient;

export type SeasonAggregateResult = {
  topTeams: calibration.TeamSeasonStats[];
  averages: calibration.Top25Aggregates['averages'];
  pollSize: number;
  matchCount: number;
};

/**
 * Compute Sprint 22 top-25 team-level averages for the most recent season
 * in the DB. Reads:
 *   - Latest week's Poll for top-25 selection
 *   - All PlayerMatchStat rows + Set rows + Player meta for aggregation
 */
export async function aggregateSeasonForCalibration(
  client: ClientLike,
): Promise<SeasonAggregateResult> {
  // Latest poll = highest week number with any Poll row.
  const latestWeek = await client.poll.aggregate({ _max: { week: true } });
  const week = latestWeek._max.week ?? 0;
  const pollRows =
    week > 0
      ? await client.poll.findMany({
          where: { week },
          orderBy: { rank: 'asc' },
          take: 25,
        })
      : [];

  // Per-player season stats: load PMS + Set count map.
  const allStats = await client.playerMatchStat.findMany({
    select: {
      id: true,
      playerId: true,
      matchId: true,
      kills: true,
      errors: true,
      totalAttacks: true,
      hittingPct: true,
      assists: true,
      serviceAces: true,
      serviceErrors: true,
      receptionErrors: true,
      digs: true,
      blockSolos: true,
      blockAssists: true,
      rotationMinutes: true,
    },
  });
  const matchIds = Array.from(new Set(allStats.map((s) => s.matchId)));
  const sets = await client.set.findMany({
    where: { matchId: { in: matchIds } },
    select: { matchId: true },
  });
  const setsPerMatch = new Map<string, number>();
  for (const s of sets) setsPerMatch.set(s.matchId, (setsPerMatch.get(s.matchId) ?? 0) + 1);

  const aggMap = awards.aggregateAllPlayers(
    allStats.map((s) => ({
      playerId: s.playerId,
      matchId: s.matchId,
      kills: s.kills,
      errors: s.errors,
      totalAttacks: s.totalAttacks,
      hittingPct: s.hittingPct,
      assists: s.assists,
      serviceAces: s.serviceAces,
      serviceErrors: s.serviceErrors,
      receptionErrors: s.receptionErrors,
      digs: s.digs,
      blockSolos: s.blockSolos,
      blockAssists: s.blockAssists,
      rotationMinutes: s.rotationMinutes,
    })),
    setsPerMatch,
  );

  // Player meta — only needed for players who showed up in stats.
  const playerIds = Array.from(aggMap.keys());
  const players = await client.player.findMany({
    where: { id: { in: playerIds } },
    select: { id: true, teamId: true, position: true, isLibero: true },
  });
  const playerMeta = new Map<string, { teamId: string; position: string; isLibero: boolean }>();
  for (const p of players) {
    playerMeta.set(p.id, { teamId: p.teamId, position: p.position, isLibero: p.isLibero });
  }

  const top25 = calibration.aggregateTop25({
    stats: aggMap,
    playerMeta,
    pollTop25: pollRows.map((r) => ({ teamId: r.teamId, rank: r.rank })),
  });

  return {
    topTeams: top25.topTeams,
    averages: top25.averages,
    pollSize: pollRows.length,
    matchCount: matchIds.length,
  };
}
