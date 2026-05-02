import { ipcMain } from 'electron';
import { PrismaClient } from '@prisma/client';
import { recruiting, recruitingIpc } from '@vcd/shared';
import { findSlotDbPathById, type SaveSlotServiceDeps } from '../saveSlots/service';
import { openRecruitingCycle } from '../recruiting/openRecruitingCycle';
import { performAction } from '../recruiting/performAction';
import { advanceRecruitingWeek } from '../recruiting/advanceRecruitingWeek';
import { closeRecruitingCycle } from '../recruiting/closeRecruitingCycle';

export function registerRecruitingHandlers(deps: SaveSlotServiceDeps): void {
  ipcMain.handle(recruitingIpc.RECRUITING_IPC_CHANNELS.open, async (_e, raw: unknown) => {
    try {
      const req = recruitingIpc.OpenCycleRequest.parse(raw);
      const dbPath = await findSlotDbPathById(deps, req.slotId);
      if (!dbPath) {
        return {
          ok: false as const,
          error: { code: 'NOT_FOUND' as const, message: `slot ${req.slotId} not found` },
        };
      }
      const result = await openRecruitingCycle({
        dbPath,
        seasonYear: req.seasonYear,
        ...(req.classSize ? { classSize: req.classSize } : {}),
      });
      return {
        ok: true as const,
        recruitsCreated: result.recruitsCreated,
        interestsSeeded: result.interestsSeeded,
      };
    } catch (err) {
      return {
        ok: false as const,
        error: { code: 'INTERNAL' as const, message: (err as Error).message },
      };
    }
  });

  ipcMain.handle(recruitingIpc.RECRUITING_IPC_CHANNELS.action, async (_e, raw: unknown) => {
    try {
      const req = recruitingIpc.ActionRequest.parse(raw);
      const dbPath = await findSlotDbPathById(deps, req.slotId);
      if (!dbPath) {
        return {
          ok: false as const,
          error: { code: 'NOT_FOUND' as const, message: `slot ${req.slotId} not found` },
        };
      }
      const result = await performAction({
        dbPath,
        teamId: req.teamId,
        recruitId: req.recruitId,
        action: req.action,
      });
      if (!result.ok) {
        return { ok: false as const, error: { code: result.code, message: result.message } };
      }
      return {
        ok: true as const,
        newInterest: result.newInterest,
        budgetRemaining: result.budgetRemaining,
        week: result.week,
      };
    } catch (err) {
      return {
        ok: false as const,
        error: { code: 'INTERNAL' as const, message: (err as Error).message },
      };
    }
  });

  ipcMain.handle(recruitingIpc.RECRUITING_IPC_CHANNELS.advance, async (_e, raw: unknown) => {
    try {
      const req = recruitingIpc.AdvanceRequest.parse(raw);
      const dbPath = await findSlotDbPathById(deps, req.slotId);
      if (!dbPath) {
        return {
          ok: false as const,
          error: { code: 'NOT_FOUND' as const, message: `slot ${req.slotId} not found` },
        };
      }
      const result = await advanceRecruitingWeek({
        dbPath,
        userTeamId: req.userTeamId ?? null,
      });
      return {
        ok: true as const,
        week: result.week,
        aiActionsApplied: result.aiActionsApplied,
        commitsResolved: result.commitsResolved,
      };
    } catch (err) {
      return {
        ok: false as const,
        error: { code: 'INTERNAL' as const, message: (err as Error).message },
      };
    }
  });

  ipcMain.handle(recruitingIpc.RECRUITING_IPC_CHANNELS.close, async (_e, raw: unknown) => {
    try {
      const req = recruitingIpc.CloseRequest.parse(raw);
      const dbPath = await findSlotDbPathById(deps, req.slotId);
      if (!dbPath) {
        return {
          ok: false as const,
          error: { code: 'NOT_FOUND' as const, message: `slot ${req.slotId} not found` },
        };
      }
      const result = await closeRecruitingCycle({ dbPath });
      return { ok: true as const, uncommittedCount: result.uncommittedCount };
    } catch (err) {
      return {
        ok: false as const,
        error: { code: 'INTERNAL' as const, message: (err as Error).message },
      };
    }
  });

  ipcMain.handle(recruitingIpc.RECRUITING_IPC_CHANNELS.state, async (_e, raw: unknown) => {
    try {
      const req = recruitingIpc.StateRequest.parse(raw);
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
        const week = season.recruitingWeek;
        const budget = await client.recruitingBudget.findUnique({
          where: { teamId_week: { teamId: req.teamId, week } },
        });
        const budgetRemaining = recruiting.WEEKLY_BUDGET - (budget?.pointsSpent ?? 0);
        // Board = recruits with a RecruitInterest row for this team, or
        // any PENDING recruit (so user can discover new prospects).
        // Sprint 21: raised limit from 200 to 3000 (full DEFAULT_CLASS_SIZE)
        // so the renderer's filter/sort can operate on the entire pool.
        // PRD §5 Sprint 21 exit test 3: 1000-prospect filter/sort < 500ms.
        // Recruit indexes on (position, stars, seasonYear) added in
        // migration 20260824_000000_recruit_perf_indexes.
        const interests = await client.recruitInterest.findMany({
          where: { teamId: req.teamId },
          include: { recruit: true },
          orderBy: [{ interest: 'desc' }],
          take: 3000,
        });
        return {
          ok: true as const,
          phase: season.phase,
          week,
          budgetRemaining,
          recruits: interests.map((i) => ({
            recruitId: i.recruit.id,
            firstName: i.recruit.firstName,
            lastName: i.recruit.lastName,
            position: i.recruit.position,
            stars: i.recruit.stars,
            height: i.recruit.height,
            hometownCity: i.recruit.hometownCity,
            hometownState: i.recruit.hometownState,
            hometownRegion: i.recruit.hometownRegion,
            commitState: i.recruit.commitState,
            commitTeamId: i.recruit.commitTeamId,
            interest: i.interest,
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
