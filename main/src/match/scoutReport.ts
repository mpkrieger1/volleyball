// Sprint 19: pre-match scout report.
//
// Loads:
//   - Team.preferredSystem (Sprint 19 column).
//   - Last 5 matches the opponent has played (winnerId set), with W/L
//     and set totals.
//   - All PlayerMatchStat rows for opponent's players in their prior
//     matches; aggregates per-player season stats and returns the top 3
//     OH/OPP hitters by K/set.
//
// throughDate is optional; default = now. Useful when the user is about to
// play a match in week N and wants stats from weeks 1..N-1 only.

import type { Prisma, PrismaClient } from '@prisma/client';
import { awards, scoutIpc } from '@vcd/shared';

type ClientLike = PrismaClient | Prisma.TransactionClient;

export type ScoutReportResult =
  | { ok: true; payload: scoutIpc.ScoutReportResponse extends infer T ? Extract<T, { ok: true }> : never }
  | { ok: false; code: 'NOT_FOUND' | 'INTERNAL'; message: string };

export async function buildScoutReport(
  client: ClientLike,
  opponentTeamId: string,
  throughDate?: Date,
): Promise<ScoutReportResult> {
  const team = await client.team.findUnique({ where: { id: opponentTeamId } });
  if (!team) {
    return { ok: false, code: 'NOT_FOUND', message: `team ${opponentTeamId} not found` };
  }
  const cutoff = throughDate ?? new Date();

  // Recent form: last 5 played matches involving the opponent, by date desc.
  const recentRows = await client.match.findMany({
    where: {
      OR: [{ homeTeamId: opponentTeamId }, { awayTeamId: opponentTeamId }],
      winnerId: { not: null },
      date: { lt: cutoff },
    },
    orderBy: { date: 'desc' },
    take: 5,
    include: {
      homeTeam: { select: { id: true, schoolName: true, abbr: true } },
      awayTeam: { select: { id: true, schoolName: true, abbr: true } },
    },
  });
  const recentForm: scoutIpc.RecentFormEntry[] = recentRows
    .reverse() // oldest → newest
    .map((m) => {
      const isHome = m.homeTeamId === opponentTeamId;
      const opp = isHome ? m.awayTeam : m.homeTeam;
      const result: 'W' | 'L' = m.winnerId === opponentTeamId ? 'W' : 'L';
      const box = m.boxScoreJson ? JSON.parse(m.boxScoreJson) : null;
      const homeSetsWon = box?.homeSetsWon ?? 0;
      const awaySetsWon = box?.awaySetsWon ?? 0;
      const setsFor = isHome ? homeSetsWon : awaySetsWon;
      const setsAgainst = isHome ? awaySetsWon : homeSetsWon;
      return {
        matchId: m.id,
        date: m.date.toISOString(),
        result,
        opponentTeamId: opp.id,
        opponentName: opp.schoolName,
        opponentAbbr: opp.abbr,
        setsFor,
        setsAgainst,
      };
    });

  // Top hitters: for OH/OPP players on the opponent, aggregate K/set across
  // matches strictly before `cutoff`. Reuse Sprint 18 awards.aggregateAllPlayers.
  const opponentPlayers = await client.player.findMany({
    where: { teamId: opponentTeamId, position: { in: ['OH', 'OPP'] } },
    select: { id: true, firstName: true, lastName: true, position: true },
  });
  const opponentPlayerIds = opponentPlayers.map((p) => p.id);

  const stats = await client.playerMatchStat.findMany({
    where: {
      playerId: { in: opponentPlayerIds },
      match: { date: { lt: cutoff }, winnerId: { not: null } },
    },
    select: {
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
  const matchIds = Array.from(new Set(stats.map((s) => s.matchId)));
  const sets = await client.set.findMany({
    where: { matchId: { in: matchIds } },
    select: { matchId: true },
  });
  const setsPerMatch = new Map<string, number>();
  for (const s of sets) setsPerMatch.set(s.matchId, (setsPerMatch.get(s.matchId) ?? 0) + 1);

  const aggregated = awards.aggregateAllPlayers(
    stats.map((s) => ({
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

  const playerById = new Map(opponentPlayers.map((p) => [p.id, p] as const));
  const candidates: scoutIpc.ScoutHitter[] = [];
  for (const [playerId, agg] of aggregated) {
    if (agg.setsPlayed === 0) continue;
    const player = playerById.get(playerId);
    if (!player) continue;
    candidates.push({
      playerId,
      playerName: `${player.firstName} ${player.lastName}`,
      position: player.position,
      killsPerSet: round(agg.kills / agg.setsPlayed, 2),
      matchesPlayed: agg.matchesPlayed,
    });
  }
  candidates.sort((a, b) => b.killsPerSet - a.killsPerSet || a.playerId.localeCompare(b.playerId));
  const topHitters = candidates.slice(0, 3);

  return {
    ok: true,
    payload: {
      ok: true,
      opponentTeamId: team.id,
      opponentName: team.schoolName,
      opponentAbbr: team.abbr,
      system: team.preferredSystem,
      topHitters,
      recentForm,
    },
  };
}

function round(n: number, places: number): number {
  const f = 10 ** places;
  return Math.round(n * f) / f;
}
