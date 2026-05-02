// Sprint 15: atomically replace a team's Team-Collective NIL deals with
// an auto-distributed proportional allocation across its roster.
// Portal-sourced deals are preserved; only Team Collective deals are
// cleared and regenerated.

import { PrismaClient } from '@prisma/client';
import { nil } from '@vcd/shared';

const TEAM_COLLECTIVE_BRAND = 'Team Collective';

export type AutoDistributeInput = {
  dbPath: string;
  teamId: string;
};

export type AutoDistributeResult =
  | { ok: true; dealsCreated: number; totalSpent: number }
  | { ok: false; code: 'BOOSTER_NOT_FOUND'; message: string };

export async function autoDistributeNil(
  input: AutoDistributeInput,
): Promise<AutoDistributeResult> {
  const client = new PrismaClient({ datasources: { db: { url: `file:${input.dbPath}` } } });
  try {
    const booster = await client.booster.findUnique({ where: { teamId: input.teamId } });
    if (!booster) {
      return {
        ok: false,
        code: 'BOOSTER_NOT_FOUND',
        message: `No booster for team ${input.teamId}.`,
      };
    }

    const players = await client.player.findMany({
      where: { teamId: input.teamId },
    });

    // Subtract any existing portal NIL already committed (Sprint 14 leftovers).
    const playerIds = players.map((p) => p.id);
    const nonTeamCollectiveAgg = await client.nilDeal.aggregate({
      where: { playerId: { in: playerIds }, brand: { not: TEAM_COLLECTIVE_BRAND } },
      _sum: { amount: true },
    });
    const alreadyCommitted = nonTeamCollectiveAgg._sum.amount ?? 0;
    const budgetRemaining = Math.max(0, booster.collectiveBudget - alreadyCommitted);

    // Compute value per player.
    const valuedPlayers = players.map((p) => ({
      playerId: p.id,
      value: nil.computePlayerValue({
        overall: Math.round(
          (p.ratingAttack +
            p.ratingBlock +
            p.ratingServe +
            p.ratingPass +
            p.ratingSet +
            p.ratingDig +
            p.ratingAthleticism +
            p.ratingIq +
            p.ratingStamina) /
            9,
        ),
        potential: p.potential,
        position: p.position as 'OH' | 'MB' | 'OPP' | 'S' | 'L' | 'DS',
        classYear: p.classYear as 'FR' | 'SO' | 'JR' | 'SR' | 'GR',
      }),
    }));

    const allocations = nil.autoDistribute(budgetRemaining, valuedPlayers);

    await client.$transaction([
      client.nilDeal.deleteMany({
        where: { playerId: { in: playerIds }, brand: TEAM_COLLECTIVE_BRAND },
      }),
      client.nilDeal.createMany({
        data: allocations.map((a) => ({
          playerId: a.playerId,
          brand: TEAM_COLLECTIVE_BRAND,
          amount: a.amountCents,
          durationMonths: 12,
          teamRestrictionLevel: 'BOOSTER',
        })),
      }),
    ]);

    const totalSpent = allocations.reduce((s, a) => s + a.amountCents, 0) + alreadyCommitted;
    return { ok: true, dealsCreated: allocations.length, totalSpent };
  } finally {
    await client.$disconnect();
  }
}
