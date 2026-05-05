// Sprint 33 — PLAYERS_TRANSFERRING event handler.
//
// v1.2 simplification: open the portal, run AI portal weeks until no more
// commits resolve (or hard cap of 7 weeks per Sprint 14), then close.
// All in one event call. Sprint 33 spec §33.6 explicitly puts portal
// scope inside this event.
//
// Idempotency: if Season.portalWeek > 0 OR there are no PENDING
// TransferPortal rows, this event has already run. Skip.

import { PrismaClient } from '@prisma/client';
import { openPortal } from '../../portal/openPortal';
import { advancePortalWeek } from '../../portal/advancePortalWeek';
import { closePortal } from '../../portal/closePortal';

const MAX_PORTAL_WEEKS = 7;

export type PlayersTransferringResult = {
  event: 'PLAYERS_TRANSFERRING';
  entrants: number;
  signedCount: number;
  weeksRun: number;
};

export async function playersTransferring(
  dbPath: string,
  seasonYear: number,
): Promise<PlayersTransferringResult> {
  const client = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });
  let alreadyRan = false;
  try {
    // Idempotency: if any TransferPortal rows for this season already exist
    // and none are ACTIVE, the cycle ran. Bail.
    const total = await client.transferPortal.count();
    const active = await client.transferPortal.count({ where: { status: 'ACTIVE' } });
    if (total > 0 && active === 0) alreadyRan = true;
  } finally {
    await client.$disconnect();
  }
  if (alreadyRan) {
    return { event: 'PLAYERS_TRANSFERRING', entrants: 0, signedCount: 0, weeksRun: 0 };
  }

  const opened = await openPortal({ dbPath, seed: `portal-open:${seasonYear}` });

  let weeksRun = 0;
  for (let i = 0; i < MAX_PORTAL_WEEKS; i++) {
    const result = await advancePortalWeek({
      dbPath,
      seed: `portal-adv:${seasonYear}:${i}`,
    });
    weeksRun += 1;
    // Bail early if no commits resolved this week — no more action.
    if (result.commitsResolved === 0 && i > 0) break;
  }

  const closed = await closePortal({ dbPath });

  // Reset Season.phase to OFFSEASON (openPortal sets it to PORTAL).
  const c = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });
  try {
    const season = await c.season.findFirst({ orderBy: { year: 'desc' } });
    if (season) {
      await c.season.update({ where: { id: season.id }, data: { phase: 'OFFSEASON' } });
    }
  } finally {
    await c.$disconnect();
  }

  return {
    event: 'PLAYERS_TRANSFERRING',
    entrants: opened.entrants,
    signedCount: closed.signedCount,
    weeksRun,
  };
}
