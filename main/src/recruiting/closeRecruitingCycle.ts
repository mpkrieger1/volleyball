// Sprint 13: signing day. Forces all PENDING recruits to UNCOMMITTED
// (they exhausted the cycle without committing). Transitions phase
// back to OFFSEASON.
//
// Sprint 24 (Task 24.1): also promotes COMMITTED recruits to freshman
// Player rows on the same signing-day transaction. Ratings parsed from
// `Recruit.ratingsJson` (PlayerRatingsSchema). Jerseys assigned 1-99
// per team with collision avoidance against existing roster. Promoted
// Recruit rows are deleted to keep the table small. Closes the v1
// blocker surfaced by Sprint 23's dynasty test (rosters drained over
// 4 seasons because COMMITTED recruits were never converted).

import { PrismaClient, type Prisma } from '@prisma/client';
import { sim } from '@vcd/shared';

export type CloseRecruitingCycleInput = { dbPath: string };
export type CloseRecruitingCycleResult = {
  uncommittedCount: number;
  promotedCount: number;
};

export async function closeRecruitingCycle(
  input: CloseRecruitingCycleInput,
): Promise<CloseRecruitingCycleResult> {
  const client = new PrismaClient({ datasources: { db: { url: `file:${input.dbPath}` } } });
  try {
    const season = await client.season.findFirst({ orderBy: { year: 'desc' } });
    if (!season) throw new Error('No Season row.');

    let uncommittedCount = 0;
    let promotedCount = 0;
    await client.$transaction(
      async (tx) => {
        // Sprint 24: promote COMMITTED recruits → Player rows BEFORE flipping
        // PENDING → UNCOMMITTED, so a single signing-day transaction is the
        // atomic unit.
        const committed = await tx.recruit.findMany({
          where: { commitState: 'COMMITTED', commitTeamId: { not: null } },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            position: true,
            ratingsJson: true,
            potential: true,
            height: true,
            commitTeamId: true,
          },
        });

        if (committed.length > 0) {
          // Pre-load existing roster to avoid jersey collisions and to compute
          // the next available number per team in O(roster) instead of
          // round-tripping the DB per recruit.
          const teamIds = Array.from(
            new Set(committed.map((r) => r.commitTeamId!).filter((id) => id !== null)),
          );
          const existing = await tx.player.findMany({
            where: { teamId: { in: teamIds } },
            select: { teamId: true, jersey: true },
          });
          const usedByTeam = new Map<string, Set<number>>();
          for (const p of existing) {
            const set = usedByTeam.get(p.teamId) ?? new Set<number>();
            set.add(p.jersey);
            usedByTeam.set(p.teamId, set);
          }

          const playerCreates: Prisma.PlayerCreateManyInput[] = [];
          for (const rec of committed) {
            const teamId = rec.commitTeamId!;
            const ratings = sim.PlayerRatingsSchema.parse(JSON.parse(rec.ratingsJson));
            const used = usedByTeam.get(teamId) ?? new Set<number>();
            const jersey = pickAvailableJersey(used);
            used.add(jersey);
            usedByTeam.set(teamId, used);

            playerCreates.push({
              teamId,
              firstName: rec.firstName,
              lastName: rec.lastName,
              position: rec.position,
              classYear: 'FR',
              height: rec.height ?? 180,
              jersey,
              ratingAttack: ratings.attack,
              ratingBlock: ratings.block,
              ratingServe: ratings.serve,
              ratingPass: ratings.pass,
              ratingSet: ratings.set,
              ratingDig: ratings.dig,
              ratingAthleticism: ratings.athleticism,
              ratingIq: ratings.iq,
              ratingStamina: ratings.stamina,
              potential: rec.potential ?? 60,
              redshirtUsed: false,
              isLibero: rec.position === 'L',
            });
          }

          // Chunk createMany to stay under SQLite's parameter cap.
          const CHUNK = 200;
          for (let off = 0; off < playerCreates.length; off += CHUNK) {
            await tx.player.createMany({ data: playerCreates.slice(off, off + CHUNK) });
          }
          // Mark promoted recruits as SIGNED. Next cycle's
          // `openRecruitingCycle` deletes by seasonYear, so SIGNED rows
          // don't accumulate across cycles.
          for (let off = 0; off < committed.length; off += CHUNK) {
            const slice = committed.slice(off, off + CHUNK).map((r) => r.id);
            await tx.recruit.updateMany({
              where: { id: { in: slice } },
              data: { commitState: 'SIGNED' },
            });
          }
          promotedCount = committed.length;
        }

        const result = await tx.recruit.updateMany({
          where: { commitState: 'PENDING' },
          data: { commitState: 'UNCOMMITTED' },
        });
        uncommittedCount = result.count;
        await tx.season.update({
          where: { id: season.id },
          data: { phase: 'OFFSEASON', recruitingWeek: 0 },
        });
      },
      { maxWait: 30_000, timeout: 120_000 },
    );

    return { uncommittedCount, promotedCount };
  } finally {
    await client.$disconnect();
  }
}

/**
 * Pick the first available jersey 1..99 not in `used`. If all 99 are taken
 * (extremely unlikely with caps at ~15 active players per team), wraps to
 * 0 as a fallback so the create call doesn't deadlock.
 */
function pickAvailableJersey(used: ReadonlySet<number>): number {
  for (let n = 1; n <= 99; n++) {
    if (!used.has(n)) return n;
  }
  return 0;
}
