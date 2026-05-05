// Sprint 33 — COACH_CAROUSEL event handler.
//
// Refresh CoachingPool for next season + fill open slots from the pool +
// final HC backfill safety. Extracted from runOffseason.ts:331-520.
//
// Idempotent: keys on `seasonAvailable === seasonYear + 1` for the pool
// refresh — if a row already exists for the next year, skip the refresh
// (re-run produces the same fills based on remaining unfilled slots).

import type { PrismaClient } from '@prisma/client';
import { createRng, coaching } from '@vcd/shared';

export type CoachCarouselResult = {
  event: 'COACH_CAROUSEL';
  poolGenerated: number;
  filled: number;
  hcBackfilled: number;
};

export async function coachCarousel(
  client: PrismaClient,
  seasonYear: number,
): Promise<CoachCarouselResult> {
  // Idempotency: skip pool refresh if already done for next year.
  const existingPool = await client.coachingPool.count({
    where: { seasonAvailable: seasonYear + 1 },
  });
  let poolGenerated = 0;
  if (existingPool === 0) {
    await client.coachingPool.deleteMany();
    const pool = coaching.generateHiringPool({
      seed: `pool:${seasonYear + 1}`,
      seasonYear: seasonYear + 1,
      size: 100,
    });
    await client.coachingPool.createMany({
      data: pool.map((p) => ({
        firstName: p.firstName,
        lastName: p.lastName,
        ratingRecruit: p.ratingRecruit,
        ratingDevelop: p.ratingDevelop,
        ratingStrategy: p.ratingStrategy,
        askingSalaryCents: p.askingSalaryCents,
        preferredRole: p.preferredRole,
        ageYears: p.ageYears,
        seasonAvailable: p.seasonAvailable,
      })),
    });
    poolGenerated = pool.length;
  }

  // Identify open slots: each team needs HC, AHC, AC.
  const teams = await client.team.findMany({ select: { id: true } });
  const allCoaches = await client.coach.findMany({
    where: { teamId: { not: null } },
    select: { id: true, teamId: true, role: true },
  });
  const filledByTeamRole = new Set<string>();
  for (const c of allCoaches) {
    filledByTeamRole.add(`${c.teamId}:${c.role}`);
  }
  const expectedRoles: Array<'HC' | 'AHC' | 'AC'> = ['HC', 'AHC', 'AC'];
  const openSlots: Array<{ teamId: string; role: 'HC' | 'AHC' | 'AC' }> = [];
  for (const t of teams) {
    for (const role of expectedRoles) {
      if (!filledByTeamRole.has(`${t.id}:${role}`)) {
        openSlots.push({ teamId: t.id, role });
      }
    }
  }

  // Fill from pool.
  const lifecycleRng = createRng(`coach-lifecycle:${seasonYear + 1}`);
  const poolRows = await client.coachingPool.findMany({
    select: {
      id: true,
      ratingRecruit: true,
      ratingDevelop: true,
      ratingStrategy: true,
      preferredRole: true,
      askingSalaryCents: true,
      ageYears: true,
    },
  });
  const fills = coaching.planFills(
    openSlots,
    poolRows.map((p) => ({
      id: p.id,
      ratingRecruit: p.ratingRecruit,
      ratingDevelop: p.ratingDevelop,
      ratingStrategy: p.ratingStrategy,
      preferredRole: p.preferredRole as 'HC' | 'AHC' | 'AC',
      askingSalaryCents: p.askingSalaryCents,
      ageYears: p.ageYears,
    })),
    lifecycleRng.fork('fills'),
  );

  let filled = 0;
  const usedPoolIds: string[] = [];
  for (const f of fills) {
    if (f.kind !== 'fill') continue;
    const poolFull = await client.coachingPool.findUnique({ where: { id: f.fromPoolId } });
    if (!poolFull) continue;
    await client.coach.create({
      data: {
        firstName: poolFull.firstName,
        lastName: poolFull.lastName,
        role: f.role,
        teamId: f.teamId,
        ratingRecruit: poolFull.ratingRecruit,
        ratingDevelop: poolFull.ratingDevelop,
        ratingStrategy: poolFull.ratingStrategy,
        salary: poolFull.askingSalaryCents,
        hireSeason: seasonYear + 1,
        contractYears: 3,
      },
    });
    usedPoolIds.push(poolFull.id);
    filled += 1;
  }
  if (usedPoolIds.length > 0) {
    await client.coachingPool.deleteMany({ where: { id: { in: usedPoolIds } } });
  }

  // Final HC backfill safety: any team still missing an HC?
  let hcBackfilled = 0;
  for (const t of teams) {
    const hc = await client.coach.findFirst({ where: { teamId: t.id, role: 'HC' } });
    if (hc) continue;
    const candidate = await client.coach.findFirst({
      where: { teamId: t.id },
      orderBy: { ratingStrategy: 'desc' },
    });
    if (candidate) {
      await client.coach.update({
        where: { id: candidate.id },
        data: { role: 'HC' },
      });
    } else {
      await client.coach.create({
        data: {
          firstName: 'Interim',
          lastName: 'Coach',
          role: 'HC',
          teamId: t.id,
          ratingRecruit: 50,
          ratingDevelop: 50,
          ratingStrategy: 50,
          salary: 0,
          hireSeason: seasonYear + 1,
          contractYears: 1,
        },
      });
    }
    hcBackfilled += 1;
  }

  return { event: 'COACH_CAROUSEL', poolGenerated, filled, hcBackfilled };
}
