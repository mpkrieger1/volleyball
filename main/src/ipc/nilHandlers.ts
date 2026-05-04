import { ipcMain } from 'electron';
import { PrismaClient } from '@prisma/client';
import { nilIpc, nil } from '@vcd/shared';
import { findSlotDbPathById, type SaveSlotServiceDeps } from '../saveSlots/service';
import { assignNil } from '../nil/assignNil';
import { revokeNil } from '../nil/revokeNil';
import { autoDistributeNil } from '../nil/autoDistributeNil';
import { getNilState } from '../nil/getNilState';

/**
 * Sprint 28: read the current Season.phase. NIL operations are gated
 * server-side: assign / revoke / autoDistribute reject during in-season
 * phases (REGULAR / CONF_TOURNEY / NCAA / etc).
 */
async function readSeasonPhase(dbPath: string): Promise<string> {
  const client = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });
  try {
    const season = await client.season.findFirst({ orderBy: { year: 'desc' } });
    return season?.phase ?? 'PRESEASON';
  } finally {
    await client.$disconnect();
  }
}

export function registerNilHandlers(deps: SaveSlotServiceDeps): void {
  ipcMain.handle(nilIpc.NIL_IPC_CHANNELS.state, async (_e, raw: unknown) => {
    try {
      const req = nilIpc.StateRequest.parse(raw);
      const dbPath = await findSlotDbPathById(deps, req.slotId);
      if (!dbPath) {
        return {
          ok: false as const,
          error: { code: 'NOT_FOUND' as const, message: `slot ${req.slotId} not found` },
        };
      }
      const r = await getNilState({ dbPath, teamId: req.teamId });
      if (!r.ok) return { ok: false as const, error: { code: r.code, message: r.message } };
      const phase = await readSeasonPhase(dbPath);
      return {
        ok: true as const,
        collectiveBudget: r.collectiveBudget,
        totalSpent: r.totalSpent,
        remaining: r.remaining,
        enthusiasm: r.enthusiasm,
        roster: r.roster,
        phase,
        isOpen: nil.isNilOpen(phase),
      };
    } catch (err) {
      return {
        ok: false as const,
        error: { code: 'INTERNAL' as const, message: (err as Error).message },
      };
    }
  });

  ipcMain.handle(nilIpc.NIL_IPC_CHANNELS.assign, async (_e, raw: unknown) => {
    try {
      const req = nilIpc.AssignRequest.parse(raw);
      const dbPath = await findSlotDbPathById(deps, req.slotId);
      if (!dbPath) {
        return {
          ok: false as const,
          error: { code: 'NOT_FOUND' as const, message: `slot ${req.slotId} not found` },
        };
      }
      const phase = await readSeasonPhase(dbPath);
      if (!nil.isNilOpen(phase)) {
        return {
          ok: false as const,
          error: {
            code: 'NIL_CLOSED' as const,
            message: `NIL is closed during ${phase}. It opens at the start of the offseason.`,
          },
        };
      }
      const r = await assignNil({
        dbPath,
        teamId: req.teamId,
        playerId: req.playerId,
        amountCents: req.amountCents,
      });
      if (!r.ok) return { ok: false as const, error: { code: r.code, message: r.message } };
      return {
        ok: true as const,
        newTotalSpent: r.newTotalSpent,
        remaining: r.remaining,
        playerValueCents: r.playerValueCents,
      };
    } catch (err) {
      return {
        ok: false as const,
        error: { code: 'INTERNAL' as const, message: (err as Error).message },
      };
    }
  });

  ipcMain.handle(nilIpc.NIL_IPC_CHANNELS.revoke, async (_e, raw: unknown) => {
    try {
      const req = nilIpc.RevokeRequest.parse(raw);
      const dbPath = await findSlotDbPathById(deps, req.slotId);
      if (!dbPath) {
        return {
          ok: false as const,
          error: { code: 'NOT_FOUND' as const, message: `slot ${req.slotId} not found` },
        };
      }
      const phase = await readSeasonPhase(dbPath);
      if (!nil.isNilOpen(phase)) {
        return {
          ok: false as const,
          error: {
            code: 'NIL_CLOSED' as const,
            message: `NIL is closed during ${phase}. It opens at the start of the offseason.`,
          },
        };
      }
      const r = await revokeNil({
        dbPath,
        teamId: req.teamId,
        playerId: req.playerId,
      });
      if (!r.ok) return { ok: false as const, error: { code: r.code, message: r.message } };
      return { ok: true as const, removed: r.removed };
    } catch (err) {
      return {
        ok: false as const,
        error: { code: 'INTERNAL' as const, message: (err as Error).message },
      };
    }
  });

  ipcMain.handle(nilIpc.NIL_IPC_CHANNELS.autoDistribute, async (_e, raw: unknown) => {
    try {
      const req = nilIpc.AutoDistributeRequest.parse(raw);
      const dbPath = await findSlotDbPathById(deps, req.slotId);
      if (!dbPath) {
        return {
          ok: false as const,
          error: { code: 'NOT_FOUND' as const, message: `slot ${req.slotId} not found` },
        };
      }
      const phase = await readSeasonPhase(dbPath);
      if (!nil.isNilOpen(phase)) {
        return {
          ok: false as const,
          error: {
            code: 'NIL_CLOSED' as const,
            message: `NIL is closed during ${phase}. It opens at the start of the offseason.`,
          },
        };
      }
      const r = await autoDistributeNil({ dbPath, teamId: req.teamId });
      if (!r.ok) return { ok: false as const, error: { code: r.code, message: r.message } };
      return {
        ok: true as const,
        dealsCreated: r.dealsCreated,
        totalSpent: r.totalSpent,
      };
    } catch (err) {
      return {
        ok: false as const,
        error: { code: 'INTERNAL' as const, message: (err as Error).message },
      };
    }
  });
}
