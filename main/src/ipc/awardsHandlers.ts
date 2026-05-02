// Sprint 18: AVCA All-American IPC handlers.
//
// awards:listForSeason — returns 4 teams × 7 entries enriched with player
// names, team metadata, and the position-relevant primary stat. Also
// returns the list of seasons that have any Award rows (for the dropdown).
//
// awards:careerForPlayer — returns the chronological list of AA awards
// for a single player, used by the inline career-history expander.

import { ipcMain } from 'electron';
import { PrismaClient } from '@prisma/client';
import { awards, awardsIpc } from '@vcd/shared';
import { findSlotDbPathById, type SaveSlotServiceDeps } from '../saveSlots/service';

type EffectivePosition = 'OH' | 'MB' | 'OPP' | 'S' | 'L' | 'DS';

function primaryStatFor(
  pos: EffectivePosition,
  agg: awards.AggregatedSeasonStats,
): { label: string; value: number } {
  const sets = Math.max(1, agg.setsPlayed);
  switch (pos) {
    case 'OH':
    case 'OPP':
      return { label: 'K/set', value: round(agg.kills / sets, 2) };
    case 'MB':
      return { label: 'B/set', value: round((agg.blockSolos + agg.blockAssists * 0.5) / sets, 2) };
    case 'S':
      return { label: 'A/set', value: round(agg.assists / sets, 2) };
    case 'L':
    case 'DS':
      return { label: 'D/set', value: round(agg.digs / sets, 2) };
  }
}

function round(n: number, places: number): number {
  const f = 10 ** places;
  return Math.round(n * f) / f;
}

export function registerAwardsHandlers(deps: SaveSlotServiceDeps): void {
  ipcMain.handle(awardsIpc.AWARDS_IPC_CHANNELS.listForSeason, async (_e, raw: unknown) => {
    try {
      const req = awardsIpc.ListForSeasonRequest.parse(raw);
      const dbPath = await findSlotDbPathById(deps, req.slotId);
      if (!dbPath) {
        return {
          ok: false as const,
          error: { code: 'NOT_FOUND' as const, message: `slot ${req.slotId} not found` },
        };
      }
      const client = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });
      try {
        const seasonRows = await client.award.groupBy({
          by: ['seasonYear'],
          orderBy: { seasonYear: 'desc' },
        });
        const availableSeasons = seasonRows.map((r) => r.seasonYear);

        const awardRows = await client.award.findMany({ where: { seasonYear: req.seasonYear } });
        if (awardRows.length === 0) {
          return {
            ok: false as const,
            error: { code: 'NO_AWARDS' as const, message: `no awards for season ${req.seasonYear}` },
          };
        }
        const playerIds = awardRows.map((r) => r.playerId);
        const [players, allStats, allSets, priorAwards] = await Promise.all([
          client.player.findMany({
            where: { id: { in: playerIds } },
            include: { team: { select: { id: true, schoolName: true, abbr: true } } },
          }),
          client.playerMatchStat.findMany({ where: { playerId: { in: playerIds } } }),
          client.set.findMany({ select: { matchId: true } }),
          client.award.findMany({
            where: { playerId: { in: playerIds }, seasonYear: { lt: req.seasonYear } },
          }),
        ]);

        const playerById = new Map(players.map((p) => [p.id, p] as const));
        const setsPerMatch = new Map<string, number>();
        for (const s of allSets) setsPerMatch.set(s.matchId, (setsPerMatch.get(s.matchId) ?? 0) + 1);
        const aggBy = awards.aggregateAllPlayers(
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
        const priorByPlayer = new Map<string, number>();
        for (const a of priorAwards) priorByPlayer.set(a.playerId, (priorByPlayer.get(a.playerId) ?? 0) + 1);

        const empty = (): awards.AggregatedSeasonStats => ({
          playerId: '',
          matchesPlayed: 0,
          setsPlayed: 0,
          kills: 0,
          errors: 0,
          totalAttacks: 0,
          hittingPctMilli: 0,
          assists: 0,
          serviceAces: 0,
          serviceErrors: 0,
          receptionErrors: 0,
          digs: 0,
          blockSolos: 0,
          blockAssists: 0,
        });

        const buckets: Record<awardsIpc.AaTeam, awardsIpc.AwardEntry[]> = {
          first: [],
          second: [],
          third: [],
          hm: [],
        };
        for (const row of awardRows) {
          const player = playerById.get(row.playerId);
          if (!player) continue;
          const eff = (player.isLibero ? 'L' : player.position) as EffectivePosition;
          const agg = aggBy.get(player.id) ?? empty();
          const team = row.team as awardsIpc.AaTeam;
          buckets[team].push({
            playerId: player.id,
            playerName: `${player.firstName} ${player.lastName}`,
            position: player.position as awardsIpc.AwardEntry['position'],
            isLibero: player.isLibero,
            teamId: player.team.id,
            teamName: player.team.schoolName,
            teamAbbr: player.team.abbr,
            classYear: player.classYear,
            primaryStat: primaryStatFor(eff, agg),
            priorAaCount: priorByPlayer.get(player.id) ?? 0,
          });
        }

        // Sort each team-bucket by primary stat desc for stable rendering.
        for (const arr of Object.values(buckets)) {
          arr.sort((a, b) => b.primaryStat.value - a.primaryStat.value);
        }

        return {
          ok: true as const,
          seasonYear: req.seasonYear,
          teams: buckets,
          availableSeasons,
        };
      } finally {
        await client.$disconnect();
      }
    } catch (err) {
      return {
        ok: false as const,
        error: { code: 'INTERNAL' as const, message: (err as Error).message },
      };
    }
  });

  ipcMain.handle(awardsIpc.AWARDS_IPC_CHANNELS.careerForPlayer, async (_e, raw: unknown) => {
    try {
      const req = awardsIpc.CareerForPlayerRequest.parse(raw);
      const dbPath = await findSlotDbPathById(deps, req.slotId);
      if (!dbPath) {
        return {
          ok: false as const,
          error: { code: 'NOT_FOUND' as const, message: `slot ${req.slotId} not found` },
        };
      }
      const client = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });
      try {
        const rows = await client.award.findMany({
          where: { playerId: req.playerId },
          orderBy: { seasonYear: 'desc' },
        });
        return {
          ok: true as const,
          playerId: req.playerId,
          awards: rows.map((r) => ({
            seasonYear: r.seasonYear,
            category: r.category as awardsIpc.AaCategory,
            team: r.team as awardsIpc.AaTeam,
          })),
        };
      } finally {
        await client.$disconnect();
      }
    } catch (err) {
      return {
        ok: false as const,
        error: { code: 'INTERNAL' as const, message: (err as Error).message },
      };
    }
  });
}
