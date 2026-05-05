// Sprint 36 Task 36.1 — legacy-save backfill for Team NIL budget.
//
// The migration adds Team.nilBudgetCents with default 0. This backfill
// seeds it to deriveNilBudget(prestige) for every team where the column
// is currently 0 (== never set).
//
// Idempotent: rows with non-zero budgets stay put. Re-runs no-op because
// previously-bumped rows are above 0.

import type { PrismaClient } from '@prisma/client';
import { deriveNilBudget } from '@vcd/shared/seed';

export async function backfillNilBudget(client: PrismaClient): Promise<number> {
  const teams = await client.team.findMany({
    where: { nilBudgetCents: 0 },
    select: { id: true, prestige: true },
  });
  let updated = 0;
  for (const t of teams) {
    const target = deriveNilBudget(t.prestige);
    if (target === 0) continue;
    await client.team.update({
      where: { id: t.id },
      data: { nilBudgetCents: target },
    });
    updated += 1;
  }
  return updated;
}
