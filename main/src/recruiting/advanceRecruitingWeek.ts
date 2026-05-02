// Sprint 13: advance one week of the recruiting cycle.
//
// Flow:
//   1. AI tick: for every team (except user team), apply a CALL-equivalent
//      interest delta to the top-10 recruits on their board (existing
//      RecruitInterest rows sorted by interest desc, then stars desc).
//      Delta is scaled by coach.ratingRecruit / 100.
//   2. Commit check: for every PENDING recruit, gather all their
//      RecruitInterest rows; if `shouldDecide(week, stars, maxInterest)`,
//      run pickCommittingTeam. Persist the commit.
//   3. Increment Season.recruitingWeek.

import { PrismaClient } from '@prisma/client';
import { createRng, recruiting, coaching } from '@vcd/shared';

const AI_TOP_N = 10;

export type AdvanceRecruitingWeekInput = {
  dbPath: string;
  /** User-controlled team id — excluded from AI ticks. Null = all teams are AI. */
  userTeamId?: string | null;
  /** Seed for determinism (AI delta variance + commit pick). */
  seed?: string;
};

export type AdvanceRecruitingWeekResult = {
  week: number;
  aiActionsApplied: number;
  commitsResolved: number;
};

export async function advanceRecruitingWeek(
  input: AdvanceRecruitingWeekInput,
): Promise<AdvanceRecruitingWeekResult> {
  const client = new PrismaClient({ datasources: { db: { url: `file:${input.dbPath}` } } });
  try {
    const season = await client.season.findFirst({ orderBy: { year: 'desc' } });
    if (!season) throw new Error('No Season row.');
    if (season.phase !== 'RECRUITING') {
      throw new Error(`Season.phase must be RECRUITING (got ${season.phase}).`);
    }
    const week = season.recruitingWeek;

    // Load coaches by team to scale AI deltas (Sprint 17: role-aware).
    const coaches = await client.coach.findMany({
      where: { teamId: { not: null } },
      select: {
        teamId: true,
        role: true,
        ratingRecruit: true,
        ratingDevelop: true,
        ratingStrategy: true,
      },
    });
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

    const rootRng = createRng(input.seed ?? `rec:${season.year}:${week}`);

    // ─── 1. AI ticks ───
    // For each team except user, pull top-N RecruitInterest rows (where the
    // recruit is still PENDING), apply delta.
    const aiRng = rootRng.fork('ai');
    // AI uses a HOME_VISIT-equivalent delta per weekly tick (bigger than
    // CALL). Top-5 programs need to close interest gaps to their peers
    // fast enough that the commit model actually separates them.
    const aiBaseDelta = recruiting.RECRUITING_ACTIONS.HOME_VISIT.delta;

    const teams = await client.team.findMany({ select: { id: true } });
    const teamIds = teams
      .map((t) => t.id)
      .filter((id) => id !== input.userTeamId);

    // AI ticks run as direct client calls (no outer transaction). The
    // updates are independent — one row per (team, recruit) — and the
    // aggregate isn't atomic-required. Wrapping 360×10 = 3,600 updates
    // in one Prisma interactive tx hits the silent-timeout case observed
    // in Sprint 13 early work.
    //
    // Precompute PENDING recruit ids once so the inner AI loop can use a
    // simple `recruitId IN (...)` filter rather than a relation filter
    // (which was the root cause of the "ai=0 at week 4" regression —
    // Prisma's nested relation filter appeared to miss newly-written
    // rows in rapid back-to-back advance calls).
    let aiActionsApplied = 0;

    const pendingIdRows = await client.recruit.findMany({
      where: { commitState: 'PENDING', seasonYear: season.year },
      select: { id: true },
    });
    const pendingIds = pendingIdRows.map((r) => r.id);

    const pendingIdSet = new Set(pendingIds);

    // Precompute metadata once.
    const pendingRecruitMeta = await client.recruit.findMany({
      where: { commitState: 'PENDING', seasonYear: season.year },
      select: { id: true, stars: true, hometownRegion: true },
    });
    const teamsMeta = await client.team.findMany({
      select: { id: true, prestige: true, region: true },
    });
    const teamMetaById = new Map(teamsMeta.map((t) => [t.id, t]));

    // Load ALL interest rows in one query; group by teamId in memory.
    // This replaces 360 per-team findMany calls with one.
    const allInterests = await client.recruitInterest.findMany({
      orderBy: [{ interest: 'desc' }],
    });
    const interestsByTeam = new Map<string, typeof allInterests>();
    for (const r of allInterests) {
      let list = interestsByTeam.get(r.teamId);
      if (!list) {
        list = [];
        interestsByTeam.set(r.teamId, list);
      }
      list.push(r);
    }

    // Lookup recruit stars for AI prioritization (AI should chase
    // 5-stars first, not high-base-interest low-star filler).
    const recruitStarsById = new Map<string, number>();
    for (const r of pendingRecruitMeta) recruitStarsById.set(r.id, r.stars);

    // Plan updates + creates in memory; batch-write via a single tx below.
    type UpdateSpec = { id: string; interest: number; actionsSpent: number };
    type CreateSpec = { recruitId: string; teamId: string; interest: number };
    const updates: UpdateSpec[] = [];
    const creates: CreateSpec[] = [];

    for (const teamId of teamIds) {
      const teamRows = (interestsByTeam.get(teamId) ?? [])
        .filter((r) => pendingIdSet.has(r.recruitId))
        // AI priority = stars desc, then interest desc. This makes
        // blue-blood programs pursue 5-stars over 2-star filler and is
        // what makes PRD exit test 2 pass.
        .sort((a, b) => {
          const starA = recruitStarsById.get(a.recruitId) ?? 0;
          const starB = recruitStarsById.get(b.recruitId) ?? 0;
          if (starA !== starB) return starB - starA;
          return b.interest - a.interest;
        });
      let rows = teamRows.slice();

      if (rows.length < AI_TOP_N) {
        const existingRecruitIds = new Set(
          (interestsByTeam.get(teamId) ?? []).map((r) => r.recruitId),
        );
        const team = teamMetaById.get(teamId);
        if (team) {
          const coachRating = coachRatingByTeam.get(teamId) ?? 50;
          const candidates = pendingRecruitMeta
            .filter((r) => !existingRecruitIds.has(r.id))
            .map((r) => ({
              id: r.id,
              stars: r.stars,
              base: recruiting.computeBaseInterest(
                {
                  stars: r.stars as 1 | 2 | 3 | 4 | 5,
                  hometownRegion: r.hometownRegion ?? 'CENTRAL',
                },
                {
                  teamId,
                  prestige: team.prestige,
                  region: team.region,
                  coachRatingRecruit: coachRating,
                  commitsAtPosition: 0,
                },
              ),
            }))
            .filter((c) => c.base > 0)
            // Prefer high-star replenishments for the same reason the
            // main AI loop uses stars-first priority.
            .sort(
              (a, b) =>
                b.stars - a.stars || b.base - a.base || a.id.localeCompare(b.id),
            );
          const needed = AI_TOP_N - rows.length;
          for (const c of candidates.slice(0, needed)) {
            creates.push({ recruitId: c.id, teamId, interest: c.base });
            // Synthetic row for this-week tick (id unknown pre-insert;
            // tracked in creates list + will be ticked below by the base delta).
          }
        }
      }

      rows = rows.slice(0, AI_TOP_N);
      const coachRating = coachRatingByTeam.get(teamId) ?? 50;
      const team = teamMetaById.get(teamId);
      const prestige = team?.prestige ?? 55;
      // Scale AI tick by both coach AND prestige so blue-blood programs
      // outpace mid-majors in interest growth.
      const scale = (coachRating / 100) * (prestige / 60);
      const localRng = aiRng.fork(teamId);

      for (const r of rows) {
        const jitter = 0.8 + localRng.next() * 0.4;
        const delta = Math.round(aiBaseDelta * scale * jitter);
        const next = Math.min(recruiting.MAX_INTEREST, r.interest + delta);
        updates.push({ id: r.id, interest: next, actionsSpent: r.actionsSpent + 1 });
        aiActionsApplied += 1;
      }
    }

    // Bulk write. Creates first (freshly-replenished rows, interest already
    // encodes base + implicit tick), then updates for existing rows.
    if (creates.length > 0) {
      const CHUNK = 500;
      for (let off = 0; off < creates.length; off += CHUNK) {
        await client.recruitInterest.createMany({
          data: creates.slice(off, off + CHUNK).map((c) => ({
            recruitId: c.recruitId,
            teamId: c.teamId,
            interest: c.interest,
            actionsSpent: 1,
          })),
        });
        aiActionsApplied += creates.slice(off, off + CHUNK).length;
      }
    }
    if (updates.length > 0) {
      await client.$transaction(
        updates.map((u) =>
          client.recruitInterest.update({
            where: { id: u.id },
            data: { interest: u.interest, actionsSpent: u.actionsSpent },
          }),
        ),
      );
    }

    // ─── 2. Commit resolution ───
    const commitRng = rootRng.fork('commit');

    const pendingRecruits = await client.recruit.findMany({
      where: { commitState: 'PENDING', seasonYear: season.year },
      select: { id: true, stars: true },
    });

    // Commit resolution also runs as direct client calls. Each commit
    // is atomic at the row level; no cross-row invariant needs wrapping.
    let commitsResolved = 0;

    for (const rec of pendingRecruits) {
      const interests = await client.recruitInterest.findMany({
        where: { recruitId: rec.id },
        select: { teamId: true, interest: true },
      });
      if (interests.length === 0) continue;
      const maxInterest = interests.reduce(
        (m, r) => (r.interest > m ? r.interest : m),
        0,
      );
      if (!recruiting.shouldDecide(week, rec.stars as 1 | 2 | 3 | 4 | 5, maxInterest)) {
        continue;
      }
      const localRng = commitRng.fork(rec.id);
      const picked = recruiting.pickCommittingTeam(localRng, interests);
      if (!picked) continue;
      await client.recruit.update({
        where: { id: rec.id },
        data: {
          commitState: 'COMMITTED',
          commitTeamId: picked,
          committedAtWeek: week,
        },
      });
      commitsResolved += 1;
    }

    // ─── 3. Advance week counter ───
    await client.season.update({
      where: { id: season.id },
      data: { recruitingWeek: week + 1 },
    });

    return { week, aiActionsApplied, commitsResolved };
  } finally {
    await client.$disconnect();
  }
}
