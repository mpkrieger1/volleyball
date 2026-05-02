// Sprint 17: hire a coach from the CoachingPool into a team's staff slot.
// If the team already has a coach in that role, the existing coach is
// removed (teamId=null) without a buyout (use fireCoach for buyouts).

import { PrismaClient } from '@prisma/client';

export type HireCoachInput = {
  dbPath: string;
  teamId: string;
  poolId: string;
  role: 'HC' | 'AHC' | 'AC';
  contractYears: number;
  salaryCents: number;
};

export type HireCoachResult = {
  coachId: string;
  replacedCoachId: string | null;
};

export async function hireCoach(input: HireCoachInput): Promise<HireCoachResult> {
  const client = new PrismaClient({ datasources: { db: { url: `file:${input.dbPath}` } } });
  try {
    const [team, candidate, season] = await Promise.all([
      client.team.findUnique({ where: { id: input.teamId } }),
      client.coachingPool.findUnique({ where: { id: input.poolId } }),
      client.season.findFirst({ orderBy: { year: 'desc' } }),
    ]);
    if (!team) throw new Error(`Team ${input.teamId} not found`);
    if (!candidate) throw new Error(`Pool candidate ${input.poolId} not found`);
    if (!season) throw new Error('No Season row');

    const existing = await client.coach.findFirst({
      where: { teamId: input.teamId, role: input.role },
    });

    const result = await client.$transaction(async (tx) => {
      let replacedCoachId: string | null = null;
      if (existing) {
        await tx.coach.update({
          where: { id: existing.id },
          data: { teamId: null },
        });
        replacedCoachId = existing.id;
      }
      const created = await tx.coach.create({
        data: {
          firstName: candidate.firstName,
          lastName: candidate.lastName,
          role: input.role,
          teamId: input.teamId,
          contractYears: input.contractYears,
          salary: input.salaryCents,
          ratingRecruit: candidate.ratingRecruit,
          ratingDevelop: candidate.ratingDevelop,
          ratingStrategy: candidate.ratingStrategy,
          hireSeason: season.year,
        },
      });
      await tx.coachingPool.delete({ where: { id: input.poolId } });
      return { coachId: created.id, replacedCoachId };
    });

    return result;
  } finally {
    await client.$disconnect();
  }
}
