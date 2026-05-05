// Sprint 13: user-initiated recruiting action. Deducts points from the
// team's weekly budget, creates/updates the RecruitInterest row, returns
// new interest and remaining budget.
//
// Sprint 37 Task 37.2: per-tick interest recompute. The action delta now
// accrues to `earnedPoints` (cumulative); the displayed `interest` is
// recomputed live as `base + earnedPoints` from the recruit's priorities
// × team's attribute levels, so a same-day facilities upgrade reflects
// immediately on the next read.

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

    // Sprint 28: budget pulls from team-staff-scaled total.
    const staff = await client.coach.findMany({
      where: { teamId: input.teamId },
      select: { role: true, ratingRecruit: true },
    });
    const hcRecruit = staff.find((c) => c.role === 'HC')?.ratingRecruit ?? null;
    const ahcRecruit = staff.find((c) => c.role === 'AHC')?.ratingRecruit ?? null;
    const acRecruit = staff.find((c) => c.role === 'AC')?.ratingRecruit ?? null;
    const budgetCalc = recruiting.deriveWeeklyBudget({ hcRecruit, ahcRecruit, acRecruit });

    const budget = await client.recruitingBudget.findUnique({
      where: { teamId_week: { teamId: input.teamId, week } },
    });
    const spent = budget?.pointsSpent ?? 0;
    if (spent + def.cost > budgetCalc.total) {
      return {
        ok: false,
        code: 'INSUFFICIENT_BUDGET',
        message: `Action costs ${def.cost}, only ${budgetCalc.total - spent} remaining.`,
      };
    }

    const existing = await client.recruitInterest.findUnique({
      where: { recruitId_teamId: { recruitId: input.recruitId, teamId: input.teamId } },
    });
    const currentEarnedPoints = existing?.earnedPoints ?? 0;
    // Action delta accrues to earnedPoints; SCOUT is a no-op interest-wise.
    const newEarnedPoints = def.scoutOnly
      ? currentEarnedPoints
      : Math.max(0, Math.min(recruiting.MAX_INTEREST, currentEarnedPoints + def.delta));

    // Sprint 37: recompute live BASE from current priorities × levels.
    const team = await client.team.findUnique({
      where: { id: input.teamId },
      select: { prestige: true, region: true, facilitiesLevel: true, academicsLevel: true },
    });
    const hcRecruitRating = hcRecruit ?? 50;
    const priorities = recruit.prioritiesJson
      ? (JSON.parse(recruit.prioritiesJson) as recruiting.RecruitPriorities)
      : undefined;
    const liveBase = team
      ? recruiting.computeRecruitTeamInterestScaled(
          {
            stars: recruit.stars as 1 | 2 | 3 | 4 | 5,
            hometownRegion: recruit.hometownRegion ?? 'CENTRAL',
          },
          {
            teamId: input.teamId,
            prestige: team.prestige,
            region: team.region,
            coachRatingRecruit: hcRecruitRating,
            commitsAtPosition: 0,
          },
          {
            ...(priorities && { priorities }),
            wantsToLeaveHome: recruit.wantsToLeaveHome,
            facilitiesLevel: team.facilitiesLevel,
            academicsLevel: team.academicsLevel,
          },
        )
      : 0;
    const newInterest = Math.max(
      0,
      Math.min(recruiting.MAX_INTEREST, liveBase + newEarnedPoints),
    );
    const currentScoutLevel = existing?.scoutLevel ?? 0;
    const newScoutLevel =
      input.action === 'SCOUT' ? Math.min(3, currentScoutLevel + 1) : currentScoutLevel;

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
            earnedPoints: newEarnedPoints,
            actionsSpent: 1,
            scoutLevel: newScoutLevel,
          },
          update: {
            interest: newInterest,
            earnedPoints: newEarnedPoints,
            actionsSpent: (existing?.actionsSpent ?? 0) + 1,
            scoutLevel: newScoutLevel,
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
      budgetRemaining: budgetCalc.total - (spent + def.cost),
      week,
    };
  } finally {
    await client.$disconnect();
  }
}
