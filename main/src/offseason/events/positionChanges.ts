// Sprint 33 — POSITION_CHANGES (preseason) event handler.
//
// v1.2 stub. Spec §8 OOS: "Position-change UI at PRESEASON_POSITION_CHANGES
// (auto only in v1.2)." This handler is a no-op; v1.3 will add automatic
// position swaps for over/under-staffed positions plus a user-facing UI.

import type { PrismaClient } from '@prisma/client';

export type PositionChangesResult = {
  event: 'POSITION_CHANGES';
};

export async function positionChanges(
  _client: PrismaClient,
  _seasonYear: number,
): Promise<PositionChangesResult> {
  return { event: 'POSITION_CHANGES' };
}
