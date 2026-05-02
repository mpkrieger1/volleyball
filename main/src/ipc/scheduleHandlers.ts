import { ipcMain } from 'electron';
import { PrismaClient } from '@prisma/client';
import { scheduleIpc } from '@vcd/shared';
import { findSlotDbPathById, type SaveSlotServiceDeps } from '../saveSlots/service';
import { generateAndPersistSchedule, ScheduleError } from '../schedule/generateAndPersist';

function toIpcError(err: unknown) {
  if (err instanceof ScheduleError) {
    return { ok: false as const, error: { code: err.code, message: err.message } };
  }
  return {
    ok: false as const,
    error: { code: 'INTERNAL' as const, message: (err as Error).message },
  };
}

export function registerScheduleHandlers(deps: SaveSlotServiceDeps): void {
  ipcMain.handle(scheduleIpc.SCHEDULE_IPC_CHANNELS.generate, async (_e, raw: unknown) => {
    try {
      const req = scheduleIpc.GenerateScheduleRequest.parse(raw);
      const dbPath = await findSlotDbPathById(deps, req.slotId);
      if (!dbPath) {
        return {
          ok: false as const,
          error: { code: 'NOT_FOUND' as const, message: `slot ${req.slotId} not found` },
        };
      }
      const result = await generateAndPersistSchedule({
        dbPath,
        seasonYear: req.seasonYear,
        seed: req.seed,
      });
      return { ok: true as const, stats: result.stats };
    } catch (err) {
      return toIpcError(err);
    }
  });

  ipcMain.handle(scheduleIpc.SCHEDULE_IPC_CHANNELS.listForTeam, async (_e, raw: unknown) => {
    try {
      const req = scheduleIpc.ListTeamScheduleRequest.parse(raw);
      const dbPath = await findSlotDbPathById(deps, req.slotId);
      if (!dbPath) {
        return {
          ok: false as const,
          error: { code: 'NOT_FOUND' as const, message: `slot ${req.slotId} not found` },
        };
      }
      const client = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });
      try {
        const rows = await client.match.findMany({
          where: {
            OR: [{ homeTeamId: req.teamId }, { awayTeamId: req.teamId }],
          },
          orderBy: [{ date: 'asc' }],
          include: { homeTeam: true, awayTeam: true },
        });
        return {
          ok: true as const,
          rows: rows.map((m) => {
            const isHome = m.homeTeamId === req.teamId;
            const opp = isHome ? m.awayTeam : m.homeTeam;
            return {
              matchId: m.id,
              weekIndex: m.week,
              isoDate: m.date.toISOString().slice(0, 10),
              opponentId: opp.id,
              opponentSchool: opp.schoolName,
              opponentAbbr: opp.abbr,
              isHome,
              isConference: m.isConference,
              isTournament: m.isTournament,
              isNeutralSite: m.isNeutralSite,
              winnerId: m.winnerId,
            };
          }),
        };
      } finally {
        await client.$disconnect();
      }
    } catch (err) {
      return toIpcError(err);
    }
  });
}
