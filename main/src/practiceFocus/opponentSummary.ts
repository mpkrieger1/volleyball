// Sprint 34 Task 34.5 — opponent tendency rollup for the auto-picker.
//
// Aggregates the opponent's last N matches' PMS rows into the
// `OpponentSummary` shape consumed by `getAutoOffenseFocus` /
// `getAutoDefenseFocus`. PMS doesn't store totalServes / totalReceptions
// directly, so per-match averages serve as proxies (acceptable for v1.2 —
// the auto-picker only needs ordinal comparisons).

import type { Prisma, PrismaClient } from '@prisma/client';
import type { season } from '@vcd/shared';

type ClientLike = PrismaClient | Prisma.TransactionClient;

const DEFAULT_LOOKBACK_MATCHES = 3;

const FALLBACK: season.OpponentSummary = {
  serveAceRate: 0.05,
  aceAllowedRate: 0.05,
  hittingPct: 0.25,
  blockPerSet: 2.0,
  digPerSet: 14.0,
  attackErrorRate: 0.18,
};

export async function buildOpponentSummary(
  client: ClientLike,
  opponentTeamId: string,
  lookback = DEFAULT_LOOKBACK_MATCHES,
): Promise<season.OpponentSummary> {
  // Find opponent's last N played matches.
  const matches = await client.match.findMany({
    where: {
      OR: [{ homeTeamId: opponentTeamId }, { awayTeamId: opponentTeamId }],
      winnerId: { not: null },
    },
    orderBy: { date: 'desc' },
    take: lookback,
    select: { id: true, boxScoreJson: true },
  });

  if (matches.length === 0) return FALLBACK;

  // Pull all PMS rows for opponent's players in those matches.
  const matchIds = matches.map((m) => m.id);
  const players = await client.player.findMany({
    where: { teamId: opponentTeamId },
    select: { id: true },
  });
  const playerIds = players.map((p) => p.id);
  if (playerIds.length === 0) return FALLBACK;

  const stats = await client.playerMatchStat.findMany({
    where: { matchId: { in: matchIds }, playerId: { in: playerIds } },
    select: {
      kills: true,
      errors: true,
      totalAttacks: true,
      serviceAces: true,
      serviceErrors: true,
      receptionErrors: true,
      digs: true,
      blockSolos: true,
      blockAssists: true,
    },
  });

  if (stats.length === 0) return FALLBACK;

  let kills = 0;
  let errors = 0;
  let totalAttacks = 0;
  let serviceAces = 0;
  let serviceErrors = 0;
  let receptionErrors = 0;
  let digs = 0;
  let blockSolos = 0;
  let blockAssists = 0;
  for (const s of stats) {
    kills += s.kills;
    errors += s.errors;
    totalAttacks += s.totalAttacks;
    serviceAces += s.serviceAces;
    serviceErrors += s.serviceErrors;
    receptionErrors += s.receptionErrors;
    digs += s.digs;
    blockSolos += s.blockSolos;
    blockAssists += s.blockAssists;
  }

  // Parse box scores to count sets played across the lookback window.
  let setsPlayed = 0;
  for (const m of matches) {
    if (!m.boxScoreJson) continue;
    try {
      const box = JSON.parse(m.boxScoreJson) as { homeSetsWon?: number; awaySetsWon?: number };
      setsPlayed += (box.homeSetsWon ?? 0) + (box.awaySetsWon ?? 0);
    } catch {
      // ignore
    }
  }
  if (setsPlayed === 0) setsPlayed = matches.length * 3; // fallback assume sweep average

  const totalServes = serviceAces + serviceErrors + Math.max(0, totalAttacks * 1); // weak proxy
  const totalReceptions = totalAttacks; // each attack required a reception

  const blocks = blockSolos + blockAssists / 2; // half-credit on assists

  return {
    serveAceRate: totalServes > 0 ? serviceAces / totalServes : FALLBACK.serveAceRate,
    aceAllowedRate:
      totalReceptions > 0 ? receptionErrors / totalReceptions : FALLBACK.aceAllowedRate,
    hittingPct: totalAttacks > 0 ? (kills - errors) / totalAttacks : FALLBACK.hittingPct,
    blockPerSet: setsPlayed > 0 ? blocks / setsPlayed : FALLBACK.blockPerSet,
    digPerSet: setsPlayed > 0 ? digs / setsPlayed : FALLBACK.digPerSet,
    attackErrorRate: totalAttacks > 0 ? errors / totalAttacks : FALLBACK.attackErrorRate,
  };
}
