// Sprint 20: extends getMatchById with per-slot block ratings + positions
// + playerIds for the analytics K/set vs block scatter chart.

import type { Prisma, PrismaClient } from '@prisma/client';
import type { matchIpc } from '@vcd/shared';
import { getMatchById } from './getMatchById';
import { pickStartersForTeam } from './pickStarters';

type ClientLike = PrismaClient | Prisma.TransactionClient;

export type GetMatchAnalyticsResult =
  | { ok: true; payload: Extract<matchIpc.GetMatchAnalyticsResponse, { ok: true }> }
  | { ok: false; code: 'NOT_FOUND' | 'INTERNAL'; message: string };

async function loadSideMeta(
  client: ClientLike,
  base: matchIpc.MatchSideMeta,
  teamId: string,
): Promise<matchIpc.MatchAnalyticsSideMeta> {
  const ids = await pickStartersForTeam(client, teamId);
  const players = await client.player.findMany({
    where: { id: { in: [...ids] } },
    select: { id: true, position: true, ratingBlock: true },
  });
  const byId = new Map(players.map((p) => [p.id, p] as const));
  return {
    ...base,
    lineupRatingsBlock: ids.map((id) => byId.get(id)?.ratingBlock ?? 0),
    lineupPositions: ids.map((id) => byId.get(id)?.position ?? ''),
    lineupPlayerIds: [...ids],
  };
}

export async function getMatchAnalytics(
  client: ClientLike,
  matchId: string,
): Promise<GetMatchAnalyticsResult> {
  const inner = await getMatchById(client, matchId);
  if (!inner.ok) return inner;

  const [home, away] = await Promise.all([
    loadSideMeta(client, inner.payload.home, inner.payload.match.homeTeamId),
    loadSideMeta(client, inner.payload.away, inner.payload.match.awayTeamId),
  ]);

  return {
    ok: true,
    payload: {
      ok: true,
      match: inner.payload.match,
      home,
      away,
      boxScore: inner.payload.boxScore,
      pbp: inner.payload.pbp,
      timeline: inner.payload.timeline,
      sets: inner.payload.sets,
      setsPlayed: inner.payload.sets.length,
    },
  };
}
