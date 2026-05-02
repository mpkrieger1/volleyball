// Sprint 13: user-initiated recruiting action. Deducts points from the
// team's weekly budget, creates/updates the RecruitInterest row, returns
// new interest and remaining budget.

import { PrismaClient } from '@prisma/client';
import { recruiting } from '@vcd/shared';

export type PerformActionInput = {
  dbPath: string;
  teamId: string;
  recruitId: string;
  action: recruiting.RecruitingActionType;
};

export type PerformActionResult =
  | {
      ok: true;
      newInterest: number;
      budgetRemaining: number;
      week: number;
    }
  | { ok: false; code: 'INSUFFICIENT_BUDGET' | 'RECRUIT_NOT_PENDING' | 'NOT_RECRUITING'; message: string };

export async function performAction(
  input: PerformActionInput,
): Promise<PerformActionResult> {
  const client = new PrismaClient({ datasources: { db: { url: `file:${input.dbPath}` } } });
  try {
    const season = await client.season.findFirst({ orderBy: { year: 'desc' } });
    if (!season || season.phase !== 'RECRUITING') {
      return { ok: false, code: 'NOT_RECRUITING', message: 'No active recruiting cycle.' };
    }
    const week = season.recruitingWeek;
    const recruit = await client.recruit.findUnique({ where: { id: input.recruitId } });
    if (!recruit) {
      return { ok: false, code: 'RECRUIT_NOT_PENDING', message: 'Recruit not found.' };
    }
    if (recruit.commitState !== 'PENDING') {
      return {
        ok: false,
        code: 'RECRUIT_NOT_PENDING',
        message: `Recruit already ${recruit.commitState}.`,
      };
    }

    const def = recruiting.RECRUITING_ACTIONS[input.action];
    const budget = await client.recruitingBudget.findUnique({
      where: { teamId_week: { teamId: input.teamId, week } },
    });
    const spent = budget?.pointsSpent ?? 0;
    if (spent + def.cost > recruiting.WEEKLY_BUDGET) {
      return {
        ok: false,
        code: 'INSUFFICIENT_BUDGET',
        message: `Action costs ${def.cost}, only ${recruiting.WEEKLY_BUDGET - spent} remaining.`,
      };
    }

    const existing = await client.recruitInterest.findUnique({
      where: { recruitId_teamId: { recruitId: input.recruitId, teamId: input.teamId } },
    });
    const currentInterest = existing?.interest ?? 0;
    const newInterest = recruiting.applyActionDelta(currentInterest, input.action);

    await client.$transaction(
      async (tx) => {
        await tx.recruitInterest.upsert({
          where: {
            recruitId_teamId: { recruitId: input.recruitId, teamId: input.teamId },
          },
          create: {
            recruitId: input.recruitId,
            teamId: input.teamId,
            interest: newInterest,
            actionsSpent: 1,
          },
          update: {
            interest: newInterest,
            actionsSpent: (existing?.actionsSpent ?? 0) + 1,
          },
        });
        await tx.recruitingBudget.upsert({
          where: { teamId_week: { teamId: input.teamId, week } },
          create: {
            teamId: input.teamId,
            week,
            pointsSpent: def.cost,
          },
          update: {
            pointsSpent: spent + def.cost,
          },
        });
      },
      { maxWait: 5_000, timeout: 15_000 },
    );

    return {
      ok: true,
      newInterest,
      budgetRemaining: recruiting.WEEKLY_BUDGET - (spent + def.cost),
      week,
    };
  } finally {
    await client.$disconnect();
  }
}
