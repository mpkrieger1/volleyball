// Sprint 33 — SIGNING_DAY event handler.
//
// Closes the recruiting cycle: PENDING → UNCOMMITTED, COMMITTED → SIGNED
// (and existing Sprint 24 logic promotes COMMITTED recruits to Player rows).
// closeRecruitingCycle writes Season.phase=OFFSEASON; we leave that as-is.
//
// Idempotency: if no PENDING or COMMITTED Recruit rows remain, this has
// already run. Skip.

import { PrismaClient } from '@prisma/client';
import { closeRecruitingCycle } from '../../recruiting/closeRecruitingCycle';
import { deriveNilBudget } from '@vcd/shared/seed';

export type SigningDayResult = {
  event: 'SIGNING_DAY';
  uncommittedCount: number;
  promotedCount: number;
};

export async function signingDay(dbPath: string): Promise<SigningDayResult> {
  const client = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });
  let alreadyClosed = false;
  try {
    const open = await client.recruit.count({
      where: { commitState: { in: ['PENDING', 'COMMITTED'] } },
    });
    if (open === 0) alreadyClosed = true;
  } finally {
    await client.$disconnect();
  }
  if (alreadyClosed) {
    return { event: 'SIGNING_DAY', uncommittedCount: 0, promotedCount: 0 };
  }

  const result = await closeRecruitingCycle({ dbPath });

  // Sprint 36: refresh team NIL budgets at signing day. Each team's pool
  // resets to deriveNilBudget(prestige); spend resets to 0 for the next cycle.
  const refreshClient = new PrismaClient({
    datasources: { db: { url: `file:${dbPath}` } },
  });
  try {
    const teams = await refreshClient.team.findMany({
      select: { id: true, prestige: true },
    });
    await refreshClient.$transaction(
      teams.map((t) =>
        refreshClient.team.update({
          where: { id: t.id },
          data: {
            nilBudgetCents: deriveNilBudget(t.prestige),
            nilBudgetUsedCents: 0,
          },
        }),
      ),
    );
  } finally {
    await refreshClient.$disconnect();
  }

  return {
    event: 'SIGNING_DAY',
    uncommittedCount: result.uncommittedCount,
    promotedCount: result.promotedCount,
  };
}
