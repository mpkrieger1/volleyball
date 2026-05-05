// Sprint 33 — PLAYERS_LEAVING event handler.
//
// Graduate seniors → PlayerArchive + delete. Cut roster down to
// SCHOLARSHIP_CAP (15) using current ratings (Sprint 16's cap rule —
// the dev/cap interaction differs from Sprint 16's runOffseason but the
// invariant "no team exceeds SCHOLARSHIP_CAP" holds).
//
// Idempotency: keys on PlayerArchive rows for `seasonRetired === seasonYear`.
// If any exist, the graduation step is skipped on re-run; cap enforcement
// is naturally idempotent (already-cut players are gone).

import type { PrismaClient } from '@prisma/client';
import { offseason } from '@vcd/shared';

type ClassYear = 'FR' | 'SO' | 'JR' | 'SR' | 'GR';

function overall(p: {
  ratingAttack: number;
  ratingBlock: number;
  ratingServe: number;
  ratingPass: number;
  ratingSet: number;
  ratingDig: number;
  ratingAthleticism: number;
  ratingIq: number;
  ratingStamina: number;
}): number {
  return Math.round(
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
}

export type PlayersLeavingResult = {
  event: 'PLAYERS_LEAVING';
  graduated: number;
  cut: number;
};

export async function playersLeaving(
  client: PrismaClient,
  seasonYear: number,
): Promise<PlayersLeavingResult> {
  // Idempotency check.
  const existingArchives = await client.playerArchive.count({
    where: { seasonRetired: seasonYear },
  });
  let graduated = 0;
  if (existingArchives === 0) {
    const players = await client.player.findMany();
    const graduates = players.filter((p) => {
      const adv = offseason.advanceClass({ classYear: p.classYear as ClassYear });
      return adv.graduates;
    });
    if (graduates.length > 0) {
      await client.$transaction(
        async (tx) => {
          // Purge PMS rows for departing players (Sprint 23 cleanup).
          const ids = graduates.map((g) => g.id);
          await tx.playerMatchStat.deleteMany({ where: { playerId: { in: ids } } });
          // Sprint 37 (Task 37.5b): TransferPortal + NilDeal rows from
          // prior cycles can pin a graduating player and trigger an FK
          // error on player.deleteMany. Both relations lack onDelete:Cascade.
          // Drop them explicitly here so multi-year offseason cycles work.
          await tx.transferPortal.deleteMany({ where: { playerId: { in: ids } } });
          await tx.nilDeal.deleteMany({ where: { playerId: { in: ids } } });

          const archiveData = graduates.map((p) => ({
            originalPlayerId: p.id,
            firstName: p.firstName,
            lastName: p.lastName,
            position: p.position,
            finalTeamId: p.teamId,
            finalClassYear: p.classYear,
            finalRatingsJson: JSON.stringify({
              attack: p.ratingAttack,
              block: p.ratingBlock,
              serve: p.ratingServe,
              pass: p.ratingPass,
              set: p.ratingSet,
              dig: p.ratingDig,
              athleticism: p.ratingAthleticism,
              iq: p.ratingIq,
              stamina: p.ratingStamina,
            }),
            finalPotential: p.potential,
            seasonRetired: seasonYear,
          }));
          const CHUNK = 500;
          for (let off = 0; off < archiveData.length; off += CHUNK) {
            await tx.playerArchive.createMany({ data: archiveData.slice(off, off + CHUNK) });
          }
          await tx.player.deleteMany({ where: { id: { in: ids } } });
        },
        { maxWait: 30_000, timeout: 60_000 },
      );
      graduated = graduates.length;
    }
  }

  // Enforce scholarship cap on the surviving roster (per-team).
  const survivors = await client.player.findMany();
  const byTeam = new Map<string, typeof survivors>();
  for (const p of survivors) {
    const arr = byTeam.get(p.teamId) ?? [];
    arr.push(p);
    byTeam.set(p.teamId, arr);
  }
  const cutIds: string[] = [];
  for (const [, list] of byTeam) {
    const cap = offseason.enforceScholarshipCap(
      list.map((p) => ({ id: p.id, overall: overall(p) })),
    );
    for (const c of cap.cut) cutIds.push(c.id);
  }
  if (cutIds.length > 0) {
    await client.playerMatchStat.deleteMany({ where: { playerId: { in: cutIds } } });
    // Sprint 37 (Task 37.5b): same FK guard as the graduate path above.
    await client.transferPortal.deleteMany({ where: { playerId: { in: cutIds } } });
    await client.nilDeal.deleteMany({ where: { playerId: { in: cutIds } } });
    await client.player.deleteMany({ where: { id: { in: cutIds } } });
  }

  return { event: 'PLAYERS_LEAVING', graduated, cut: cutIds.length };
}
