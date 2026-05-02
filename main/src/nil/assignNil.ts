// Sprint 15: assign a NIL deal to a player on the user's team.
// Upserts a NilDeal with brand='Team Collective' and validates against
// the team's booster budget.

import { PrismaClient } from '@prisma/client';
import { nil } from '@vcd/shared';

export type AssignNilInput = {
  dbPath: string;
  teamId: string;
  playerId: string;
  amountCents: number;
};

export type AssignNilResult =
  | {
      ok: true;
      newTotalSpent: number;
      remaining: number;
      playerValueCents: number;
    }
  | {
      ok: false;
      code: 'INSUFFICIENT_BUDGET' | 'INVALID_AMOUNT' | 'BOOSTER_NOT_FOUND' | 'PLAYER_NOT_ON_TEAM';
      message: string;
    };

const TEAM_COLLECTIVE_BRAND = 'Team Collective';

export async function assignNil(input: AssignNilInput): Promise<AssignNilResult> {
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

    const player = await client.player.findUnique({ where: { id: input.playerId } });
    if (!player || player.teamId !== input.teamId) {
      return {
        ok: false,
        code: 'PLAYER_NOT_ON_TEAM',
        message: 'Player is not on this team.',
      };
    }

    // Find existing Team Collective deal for this player (may not exist).
    const existing = await client.nilDeal.findFirst({
      where: { playerId: input.playerId, brand: TEAM_COLLECTIVE_BRAND },
    });
    const previousAmount = existing?.amount ?? 0;

    // Compute current team spend (sum of ALL NilDeal.amount for players on this team).
    const teamPlayerIds = (
      await client.player.findMany({
        where: { teamId: input.teamId },
        select: { id: true },
      })
    ).map((p) => p.id);
    const agg = await client.nilDeal.aggregate({
      where: { playerId: { in: teamPlayerIds } },
      _sum: { amount: true },
    });
    const currentSpent = agg._sum.amount ?? 0;

    const v = nil.validateAssignment(
      currentSpent,
      input.amountCents,
      previousAmount,
      booster.collectiveBudget,
    );
    if (!v.ok) return { ok: false, code: v.code, message: v.message };

    // Upsert the Team Collective deal.
    if (existing) {
      await client.nilDeal.update({
        where: { id: existing.id },
        data: { amount: input.amountCents },
      });
    } else {
      await client.nilDeal.create({
        data: {
          playerId: input.playerId,
          brand: TEAM_COLLECTIVE_BRAND,
          amount: input.amountCents,
          durationMonths: 12,
          teamRestrictionLevel: 'BOOSTER',
        },
      });
    }

    const newSpent = currentSpent - previousAmount + input.amountCents;

    // Compute player value for response.
    const value = nil.computePlayerValue({
      overall: Math.round(
        (player.ratingAttack +
          player.ratingBlock +
          player.ratingServe +
          player.ratingPass +
          player.ratingSet +
          player.ratingDig +
          player.ratingAthleticism +
          player.ratingIq +
          player.ratingStamina) /
          9,
      ),
      potential: player.potential,
      position: player.position as 'OH' | 'MB' | 'OPP' | 'S' | 'L' | 'DS',
      classYear: player.classYear as 'FR' | 'SO' | 'JR' | 'SR' | 'GR',
    });

    return {
      ok: true,
      newTotalSpent: newSpent,
      remaining: booster.collectiveBudget - newSpent,
      playerValueCents: value,
    };
  } finally {
    await client.$disconnect();
  }
}
