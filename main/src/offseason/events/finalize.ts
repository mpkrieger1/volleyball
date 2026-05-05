// Sprint 33 — FINALIZE (preseason) event handler.
//
// Set Season.phase = REGULAR + reset phaseWeek = 0. By this point:
//   - PLAYERS_LEAVING archived seniors and cut to cap.
//   - SIGNING_DAY promoted COMMITTED recruits to Player rows.
//   - ADVANCE_YEAR aged class years and bumped Season.year.
//   - TRAINING_RESULTS applied training gains.
// FINALIZE just flips the phase so the user can `startRegular` the season.
//
// Idempotent: phase write is safe to repeat.

import type { PrismaClient } from '@prisma/client';

export type FinalizeResult = {
  event: 'FINALIZE';
};

export async function finalize(
  client: PrismaClient,
  _seasonYear: number,
): Promise<FinalizeResult> {
  const season = await client.season.findFirst({ orderBy: { year: 'desc' } });
  if (!season) throw new Error('No Season row.');
  await client.season.update({
    where: { id: season.id },
    data: { phase: 'REGULAR', phaseWeek: 0, currentWeek: 0 },
  });
  return { event: 'FINALIZE' };
}
