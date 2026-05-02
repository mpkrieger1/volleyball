// Sprint 14: close the portal. Atomically:
//   - For SIGNED entries: move Player.teamId to the new team, create
//     NilDeal if an offer was attached.
//   - For ACTIVE entries: mark UNSIGNED (player stays on origin team).
//   - Transition Season.phase to 'RECRUITING' (next step in the loop).
//
// Exit test 3 is trivially satisfied: Player.teamId is a single field;
// we update it once per SIGNED entry inside a single atomic transaction.

import { PrismaClient } from '@prisma/client';

export type ClosePortalInput = { dbPath: string };
export type ClosePortalResult = {
  signedCount: number;
  unsignedCount: number;
  nilDealsCreated: number;
};

export async function closePortal(input: ClosePortalInput): Promise<ClosePortalResult> {
  const client = new PrismaClient({ datasources: { db: { url: `file:${input.dbPath}` } } });
  try {
    const season = await client.season.findFirst({ orderBy: { year: 'desc' } });
    if (!season) throw new Error('No Season row.');

    const signed = await client.transferPortal.findMany({
      where: { status: 'SIGNED', newTeamId: { not: null } },
    });

    let nilDealsCreated = 0;

    await client.$transaction(
      async (tx) => {
        for (const entry of signed) {
          await tx.player.update({
            where: { id: entry.playerId },
            data: { teamId: entry.newTeamId! },
          });
          if (entry.nilOfferAmount && entry.nilOfferAmount > 0) {
            await tx.nilDeal.create({
              data: {
                playerId: entry.playerId,
                brand: 'Portal NIL',
                amount: entry.nilOfferAmount,
                durationMonths: 12,
                teamRestrictionLevel: 'BOOSTER',
              },
            });
            nilDealsCreated += 1;
          }
        }

        const unsignedRes = await tx.transferPortal.updateMany({
          where: { status: 'ACTIVE' },
          data: { status: 'UNSIGNED' },
        });

        await tx.season.update({
          where: { id: season.id },
          data: { phase: 'RECRUITING', portalWeek: 0 },
        });

        return unsignedRes;
      },
      { maxWait: 30_000, timeout: 60_000 },
    );

    const unsignedCount = await client.transferPortal.count({
      where: { status: 'UNSIGNED' },
    });

    return {
      signedCount: signed.length,
      unsignedCount,
      nilDealsCreated,
    };
  } finally {
    await client.$disconnect();
  }
}
