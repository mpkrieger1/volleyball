import { ipcMain } from 'electron';
import { PrismaClient } from '@prisma/client';
import { matchIpc } from '@vcd/shared';
import { findSlotDbPathById, type SaveSlotServiceDeps } from '../saveSlots/service';
import { simulateAndPersistMatch, MatchError } from '../match/simulateAndPersist';
import { getMatchById } from '../match/getMatchById';
import { getMatchAnalytics } from '../match/getMatchAnalytics';
import { listRecentMatches } from '../match/listRecentMatches';
import { getSeasonAnalytics } from '../match/getSeasonAnalytics';

function toIpcError(err: unknown) {
  if (err instanceof MatchError) {
    return { ok: false as const, error: { code: err.code, message: err.message } };
  }
  return {
    ok: false as const,
    error: { code: 'INTERNAL' as const, message: (err as Error).message },
  };
}

export function registerMatchHandlers(deps: SaveSlotServiceDeps): void {
  ipcMain.handle(matchIpc.MATCH_IPC_CHANNELS.listTeams, async (_e, raw: unknown) => {
    try {
      const req = matchIpc.ListTeamsRequest.parse(raw);
      const dbPath = await findSlotDbPathById(deps, req.slotId);
      if (!dbPath) {
        return {
          ok: false as const,
          error: { code: 'NOT_FOUND' as const, message: `slot ${req.slotId} not found` },
        };
      }
      const client = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });
      try {
        const rows = await client.team.findMany({
          orderBy: [{ conferenceId: 'asc' }, { schoolName: 'asc' }],
        });
        return {
          ok: true as const,
          teams: rows.map((r) => ({
            id: r.id,
            schoolName: r.schoolName,
            abbr: r.abbr,
            conferenceId: r.conferenceId,
            primaryColor: r.primaryColor,
            secondaryColor: r.secondaryColor,
            prestige: r.prestige,
          })),
        };
      } finally {
        await client.$disconnect();
      }
    } catch (err) {
      return toIpcError(err);
    }
  });

  ipcMain.handle(matchIpc.MATCH_IPC_CHANNELS.simulate, async (_e, raw: unknown) => {
    try {
      const req = matchIpc.SimulateMatchRequest.parse(raw);
      const dbPath = await findSlotDbPathById(deps, req.slotId);
      if (!dbPath) {
        return {
          ok: false as const,
          error: { code: 'NOT_FOUND' as const, message: `slot ${req.slotId} not found` },
        };
      }
      const result = await simulateAndPersistMatch({
        dbPath,
        homeTeamId: req.homeTeamId,
        awayTeamId: req.awayTeamId,
        seed: req.seed,
      });
      return {
        ok: true as const,
        matchId: result.matchId,
        boxScore: result.boxScore,
        pbpChars: result.pbpChars,
      };
    } catch (err) {
      return toIpcError(err);
    }
  });

  ipcMain.handle(matchIpc.MATCH_IPC_CHANNELS.getById, async (_e, raw: unknown) => {
    try {
      const req = matchIpc.GetMatchByIdRequest.parse(raw);
      const dbPath = await findSlotDbPathById(deps, req.slotId);
      if (!dbPath) {
        return {
          ok: false as const,
          error: { code: 'NOT_FOUND' as const, message: `slot ${req.slotId} not found` },
        };
      }
      const client = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });
      try {
        const result = await getMatchById(client, req.matchId);
        if (!result.ok) {
          return {
            ok: false as const,
            error: { code: result.code, message: result.message },
          };
        }
        return result.payload;
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

  ipcMain.handle(matchIpc.MATCH_IPC_CHANNELS.getAnalytics, async (_e, raw: unknown) => {
    try {
      const req = matchIpc.GetMatchAnalyticsRequest.parse(raw);
      const dbPath = await findSlotDbPathById(deps, req.slotId);
      if (!dbPath) {
        return {
          ok: false as const,
          error: { code: 'NOT_FOUND' as const, message: `slot ${req.slotId} not found` },
        };
      }
      const client = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });
      try {
        const result = await getMatchAnalytics(client, req.matchId);
        if (!result.ok) {
          return { ok: false as const, error: { code: result.code, message: result.message } };
        }
        return result.payload;
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

  ipcMain.handle(matchIpc.MATCH_IPC_CHANNELS.listRecentMatches, async (_e, raw: unknown) => {
    try {
      const req = matchIpc.ListRecentMatchesRequest.parse(raw);
      const dbPath = await findSlotDbPathById(deps, req.slotId);
      if (!dbPath) {
        return {
          ok: false as const,
          error: { code: 'NOT_FOUND' as const, message: `slot ${req.slotId} not found` },
        };
      }
      const client = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });
      try {
        const matches = await listRecentMatches(client, req.limit);
        return { ok: true as const, matches };
      } finally {
        await client.$disconnect();
      }
    } catch (err) {
      return {
        ok: false as const,
        error: { code: 'IO_ERROR' as const, message: (err as Error).message },
      };
    }
  });

  // Sprint 28: season analytics aggregator (used by Analytics screen "Season"
  // mode and the Roster screen's stats toggle).
  ipcMain.handle(matchIpc.MATCH_IPC_CHANNELS.seasonAnalytics, async (_e, raw: unknown) => {
    try {
      const req = matchIpc.SeasonAnalyticsRequest.parse(raw);
      const dbPath = await findSlotDbPathById(deps, req.slotId);
      if (!dbPath) {
        return {
          ok: false as const,
          error: { code: 'NOT_FOUND' as const, message: `slot ${req.slotId} not found` },
        };
      }
      const result = await getSeasonAnalytics({ dbPath, teamId: req.teamId });
      if ('error' in result) {
        return { ok: false as const, error: { code: result.error, message: result.message } };
      }
      return { ok: true as const, ...result };
    } catch (err) {
      return {
        ok: false as const,
        error: { code: 'IO_ERROR' as const, message: (err as Error).message },
      };
    }
  });
}
