// Sprint 33 — COACH_LEVELING event handler.
//
// Apply experience-based deltas to existing coaches. v1.2 simplification:
// extract Sprint 17's `coaching.planTurnover` from runOffseason. Removes
// retiring/poached/contract-expired coaches; renews + decrements contracts
// on the rest. Idempotent: re-runs read the same Coach state and either
// produce the same plan (deterministic seed) or no-op if no coaches need
// turnover-action.

import type { PrismaClient } from '@prisma/client';
import { createRng, coaching } from '@vcd/shared';

export type CoachLevelingResult = {
  event: 'COACH_LEVELING';
  removed: number;
  renewed: number;
};

export async function coachLeveling(
  client: PrismaClient,
  seasonYear: number,
): Promise<CoachLevelingResult> {
  const allCoaches = await client.coach.findMany({
    where: { teamId: { not: null } },
    select: {
      id: true,
      teamId: true,
      role: true,
      contractYears: true,
      ratingRecruit: true,
      ratingDevelop: true,
      ratingStrategy: true,
    },
  });
  const lifecycleRng = createRng(`coach-lifecycle:${seasonYear + 1}`);
  const turnover = coaching.planTurnover(
    allCoaches.map((c) => ({
      id: c.id,
      teamId: c.teamId!,
      role: c.role as 'HC' | 'AHC' | 'AC',
      contractYears: c.contractYears,
      ratingRecruit: c.ratingRecruit,
      ratingDevelop: c.ratingDevelop,
      ratingStrategy: c.ratingStrategy,
    })),
    lifecycleRng.fork('turnover'),
  );

  const removedIds: string[] = [];
  const renewedIds: string[] = [];
  for (const a of turnover) {
    if (a.kind === 'fill') continue;
    if (a.kind === 'renew') renewedIds.push(a.coachId);
    else removedIds.push(a.coachId);
  }
  if (removedIds.length > 0) {
    await client.coach.deleteMany({ where: { id: { in: removedIds } } });
  }
  for (const id of renewedIds) {
    await client.coach.update({ where: { id }, data: { contractYears: 3 } });
  }
  const touched = new Set([...removedIds, ...renewedIds]);
  for (const c of allCoaches) {
    if (touched.has(c.id)) continue;
    if (c.contractYears > 1) {
      await client.coach.update({
        where: { id: c.id },
        data: { contractYears: c.contractYears - 1 },
      });
    }
  }

  return {
    event: 'COACH_LEVELING',
    removed: removedIds.length,
    renewed: renewedIds.length,
  };
}
