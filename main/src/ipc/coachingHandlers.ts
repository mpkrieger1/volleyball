import { ipcMain } from 'electron';
import { PrismaClient } from '@prisma/client';
import { coachingIpc } from '@vcd/shared';
import { findSlotDbPathById, type SaveSlotServiceDeps } from '../saveSlots/service';
import { hireCoach } from '../coaching/hireCoach';
import { fireCoach } from '../coaching/fireCoach';

export function registerCoachingHandlers(deps: SaveSlotServiceDeps): void {
  ipcMain.handle(coachingIpc.COACHING_IPC_CHANNELS.listStaff, async (_e, raw: unknown) => {
    try {
      const req = coachingIpc.ListStaffRequest.parse(raw);
      const dbPath = await findSlotDbPathById(deps, req.slotId);
      if (!dbPath) {
        return {
          ok: false as const,
          error: { code: 'NOT_FOUND' as const, message: `slot ${req.slotId} not found` },
        };
      }
      const client = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });
      try {
        const [coaches, team] = await Promise.all([
          client.coach.findMany({
            where: { teamId: req.teamId },
            orderBy: { role: 'asc' },
          }),
          client.team.findUnique({ where: { id: req.teamId } }),
        ]);
        if (!team) {
          return {
            ok: false as const,
            error: { code: 'NOT_FOUND' as const, message: `team ${req.teamId} not found` },
          };
        }
        return {
          ok: true as const,
          operatingBudgetCents: team.operatingBudgetCents,
          staff: coaches.map((c) => ({
            coachId: c.id,
            firstName: c.firstName,
            lastName: c.lastName,
            role: c.role as 'HC' | 'AHC' | 'AC',
            contractYears: c.contractYears,
            salaryCents: c.salary,
            ratingRecruit: c.ratingRecruit,
            ratingDevelop: c.ratingDevelop,
            ratingStrategy: c.ratingStrategy,
            hireSeason: c.hireSeason,
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

  ipcMain.handle(coachingIpc.COACHING_IPC_CHANNELS.listPool, async (_e, raw: unknown) => {
    try {
      const req = coachingIpc.ListPoolRequest.parse(raw);
      const dbPath = await findSlotDbPathById(deps, req.slotId);
      if (!dbPath) {
        return {
          ok: false as const,
          error: { code: 'NOT_FOUND' as const, message: `slot ${req.slotId} not found` },
        };
      }
      const client = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });
      try {
        const pool = await client.coachingPool.findMany({
          orderBy: { askingSalaryCents: 'desc' },
        });
        return {
          ok: true as const,
          pool: pool.map((p) => ({
            poolId: p.id,
            firstName: p.firstName,
            lastName: p.lastName,
            preferredRole: p.preferredRole as 'HC' | 'AHC' | 'AC',
            askingSalaryCents: p.askingSalaryCents,
            ratingRecruit: p.ratingRecruit,
            ratingDevelop: p.ratingDevelop,
            ratingStrategy: p.ratingStrategy,
            ageYears: p.ageYears,
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

  ipcMain.handle(coachingIpc.COACHING_IPC_CHANNELS.hire, async (_e, raw: unknown) => {
    try {
      const req = coachingIpc.HireRequest.parse(raw);
      const dbPath = await findSlotDbPathById(deps, req.slotId);
      if (!dbPath) {
        return {
          ok: false as const,
          error: { code: 'NOT_FOUND' as const, message: `slot ${req.slotId} not found` },
        };
      }
      const r = await hireCoach({
        dbPath,
        teamId: req.teamId,
        poolId: req.poolId,
        role: req.role,
        contractYears: req.contractYears,
        salaryCents: req.salaryCents,
      });
      return { ok: true as const, coachId: r.coachId, replacedCoachId: r.replacedCoachId };
    } catch (err) {
      return {
        ok: false as const,
        error: { code: 'INTERNAL' as const, message: (err as Error).message },
      };
    }
  });

  ipcMain.handle(coachingIpc.COACHING_IPC_CHANNELS.fire, async (_e, raw: unknown) => {
    try {
      const req = coachingIpc.FireRequest.parse(raw);
      const dbPath = await findSlotDbPathById(deps, req.slotId);
      if (!dbPath) {
        return {
          ok: false as const,
          error: { code: 'NOT_FOUND' as const, message: `slot ${req.slotId} not found` },
        };
      }
      const r = await fireCoach({ dbPath, teamId: req.teamId, coachId: req.coachId });
      return {
        ok: true as const,
        buyoutCents: r.buyoutCents,
        newBudgetCents: r.newBudgetCents,
        backfilledCoachId: r.backfilledCoachId,
      };
    } catch (err) {
      const msg = (err as Error).message;
      const code = msg.startsWith('INSUFFICIENT_BUDGET')
        ? ('INSUFFICIENT_BUDGET' as const)
        : ('INTERNAL' as const);
      return { ok: false as const, error: { code, message: msg } };
    }
  });
}
