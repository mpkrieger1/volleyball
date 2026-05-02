// Sprint 19: scout-report IPC handler.

import { ipcMain } from 'electron';
import { PrismaClient } from '@prisma/client';
import { scoutIpc } from '@vcd/shared';
import { findSlotDbPathById, type SaveSlotServiceDeps } from '../saveSlots/service';
import { buildScoutReport } from '../match/scoutReport';

export function registerScoutHandlers(deps: SaveSlotServiceDeps): void {
  ipcMain.handle(scoutIpc.SCOUT_IPC_CHANNELS.scoutReport, async (_e, raw: unknown) => {
    try {
      const req = scoutIpc.ScoutReportRequest.parse(raw);
      const dbPath = await findSlotDbPathById(deps, req.slotId);
      if (!dbPath) {
        return {
          ok: false as const,
          error: { code: 'NOT_FOUND' as const, message: `slot ${req.slotId} not found` },
        };
      }
      const client = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });
      try {
        const result = await buildScoutReport(
          client,
          req.opponentTeamId,
          req.throughDate ? new Date(req.throughDate) : undefined,
        );
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
}
