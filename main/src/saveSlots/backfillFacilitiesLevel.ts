// Sprint 32 Task 32.1: legacy-save backfill for Team.facilitiesLevel.
//
// `applyMigrations` adds the column with `DEFAULT 3` for every existing
// row. This step bumps high-prestige teams up to their tier-derived
// value (5 / 7) so opening a Sprint 31 save in Sprint 32+ feels the same
// as a fresh Sprint 32 save for the training event.
//
// Idempotency key: only update rows where `facilitiesLevel === 3` AND
// the prestige-derived target is > 3. Re-runs no-op because:
//   - prestige < 50 teams stay at 3 (target === 3, skipped).
//   - prestige ≥ 50 teams have already been bumped above 3 (filter excludes them).
// v1.3+ in-game facilities upgrades will move levels above 3 and never
// land on the default-3 row, so this backfill won't clobber user state.

import type { PrismaClient } from '@prisma/client';
import { deriveFacilitiesLevel } from '@vcd/shared/seed';

export async function backfillFacilitiesLevel(client: PrismaClient): Promise<number> {
  const teams = await client.team.findMany({
    where: { facilitiesLevel: 3 },
    select: { id: true, prestige: true },
  });
  let updated = 0;
  for (const t of teams) {
    const target = deriveFacilitiesLevel(t.prestige);
    if (target === 3) continue;
    await client.team.update({
      where: { id: t.id },
      data: { facilitiesLevel: target },
    });
    updated += 1;
  }
  return updated;
}
