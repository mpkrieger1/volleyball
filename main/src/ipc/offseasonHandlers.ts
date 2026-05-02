import { ipcMain } from 'electron';
import { PrismaClient } from '@prisma/client';
import { offseasonIpc } from '@vcd/shared';
import { findSlotDbPathById, type SaveSlotServiceDeps } from '../saveSlots/service';
import { runOffseason } from '../offseason/runOffseason';
import { startRegular } from '../season/startRegular';

export function registerOffseasonHandlers(deps: SaveSlotServiceDeps): void {
  ipcMain.handle(offseasonIpc.OFFSEASON_IPC_CHANNELS.run, async (_e, raw: unknown) => {
    try {
      const req = offseasonIpc.RunRequest.parse(raw);
      const dbPath = await findSlotDbPathById(deps, req.slotId);
      if (!dbPath) {
        return {
          ok: false as const,
          error: { code: 'NOT_FOUND' as const, message: `slot ${req.slotId} not found` },
        };
      }
      const r = await runOffseason({ dbPath });
      return {
        ok: true as const,
        playersGraduated: r.playersGraduated,
        playersCut: r.playersCut,
        teamsUpdated: r.teamsUpdated,
        newSeasonYear: r.newSeasonYear,
      };
    } catch (err) {
      return {
        ok: false as const,
        error: { code: 'INTERNAL' as const, message: (err as Error).message },
      };
    }
  });

  ipcMain.handle(offseasonIpc.OFFSEASON_IPC_CHANNELS.toggleRedshirt, async (_e, raw: unknown) => {
    try {
      const req = offseasonIpc.ToggleRedshirtRequest.parse(raw);
      const dbPath = await findSlotDbPathById(deps, req.slotId);
      if (!dbPath) {
        return {
          ok: false as const,
          error: { code: 'NOT_FOUND' as const, message: `slot ${req.slotId} not found` },
        };
      }
      const client = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });
      try {
        const player = await client.player.findUnique({ where: { id: req.playerId } });
        if (!player || player.teamId !== req.teamId) {
          return {
            ok: false as const,
            error: { code: 'PLAYER_NOT_ON_TEAM' as const, message: 'Player not on team.' },
          };
        }
        if (player.redshirtLocked) {
          return {
            ok: false as const,
            error: {
              code: 'REDSHIRT_LOCKED' as const,
              message: 'Redshirt locked for this season (player has played).',
            },
          };
        }
        await client.player.update({
          where: { id: req.playerId },
          data: { redshirtUsed: req.redshirtUsed },
        });
        return { ok: true as const, redshirtUsed: req.redshirtUsed };
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

  ipcMain.handle(offseasonIpc.OFFSEASON_IPC_CHANNELS.preseasonState, async (_e, raw: unknown) => {
    try {
      const req = offseasonIpc.PreseasonStateRequest.parse(raw);
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
            error: { code: 'NO_SEASON' as const, message: 'No Season row.' },
          };
        }
        const players = await client.player.findMany({
          where: { teamId: req.teamId },
          orderBy: [{ position: 'asc' }, { lastName: 'asc' }],
        });
        const roster = players.map((p) => ({
          playerId: p.id,
          firstName: p.firstName,
          lastName: p.lastName,
          position: p.position,
          classYear: p.classYear,
          overall: Math.round(
            (p.ratingAttack +
              p.ratingBlock +
              p.ratingServe +
              p.ratingPass +
              p.ratingSet +
              p.ratingDig +
              p.ratingAthleticism +
              p.ratingIq +
              p.ratingStamina) /
              9,
          ),
          redshirtUsed: p.redshirtUsed,
          redshirtLocked: p.redshirtLocked,
        }));
        return {
          ok: true as const,
          phase: season.phase,
          year: season.year,
          roster,
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

  ipcMain.handle(offseasonIpc.OFFSEASON_IPC_CHANNELS.startRegular, async (_e, raw: unknown) => {
    try {
      const req = offseasonIpc.StartRegularRequest.parse(raw);
      const dbPath = await findSlotDbPathById(deps, req.slotId);
      if (!dbPath) {
        return {
          ok: false as const,
          error: { code: 'NOT_FOUND' as const, message: `slot ${req.slotId} not found` },
        };
      }
      const r = await startRegular({ dbPath });
      if (!r.ok) return { ok: false as const, error: { code: r.code, message: r.message } };
      return { ok: true as const, phase: r.phase, year: r.year };
    } catch (err) {
      return {
        ok: false as const,
        error: { code: 'INTERNAL' as const, message: (err as Error).message },
      };
    }
  });
}
