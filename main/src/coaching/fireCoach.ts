// Sprint 17: fire a coach. Mid-contract firings trigger a buyout debited
// from Team.operatingBudgetCents.
//
// Buyout = remainingYears × salary × BUYOUT_FACTOR
//   remainingYears = max(0, contractYears - (currentSeason - hireSeason))
//
// If the fired coach is the HC, auto-backfill from the best-available
// CoachingPool candidate before returning so the "every team has an HC"
// invariant holds immediately after firing.

import { PrismaClient } from '@prisma/client';
import { hireCoach } from './hireCoach';

export const BUYOUT_FACTOR = 0.5;

export type FireCoachInput = {
  dbPath: string;
  teamId: string;
  coachId: string;
};

export type FireCoachResult = {
  buyoutCents: number;
  newBudgetCents: number;
  backfilledCoachId: string | null;
};

export async function fireCoach(input: FireCoachInput): Promise<FireCoachResult> {
  const client = new PrismaClient({ datasources: { db: { url: `file:${input.dbPath}` } } });
  try {
    const [team, coach, season] = await Promise.all([
      client.team.findUnique({ where: { id: input.teamId } }),
      client.coach.findUnique({ where: { id: input.coachId } }),
      client.season.findFirst({ orderBy: { year: 'desc' } }),
    ]);
    if (!team) throw new Error(`Team ${input.teamId} not found`);
    if (!coach) throw new Error(`Coach ${input.coachId} not found`);
    if (coach.teamId !== input.teamId) throw new Error(`Coach not on team ${input.teamId}`);
    if (!season) throw new Error('No Season row');

    const yearsElapsed = Math.max(0, season.year - coach.hireSeason);
    const remainingYears = Math.max(0, coach.contractYears - yearsElapsed);
    const buyoutCents = Math.round(remainingYears * coach.salary * BUYOUT_FACTOR);

    if (team.operatingBudgetCents < buyoutCents) {
      throw new Error(
        `INSUFFICIENT_BUDGET: budget=${team.operatingBudgetCents} buyout=${buyoutCents}`,
      );
    }

    const newBudgetCents = team.operatingBudgetCents - buyoutCents;
    const firedRole = coach.role;

    await client.$transaction([
      client.coachBuyout.create({
        data: {
          coachId: coach.id,
          teamId: input.teamId,
          amountCents: buyoutCents,
          seasonYear: season.year,
        },
      }),
      client.coach.update({
        where: { id: coach.id },
        data: { teamId: null },
      }),
      client.team.update({
        where: { id: input.teamId },
        data: { operatingBudgetCents: newBudgetCents },
      }),
    ]);

    // Auto-backfill HC vacancy.
    let backfilledCoachId: string | null = null;
    if (firedRole === 'HC') {
      backfilledCoachId = await autoBackfillHC(client, input.dbPath, input.teamId);
    }

    return { buyoutCents, newBudgetCents, backfilledCoachId };
  } finally {
    await client.$disconnect();
  }
}

/**
 * Pick the highest-overall available candidate from CoachingPool and
 * hire them as HC at their asking salary + default 3-year contract.
 * If the pool is empty, promote this team's AHC (if any).
 */
async function autoBackfillHC(
  client: PrismaClient,
  dbPath: string,
  teamId: string,
): Promise<string | null> {
  const candidates = await client.coachingPool.findMany();
  if (candidates.length > 0) {
    // Sort by max(recruit, develop, strategy) desc.
    const ranked = candidates
      .map((c) => ({
        ...c,
        overall: Math.max(c.ratingRecruit, c.ratingDevelop, c.ratingStrategy),
      }))
      .sort((a, b) => b.overall - a.overall);
    const best = ranked[0]!;
    const hired = await hireCoach({
      dbPath,
      teamId,
      poolId: best.id,
      role: 'HC',
      contractYears: 3,
      salaryCents: best.askingSalaryCents,
    });
    return hired.coachId;
  }
  // Fallback: promote AHC to HC.
  const ahc = await client.coach.findFirst({
    where: { teamId, role: 'AHC' },
  });
  if (ahc) {
    await client.coach.update({
      where: { id: ahc.id },
      data: { role: 'HC' },
    });
    return ahc.id;
  }
  return null;
}
