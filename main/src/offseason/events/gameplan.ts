// Sprint 33 — GAMEPLAN (preseason) event handler.
//
// v1.2 stub. Spec §8 OOS: "Game-plan install at PRESEASON_GAMEPLAN
// (placeholder event in v1.2). Sprint 34 ships the per-week practice-focus
// modifier; the offseason gameplan-template install is a separate v1.3
// system." This handler is a no-op.

import type { PrismaClient } from '@prisma/client';

export type GameplanResult = {
  event: 'GAMEPLAN';
};

export async function gameplan(
  _client: PrismaClient,
  _seasonYear: number,
): Promise<GameplanResult> {
  return { event: 'GAMEPLAN' };
}
