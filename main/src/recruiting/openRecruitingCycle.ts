// Sprint 13: open a recruiting cycle. Generates the class, persists
// Recruit rows, transitions Season.phase → 'RECRUITING', resets
// recruitingWeek to 0.

import { PrismaClient } from '@prisma/client';
import { recruiting, coaching } from '@vcd/shared';

export type OpenRecruitingCycleInput = {
  dbPath: string;
  seasonYear: number;
  classSize?: number;
  seed?: string;
  /** Per-team board size (initial RecruitInterest rows). Defaults to 30. */
  boardSizePerTeam?: number;
};

export type OpenRecruitingCycleResult = {
  recruitsCreated: number;
  interestsSeeded: number;
};

const DEFAULT_CLASS_SIZE = 3_000;
const DEFAULT_BOARD_SIZE = 30;

export async function openRecruitingCycle(
  input: OpenRecruitingCycleInput,
): Promise<OpenRecruitingCycleResult> {
  const client = new PrismaClient({ datasources: { db: { url: `file:${input.dbPath}` } } });
  try {
    const size = input.classSize ?? DEFAULT_CLASS_SIZE;
    const boardSize = input.boardSizePerTeam ?? DEFAULT_BOARD_SIZE;
    const seed = input.seed ?? `recruit:${input.seasonYear}`;
    const recruits = recruiting.generateRecruitClass(seed, size);

    // Load teams + coaches for board seeding.
    const [teams, coaches] = await Promise.all([
      client.team.findMany({
        select: { id: true, prestige: true, region: true },
      }),
      client.coach.findMany({
        where: { teamId: { not: null } },
        select: {
          teamId: true,
          role: true,
          ratingRecruit: true,
          ratingDevelop: true,
          ratingStrategy: true,
        },
      }),
    ]);
    const coachesByTeam = new Map<string, typeof coaches>();
    for (const c of coaches) {
      if (!c.teamId) continue;
      const arr = coachesByTeam.get(c.teamId) ?? [];
      arr.push(c);
      coachesByTeam.set(c.teamId, arr);
    }
    const coachRatingByTeam = new Map<string, number>();
    for (const [teamId, teamCoaches] of coachesByTeam) {
      coachRatingByTeam.set(teamId, coaching.pickCoachRating(teamCoaches, 'recruiting'));
    }

    // Persist recruits and capture their DB ids for interest seeding.
    await client.$transaction(
      async (tx) => {
        await tx.recruitInterest.deleteMany({
          where: { recruit: { seasonYear: input.seasonYear } },
        });
        await tx.recruit.deleteMany({ where: { seasonYear: input.seasonYear } });
        await tx.recruitingBudget.deleteMany();

        await tx.recruit.createMany({
          data: recruits.map((r) => ({
            firstName: r.firstName,
            lastName: r.lastName,
            position: r.position,
            stars: r.stars,
            ratingsJson: JSON.stringify(r.ratings),
            height: r.height,
            hometownCity: r.hometownCity,
            hometownState: r.hometownState,
            hometownRegion: r.hometownRegion,
            potential: r.potential,
            commitState: 'PENDING',
            seasonYear: input.seasonYear,
          })),
        });

        const season = await tx.season.findFirst({ orderBy: { year: 'desc' } });
        if (season) {
          await tx.season.update({
            where: { id: season.id },
            data: { phase: 'RECRUITING', recruitingWeek: 1 },
          });
        }
      },
      { maxWait: 30_000, timeout: 120_000 },
    );

    // Read back recruit ids; compute initial RecruitInterest rows.
    const persistedRecruits = await client.recruit.findMany({
      where: { seasonYear: input.seasonYear },
      select: {
        id: true,
        stars: true,
        hometownRegion: true,
        position: true,
      },
    });

    type InterestSeed = { recruitId: string; teamId: string; interest: number };
    const toInsert: InterestSeed[] = [];

    // Sprint 25: rank by `computeBoardScore` (adds star bonus + per-team
    // jitter) so different teams pick different lower-tier recruits and
    // every recruit lands on at least some boards. Persisted interest is
    // the unjittered base (`computeRecruitTeamInterestScaled`) so Sprint 13
    // commit-resolution semantics (`interest^5` weighting,
    // shouldDecide thresholds) hold. Sprint 37: wrapper deletion —
    // `computeBaseInterest` removed; `computeRecruitTeamInterestScaled`
    // is the priority-helper bridge with magnitude scale + floor penalty.
    for (const team of teams) {
      const teamCtx = {
        teamId: team.id,
        prestige: team.prestige,
        region: team.region,
        coachRatingRecruit: coachRatingByTeam.get(team.id) ?? 50,
        commitsAtPosition: 0,
      };
      const scored: Array<{ id: string; base: number; rank: number }> = persistedRecruits.map(
        (r) => {
          const recruitCtx = {
            stars: r.stars as 1 | 2 | 3 | 4 | 5,
            hometownRegion: r.hometownRegion ?? 'CENTRAL',
          };
          const base = recruiting.computeRecruitTeamInterestScaled(recruitCtx, teamCtx);
          const rank = recruiting.computeBoardScore(
            { ...recruitCtx, recruitId: r.id },
            teamCtx,
          );
          return { id: r.id, base, rank };
        },
      );
      scored.sort((a, b) => b.rank - a.rank || a.id.localeCompare(b.id));
      for (let i = 0; i < Math.min(boardSize, scored.length); i++) {
        const row = scored[i]!;
        if (row.base <= 0) continue;
        toInsert.push({ recruitId: row.id, teamId: team.id, interest: row.base });
      }
    }

    // Chunked insert (SQLite max-variable safety).
    const CHUNK = 500;
    for (let off = 0; off < toInsert.length; off += CHUNK) {
      const slice = toInsert.slice(off, off + CHUNK);
      await client.recruitInterest.createMany({
        data: slice,
      });
    }

    return { recruitsCreated: size, interestsSeeded: toInsert.length };
  } finally {
    await client.$disconnect();
  }
}
