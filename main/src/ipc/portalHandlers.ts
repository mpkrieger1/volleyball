import { ipcMain } from 'electron';
import { PrismaClient } from '@prisma/client';
import { portal, portalIpc } from '@vcd/shared';
import { findSlotDbPathById, type SaveSlotServiceDeps } from '../saveSlots/service';
import { openPortal } from '../portal/openPortal';
import { performPortalAction } from '../portal/performPortalAction';
import { advancePortalWeek } from '../portal/advancePortalWeek';
import { closePortal } from '../portal/closePortal';
import { ratingsAverage } from '../portal/ratingsAverage';

export function registerPortalHandlers(deps: SaveSlotServiceDeps): void {
  ipcMain.handle(portalIpc.PORTAL_IPC_CHANNELS.open, async (_e, raw: unknown) => {
    try {
      const req = portalIpc.OpenRequest.parse(raw);
      const dbPath = await findSlotDbPathById(deps, req.slotId);
      if (!dbPath) {
        return {
          ok: false as const,
          error: { code: 'NOT_FOUND' as const, message: `slot ${req.slotId} not found` },
        };
      }
      const r = await openPortal({ dbPath });
      return { ok: true as const, entrants: r.entrants, interestsSeeded: r.interestsSeeded };
    } catch (err) {
      return {
        ok: false as const,
        error: { code: 'INTERNAL' as const, message: (err as Error).message },
      };
    }
  });

  ipcMain.handle(portalIpc.PORTAL_IPC_CHANNELS.action, async (_e, raw: unknown) => {
    try {
      const req = portalIpc.ActionRequest.parse(raw);
      const dbPath = await findSlotDbPathById(deps, req.slotId);
      if (!dbPath) {
        return {
          ok: false as const,
          error: { code: 'NOT_FOUND' as const, message: `slot ${req.slotId} not found` },
        };
      }
      const r = await performPortalAction({
        dbPath,
        teamId: req.teamId,
        transferPortalId: req.transferPortalId,
        action: req.action,
        ...(req.nilAmountCents ? { nilAmountCents: req.nilAmountCents } : {}),
      });
      if (!r.ok) return { ok: false as const, error: { code: r.code, message: r.message } };
      return {
        ok: true as const,
        newInterest: r.newInterest,
        budgetRemaining: r.budgetRemaining,
        week: r.week,
      };
    } catch (err) {
      return {
        ok: false as const,
        error: { code: 'INTERNAL' as const, message: (err as Error).message },
      };
    }
  });

  ipcMain.handle(portalIpc.PORTAL_IPC_CHANNELS.advance, async (_e, raw: unknown) => {
    try {
      const req = portalIpc.AdvanceRequest.parse(raw);
      const dbPath = await findSlotDbPathById(deps, req.slotId);
      if (!dbPath) {
        return {
          ok: false as const,
          error: { code: 'NOT_FOUND' as const, message: `slot ${req.slotId} not found` },
        };
      }
      const r = await advancePortalWeek({
        dbPath,
        userTeamId: req.userTeamId ?? null,
      });
      return {
        ok: true as const,
        week: r.week,
        aiActionsApplied: r.aiActionsApplied,
        commitsResolved: r.commitsResolved,
      };
    } catch (err) {
      return {
        ok: false as const,
        error: { code: 'INTERNAL' as const, message: (err as Error).message },
      };
    }
  });

  ipcMain.handle(portalIpc.PORTAL_IPC_CHANNELS.close, async (_e, raw: unknown) => {
    try {
      const req = portalIpc.CloseRequest.parse(raw);
      const dbPath = await findSlotDbPathById(deps, req.slotId);
      if (!dbPath) {
        return {
          ok: false as const,
          error: { code: 'NOT_FOUND' as const, message: `slot ${req.slotId} not found` },
        };
      }
      const r = await closePortal({ dbPath });
      return {
        ok: true as const,
        signedCount: r.signedCount,
        unsignedCount: r.unsignedCount,
        nilDealsCreated: r.nilDealsCreated,
      };
    } catch (err) {
      return {
        ok: false as const,
        error: { code: 'INTERNAL' as const, message: (err as Error).message },
      };
    }
  });

  ipcMain.handle(portalIpc.PORTAL_IPC_CHANNELS.state, async (_e, raw: unknown) => {
    try {
      const req = portalIpc.StateRequest.parse(raw);
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
        const week = season.portalWeek;
        const budget = await client.portalBudget.findUnique({
          where: { teamId_week: { teamId: req.teamId, week } },
        });
        const budgetRemaining = portal.PORTAL_WEEKLY_BUDGET - (budget?.pointsSpent ?? 0);

        const entries = await client.transferPortal.findMany({
          include: { player: true, interests: true },
        });
        const incoming = entries
          .filter((e) => e.status === 'ACTIVE' && e.player.teamId !== req.teamId)
          .map((e) => toView(e, req.teamId));
        const outgoing = entries
          .filter((e) => e.player.teamId === req.teamId)
          .map((e) => toView(e, req.teamId));

        return {
          ok: true as const,
          phase: season.phase,
          week,
          budgetRemaining,
          incoming,
          outgoing,
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

function toView(
  e: {
    id: string;
    status: string;
    player: {
      id: string;
      teamId: string;
      firstName: string;
      lastName: string;
      position: string;
      classYear: string;
      ratingAttack: number;
      ratingBlock: number;
      ratingServe: number;
      ratingPass: number;
      ratingSet: number;
      ratingDig: number;
      ratingAthleticism: number;
      ratingIq: number;
      ratingStamina: number;
    };
    interests: Array<{ teamId: string; interest: number; actionsSpent: number; lastNilOffer: number }>;
  },
  viewerTeamId: string,
): portalIpc.PortalEntryView {
  const mine = e.interests.find((i) => i.teamId === viewerTeamId);
  return {
    transferPortalId: e.id,
    playerId: e.player.id,
    firstName: e.player.firstName,
    lastName: e.player.lastName,
    position: e.player.position,
    classYear: e.player.classYear,
    overall: ratingsAverage(e.player),
    originTeamId: e.player.teamId,
    status: e.status,
    myInterest: mine?.interest ?? 0,
    actionsSpent: mine?.actionsSpent ?? 0,
    lastNilOffer: mine?.lastNilOffer ?? 0,
  };
}
