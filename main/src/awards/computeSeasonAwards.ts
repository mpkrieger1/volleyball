// Sprint 18: AVCA All-American computation orchestrator.
//
// Run at NCAA_CHAMP completion (right before Season.phase moves to OFFSEASON)
// or via a manual IPC call. Reads all PlayerMatchStat / Set / Player rows
// currently in the slot DB, aggregates per-player season totals, runs the
// AA selection algorithm, and persists Award rows.
//
// Idempotency: if any Award rows already exist for `seasonYear`, the call
// is a no-op. Re-running after offseason advances is safe.
//
// Sprint 18 limitation: there is no `Match.seasonYear` column today, so
// the "season filter" is implicit — we treat all current PlayerMatchStat
// rows as belonging to the year being computed. This is correct at the
// NCAA_CHAMP transition point (where this is normally called); historical
// re-computation would require a new schema column or a date-range filter.

import type { Prisma, PrismaClient } from '@prisma/client';
import { awards } from '@vcd/shared';

type ClientLike = PrismaClient | Prisma.TransactionClient;

export type ComputeSeasonAwardsResult =
  | { ok: true; skipped: true; seasonYear: number; reason: 'already-computed' }
  | { ok: true; skipped: false; seasonYear: number; count: number }
  | { ok: false; code: 'NO_DATA' | 'INTERNAL'; message: string };

export async function computeSeasonAwards(
  client: ClientLike,
  seasonYear: number,
): Promise<ComputeSeasonAwardsResult> {
  const existing = await client.award.count({ where: { seasonYear } });
  if (existing > 0) {
    return { ok: true, skipped: true, seasonYear, reason: 'already-computed' };
  }

  const stats = await client.playerMatchStat.findMany({
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
  if (stats.length === 0) {
    return { ok: false, code: 'NO_DATA', message: 'No PlayerMatchStat rows; cannot compute AA.' };
  }

  const sets = await client.set.findMany({ select: { matchId: true } });
  const setsPerMatch = new Map<string, number>();
  for (const s of sets) setsPerMatch.set(s.matchId, (setsPerMatch.get(s.matchId) ?? 0) + 1);

  const playerIds = Array.from(new Set(stats.map((s) => s.playerId)));
  const players = await client.player.findMany({
    where: { id: { in: playerIds } },
    select: { id: true, position: true, teamId: true, isLibero: true },
  });
  const playersMap = new Map<string, awards.PlayerMeta>();
  for (const p of players) {
    // Cast — Player.position is a String at the DB layer; we trust seed data.
    playersMap.set(p.id, {
      teamId: p.teamId,
      position: p.position as awards.PlayerPosition,
      isLibero: p.isLibero,
    });
  }

  // Map raw stats → AggregatedSeasonStats. The aggregator expects
  // PlayerMatchStatRow shape (hittingPct as `hittingPct`, not `hittingPctMilli`).
  // Both the Prisma column and the helper input use the same name, so this
  // is a direct pass-through via `aggregateAllPlayers`.
  const agg = awards.aggregateAllPlayers(
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

  const selections = awards.selectAllAmericans({ stats: agg, players: playersMap });

  if (selections.length === 0) {
    return { ok: false, code: 'NO_DATA', message: 'AA selection produced 0 rows; check eligibility filter.' };
  }

  await client.award.createMany({
    data: selections.map((s) => ({
      seasonYear,
      category: awards.AA_CATEGORY[s.team],
      playerId: s.playerId,
      team: s.team,
    })),
  });

  return { ok: true, skipped: false, seasonYear, count: selections.length };
}
