import { ipcMain } from 'electron';
import { PrismaClient } from '@prisma/client';
import { postseasonIpc, type tournament } from '@vcd/shared';
import { findSlotDbPathById, type SaveSlotServiceDeps } from '../saveSlots/service';
import { getOrCreatePool } from '../season/poolRegistry';
import { generateConfTournamentMatches } from '../postseason/generateConfTournamentMatches';
import { startNcaaTournament } from '../postseason/startNcaaTournament';
import { advanceTournamentRound } from '../postseason/advanceTournamentRound';

export function registerPostseasonHandlers(deps: SaveSlotServiceDeps): void {
  ipcMain.handle(postseasonIpc.POSTSEASON_IPC_CHANNELS.startCt, async (_e, raw: unknown) => {
    try {
      const req = postseasonIpc.StartCtRequest.parse(raw);
      const dbPath = await findSlotDbPathById(deps, req.slotId);
      if (!dbPath) {
        return {
          ok: false as const,
          error: { code: 'NOT_FOUND' as const, message: `slot ${req.slotId} not found` },
        };
      }
      const result = await generateConfTournamentMatches({ dbPath });
      return { ok: true as const, matchesCreated: result.matchesCreated };
    } catch (err) {
      return {
        ok: false as const,
        error: { code: 'INTERNAL' as const, message: (err as Error).message },
      };
    }
  });

  ipcMain.handle(postseasonIpc.POSTSEASON_IPC_CHANNELS.startNcaa, async (_e, raw: unknown) => {
    try {
      const req = postseasonIpc.StartNcaaRequest.parse(raw);
      const dbPath = await findSlotDbPathById(deps, req.slotId);
      if (!dbPath) {
        return {
          ok: false as const,
          error: { code: 'NOT_FOUND' as const, message: `slot ${req.slotId} not found` },
        };
      }
      const result = await startNcaaTournament({ dbPath, seasonYear: req.seasonYear });
      return {
        ok: true as const,
        r64MatchesCreated: result.r64MatchesCreated,
        autoBidCount: result.autoBidCount,
      };
    } catch (err) {
      return {
        ok: false as const,
        error: { code: 'INTERNAL' as const, message: (err as Error).message },
      };
    }
  });

  ipcMain.handle(postseasonIpc.POSTSEASON_IPC_CHANNELS.advanceRound, async (_e, raw: unknown) => {
    try {
      const req = postseasonIpc.AdvanceRoundRequest.parse(raw);
      const dbPath = await findSlotDbPathById(deps, req.slotId);
      if (!dbPath) {
        return {
          ok: false as const,
          error: { code: 'NOT_FOUND' as const, message: `slot ${req.slotId} not found` },
        };
      }
      const pool = getOrCreatePool(deps, req.slotId);
      const result = await advanceTournamentRound({
        dbPath,
        pool,
        round: req.round as tournament.TournamentRound,
      });
      if (!result.ok) {
        return {
          ok: false as const,
          error: { code: result.code, message: result.message },
        };
      }
      return {
        ok: true as const,
        round: result.round,
        matchesPlayed: result.matchesPlayed,
        nextRoundCreated: result.nextRoundCreated,
        ...(result.championTeamId ? { championTeamId: result.championTeamId } : {}),
      };
    } catch (err) {
      return {
        ok: false as const,
        error: { code: 'INTERNAL' as const, message: (err as Error).message },
      };
    }
  });

  ipcMain.handle(postseasonIpc.POSTSEASON_IPC_CHANNELS.getState, async (_e, raw: unknown) => {
    try {
      const req = postseasonIpc.GetStateRequest.parse(raw);
      const dbPath = await findSlotDbPathById(deps, req.slotId);
      if (!dbPath) {
        return {
          ok: false as const,
          error: { code: 'NOT_FOUND' as const, message: `slot ${req.slotId} not found` },
        };
      }
      const client = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });
      try {
        const season = await client.season.findFirst({ orderBy: { year: 'desc' } });
        if (!season) {
          return {
            ok: false as const,
            error: { code: 'NOT_FOUND' as const, message: 'No Season row.' },
          };
        }
        const tourneyMatches = await client.match.findMany({
          where: { isTournament: true },
          include: {
            homeTeam: { select: { abbr: true, schoolName: true } },
            awayTeam: { select: { abbr: true, schoolName: true } },
            sets: { orderBy: { index: 'asc' } },
          },
          orderBy: [{ tournamentRound: 'asc' }, { bracketGroupKey: 'asc' }, { bracketSlot: 'asc' }],
        });

        let championTeamSchool: string | null = null;
        if (season.nationalChampionTeamId) {
          const champ = await client.team.findUnique({
            where: { id: season.nationalChampionTeamId },
            select: { schoolName: true },
          });
          championTeamSchool = champ?.schoolName ?? null;
        }

        return {
          ok: true as const,
          phase: season.phase,
          seasonYear: season.year,
          championTeamId: season.nationalChampionTeamId ?? null,
          championTeamSchool,
          matches: tourneyMatches.map((m) => ({
            matchId: m.id,
            round: (m.tournamentRound ?? 'CT_R1') as postseasonIpc.TournamentRound,
            bracketSlot: m.bracketSlot ?? 0,
            bracketGroupKey: m.bracketGroupKey ?? '',
            homeTeamId: m.homeTeamId,
            awayTeamId: m.awayTeamId,
            homeTeamAbbr: m.homeTeam.abbr,
            awayTeamAbbr: m.awayTeam.abbr,
            homeTeamSchool: m.homeTeam.schoolName,
            awayTeamSchool: m.awayTeam.schoolName,
            winnerId: m.winnerId,
            setScores: m.sets.map((s) => ({ home: s.home, away: s.away })),
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
