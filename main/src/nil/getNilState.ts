// Sprint 15: read-side — returns booster + roster with per-player NIL.

import { PrismaClient } from '@prisma/client';
import { nil } from '@vcd/shared';

export type GetNilStateInput = {
  dbPath: string;
  teamId: string;
};

export type NilRosterRow = {
  playerId: string;
  firstName: string;
  lastName: string;
  position: string;
  classYear: string;
  overall: number;
  valueCents: number;
  currentNilCents: number;
};

export type GetNilStateResult =
  | {
      ok: true;
      collectiveBudget: number;
      totalSpent: number;
      remaining: number;
      enthusiasm: number;
      roster: NilRosterRow[];
    }
  | { ok: false; code: 'BOOSTER_NOT_FOUND'; message: string };

export async function getNilState(input: GetNilStateInput): Promise<GetNilStateResult> {
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
      orderBy: [{ position: 'asc' }, { lastName: 'asc' }],
    });
    const playerIds = players.map((p) => p.id);

    const nilAgg = await client.nilDeal.groupBy({
      by: ['playerId'],
      where: { playerId: { in: playerIds } },
      _sum: { amount: true },
    });
    const nilByPlayer = new Map<string, number>();
    for (const row of nilAgg) nilByPlayer.set(row.playerId, row._sum.amount ?? 0);

    const totalSpent = Array.from(nilByPlayer.values()).reduce((s, v) => s + v, 0);

    const roster: NilRosterRow[] = players.map((p) => {
      const overall = Math.round(
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
      );
      return {
        playerId: p.id,
        firstName: p.firstName,
        lastName: p.lastName,
        position: p.position,
        classYear: p.classYear,
        overall,
        valueCents: nil.computePlayerValue({
          overall,
          potential: p.potential,
          position: p.position as 'OH' | 'MB' | 'OPP' | 'S' | 'L' | 'DS',
          classYear: p.classYear as 'FR' | 'SO' | 'JR' | 'SR' | 'GR',
        }),
        currentNilCents: nilByPlayer.get(p.id) ?? 0,
      };
    });

    return {
      ok: true,
      collectiveBudget: booster.collectiveBudget,
      totalSpent,
      remaining: Math.max(0, booster.collectiveBudget - totalSpent),
      enthusiasm: booster.enthusiasm,
      roster,
    };
  } finally {
    await client.$disconnect();
  }
}
