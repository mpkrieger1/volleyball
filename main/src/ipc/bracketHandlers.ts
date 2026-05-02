import { ipcMain } from 'electron';
import { PrismaClient } from '@prisma/client';
import { bracketIpc } from '@vcd/shared';
import { findSlotDbPathById, type SaveSlotServiceDeps } from '../saveSlots/service';
import { generateAndPersistBracket } from '../bracket/generateAndPersistBracket';

export function registerBracketHandlers(deps: SaveSlotServiceDeps): void {
  ipcMain.handle(bracketIpc.BRACKET_IPC_CHANNELS.generate, async (_e, raw: unknown) => {
    try {
      const req = bracketIpc.GenerateBracketRequest.parse(raw);
      const dbPath = await findSlotDbPathById(deps, req.slotId);
      if (!dbPath) {
        return {
          ok: false as const,
          error: { code: 'NOT_FOUND' as const, message: `slot ${req.slotId} not found` },
        };
      }
      const result = await generateAndPersistBracket({
        dbPath,
        seasonYear: req.seasonYear,
        metric: req.metric,
      });

      // Map entries → view (add team school/abbr for renderer display).
      const client = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });
      try {
        const teams = await client.team.findMany({
          where: { id: { in: result.entries.map((e) => e.teamId) } },
          select: { id: true, schoolName: true, abbr: true },
        });
        const teamById = new Map(teams.map((t) => [t.id, t]));
        return {
          ok: true as const,
          seasonYear: result.seasonYear,
          metric: result.metric,
          entries: result.entries.map((e) => {
            const t = teamById.get(e.teamId);
            return {
              region: e.region,
              seed: e.seed,
              teamId: e.teamId,
              teamSchool: t?.schoolName ?? '?',
              teamAbbr: t?.abbr ?? '?',
              autoBid: e.autoBid,
              metricRank: e.metricRank,
            };
          }),
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

  ipcMain.handle(bracketIpc.BRACKET_IPC_CHANNELS.latest, async (_e, raw: unknown) => {
    try {
      const req = bracketIpc.GetLatestBracketRequest.parse(raw);
      const dbPath = await findSlotDbPathById(deps, req.slotId);
      if (!dbPath) {
        return {
          ok: false as const,
          error: { code: 'NOT_FOUND' as const, message: `slot ${req.slotId} not found` },
        };
      }
      const client = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });
      try {
        const entries = await client.bracketEntry.findMany({
          where: { seasonYear: req.seasonYear },
          orderBy: [{ region: 'asc' }, { seed: 'asc' }],
        });
        const teams = await client.team.findMany({
          where: { id: { in: entries.map((e) => e.teamId) } },
          select: { id: true, schoolName: true, abbr: true },
        });
        const teamById = new Map(teams.map((t) => [t.id, t]));
        return {
          ok: true as const,
          seasonYear: req.seasonYear,
          metric: 'RPI' as const,
          entries: entries.map((e) => {
            const t = teamById.get(e.teamId);
            return {
              region: e.region as bracketIpc.BracketRegion,
              seed: e.seed,
              teamId: e.teamId,
              teamSchool: t?.schoolName ?? '?',
              teamAbbr: t?.abbr ?? '?',
              autoBid: e.autoBid,
              metricRank: e.metricRank,
            };
          }),
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
