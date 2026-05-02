import { ipcMain } from 'electron';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { seasonIpc } from '@vcd/shared';
import { findSlotDbPathById, type SaveSlotServiceDeps } from '../saveSlots/service';
import { advanceWeek } from '../season/advanceWeek';
import { CancellationToken } from '../season/cancellationToken';
import { getOrCreatePool, disposeAllPools } from '../season/poolRegistry';
import { getUserTeam, setUserTeam } from '../season/userTeam';

// cancellationId → token
const tokens = new Map<string, CancellationToken>();

export async function disposeAllSeasonPools(): Promise<void> {
  await disposeAllPools();
  tokens.clear();
}

export function registerSeasonHandlers(deps: SaveSlotServiceDeps): void {
  ipcMain.handle(seasonIpc.SEASON_IPC_CHANNELS.advanceWeek, async (event, raw: unknown) => {
    try {
      const req = seasonIpc.AdvanceWeekRequest.parse(raw);
      const dbPath = await findSlotDbPathById(deps, req.slotId);
      if (!dbPath) {
        return {
          ok: false as const,
          error: { code: 'NOT_FOUND' as const, message: `slot ${req.slotId} not found` },
        };
      }
      const pool = getOrCreatePool(deps, req.slotId);
      const token = new CancellationToken();
      const cancellationId = req.cancellationId ?? `adv-${randomUUID()}`;
      tokens.set(cancellationId, token);
      try {
        const result = await advanceWeek({
          dbPath,
          pool,
          cancellation: token,
          onProgress: (evt) => {
            event.sender.send(seasonIpc.SEASON_IPC_CHANNELS.progress, {
              ...evt,
              cancellationId,
            } satisfies seasonIpc.SeasonProgressEvent);
          },
        });
        if (!result.ok) {
          return {
            ok: false as const,
            error: { code: result.code, message: result.message },
          };
        }
        return {
          ok: true as const,
          week: result.week,
          matchesPlayed: result.matchesPlayed,
          elapsedMs: result.elapsedMs,
        };
      } finally {
        tokens.delete(cancellationId);
      }
    } catch (err) {
      return {
        ok: false as const,
        error: { code: 'INTERNAL' as const, message: (err as Error).message },
      };
    }
  });

  ipcMain.handle(seasonIpc.SEASON_IPC_CHANNELS.cancel, async (_e, raw: unknown) => {
    try {
      const req = seasonIpc.CancelAdvanceRequest.parse(raw);
      const token = tokens.get(req.cancellationId);
      if (token) token.cancel();
      return { ok: true as const, cancelled: !!token };
    } catch (err) {
      return {
        ok: false as const,
        error: { code: 'INTERNAL' as const, message: (err as Error).message },
      };
    }
  });

  ipcMain.handle(seasonIpc.SEASON_IPC_CHANNELS.getCurrentWeek, async (_e, raw: unknown) => {
    try {
      const req = seasonIpc.GetCurrentWeekRequest.parse(raw);
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
        return {
          ok: true as const,
          currentWeek: season.currentWeek,
          phase: season.phase,
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

  ipcMain.handle(seasonIpc.SEASON_IPC_CHANNELS.getUserTeam, async (_e, raw: unknown) => {
    try {
      const req = seasonIpc.GetUserTeamRequest.parse(raw);
      const dbPath = await findSlotDbPathById(deps, req.slotId);
      if (!dbPath) {
        return {
          ok: false as const,
          error: { code: 'NOT_FOUND' as const, message: `slot ${req.slotId} not found` },
        };
      }
      const client = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });
      try {
        const result = await getUserTeam(client);
        if (!result) {
          return {
            ok: false as const,
            error: { code: 'NOT_FOUND' as const, message: 'No Season row.' },
          };
        }
        return { ok: true as const, userTeamId: result.userTeamId };
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

  ipcMain.handle(seasonIpc.SEASON_IPC_CHANNELS.setUserTeam, async (_e, raw: unknown) => {
    try {
      const req = seasonIpc.SetUserTeamRequest.parse(raw);
      const dbPath = await findSlotDbPathById(deps, req.slotId);
      if (!dbPath) {
        return {
          ok: false as const,
          error: { code: 'NOT_FOUND' as const, message: `slot ${req.slotId} not found` },
        };
      }
      const client = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });
      try {
        const result = await setUserTeam(client, req.teamId);
        if ('error' in result) {
          return {
            ok: false as const,
            error: { code: 'NOT_FOUND' as const, message: result.error },
          };
        }
        return { ok: true as const, userTeamId: result.userTeamId };
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
