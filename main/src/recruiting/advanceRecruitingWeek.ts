// Sprint 13: advance one week of the recruiting cycle.
// Sprint 37 Task 37.2: per-tick interest recompute. Each AI tick now:
//   1. Pre-loads recruit priorities + team attribute levels once.
//   2. Recomputes BASE interest from priorities × levels per (team, recruit).
//   3. Persists `earnedPoints` (cumulative action delta) + `interest = base + earnedPoints`.
//   4. Mid-cycle attribute changes (facilitiesLevel bump) reflect on the
//      next tick because base is recomputed live.
//
// Flow:
//   1. AI tick: for every team (except user team), apply a HOME_VISIT-equivalent
//      delta to the top-10 recruits on their board.
//   2. Commit check: for every PENDING recruit, gather their RecruitInterest
//      rows; if shouldDecide fires, run pickCommittingTeam.
//   3. Increment Season.recruitingWeek.

import { PrismaClient } from '@prisma/client';
import { createRng, recruiting, coaching } from '@vcd/shared';
import { planNilAllocation } from './aiPicks';
import { loadHcChampionships } from './championships';

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
    // Sprint 33: phase check removed. Recruiting now runs inside the
    // OFFSEASON event sequence (RECRUITING_1/2/3 events), so callers
    // are in OFFSEASON when this fires. The orchestrator (`advanceOffseasonEvent`)
    // is the only legitimate caller.
    const week = season.recruitingWeek;

    // Load coaches by team to scale AI deltas (Sprint 17: role-aware).
    // Sprint 37: also include `id`, `hometownState`, `hireSeason` for
    // pitch-reasons (CoachConnection + CoachPedigree).
    const coaches = await client.coach.findMany({
      where: { teamId: { not: null } },
      select: {
        id: true,
        teamId: true,
        role: true,
        ratingRecruit: true,
        ratingDevelop: true,
        ratingStrategy: true,
        hometownState: true,
        hireSeason: true,
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

    // Precompute metadata once. Sprint 37: also load priorities +
    // wantsToLeaveHome (Sprint 35) and facilitiesLevel + academicsLevel
    // (Sprint 32/35) so per-tick recompute uses live team attributes
    // and per-recruit priorities.
    const pendingRecruitMeta = await client.recruit.findMany({
      where: { commitState: 'PENDING', seasonYear: season.year },
      select: {
        id: true,
        stars: true,
        hometownRegion: true,
        hometownState: true,
        prioritiesJson: true,
        wantsToLeaveHome: true,
      },
    });
    const teamsMeta = await client.team.findMany({
      select: {
        id: true,
        prestige: true,
        region: true,
        facilitiesLevel: true,
        academicsLevel: true,
      },
    });
    const teamMetaById = new Map(teamsMeta.map((t) => [t.id, t]));

    // Sprint 37: parse per-recruit priorities once. Falls back to the
    // synthesized neutral default inside `computeRecruitTeamInterestScaled`
    // if the JSON is missing/invalid (legacy save rows).
    const recruitPriorities = new Map<string, recruiting.RecruitPriorities>();
    const recruitWantsToLeaveHome = new Map<string, boolean>();
    for (const r of pendingRecruitMeta) {
      if (r.prioritiesJson) {
        try {
          recruitPriorities.set(
            r.id,
            JSON.parse(r.prioritiesJson) as recruiting.RecruitPriorities,
          );
        } catch {
          // Bad JSON: leave map empty so default kicks in.
        }
      }
      recruitWantsToLeaveHome.set(r.id, r.wantsToLeaveHome);
    }

    // Sprint 37 Task 37.3: pre-compute championship history per team
    // (CoachPedigree pitch reason). Bulk-load nat champs + conf champs
    // and group in memory rather than 360 per-team queries.
    const allNatChamps = await client.season.findMany({
      where: { nationalChampionTeamId: { not: null } },
      select: { nationalChampionTeamId: true, year: true },
    });
    const allConfChamps = await client.match.findMany({
      where: { tournamentRound: 'CT_F', winnerId: { not: null } },
      select: { winnerId: true, date: true },
    });
    const hcByTeam = new Map<string, { id: string; hireSeason: number }>();
    for (const c of coaches) {
      if (c.role === 'HC' && c.teamId) {
        hcByTeam.set(c.teamId, { id: c.id, hireSeason: c.hireSeason });
      }
    }
    const championshipsByTeam = new Map<string, recruiting.ChampionshipsHistory>();
    for (const teamId of teamIds) {
      const hc = hcByTeam.get(teamId);
      if (!hc) continue;
      const hireDateLowerBound = new Date(`${hc.hireSeason}-08-01T00:00:00Z`);
      const natYears: number[] = [];
      for (const s of allNatChamps) {
        if (s.nationalChampionTeamId === teamId && s.year >= hc.hireSeason) {
          natYears.push(s.year);
        }
      }
      const confYears: number[] = [];
      for (const m of allConfChamps) {
        if (m.winnerId === teamId && m.date >= hireDateLowerBound) {
          confYears.push(m.date.getUTCFullYear());
        }
      }
      championshipsByTeam.set(teamId, {
        coachId: hc.id,
        nationalChampYears: natYears,
        confChampYears: confYears,
      });
    }
    // Touch loadHcChampionships to satisfy the import (kept available
    // for IPC handlers that build per-recruit detail without prebuilt
    // bulk data).
    void loadHcChampionships;

    // Sprint 37: helper to compute live BASE interest for a (team, recruit)
    // pair. Used for both AI-tick recompute (interest = base + earnedPoints)
    // and replenishment seeding (interest = base, earnedPoints = 0).
    //
    // Sprint 37 Task 37.3: pitch-reason points are added in too. AI teams
    // therefore enjoy the same CoachPedigree + CoachConnection bonuses
    // that the user-facing modal will display in Task 37.4.
    const computeBase = (
      teamId: string,
      r: {
        id: string;
        stars: number;
        hometownRegion: string | null;
        hometownState?: string | null;
      },
    ): number => {
      const team = teamMetaById.get(teamId);
      if (!team) return 0;
      const coachRating = coachRatingByTeam.get(teamId) ?? 50;
      const opts: NonNullable<
        Parameters<typeof recruiting.computeRecruitTeamInterestScaled>[2]
      > = {
        facilitiesLevel: team.facilitiesLevel,
        academicsLevel: team.academicsLevel,
      };
      const priorities = recruitPriorities.get(r.id);
      if (priorities) opts.priorities = priorities;
      const wlh = recruitWantsToLeaveHome.get(r.id);
      if (wlh !== undefined) opts.wantsToLeaveHome = wlh;

      // Pitch-reason bonus (Sprint 37 Task 37.3). Skip if no hometownState
      // (legacy backfill rows): pitch points just stay 0 in that case.
      if (r.hometownState) {
        const teamCoaches = coachesByTeam.get(teamId) ?? [];
        const hcChamps = championshipsByTeam.get(teamId) ?? null;
        const pitch = recruiting.computePitchReasons({
          team: { id: teamId, region: team.region },
          coaches: teamCoaches.map((c) => ({
            id: c.id,
            role: c.role as 'HC' | 'AHC' | 'AC',
            hometownState: c.hometownState,
          })),
          hcChampionships: hcChamps,
          recruit: {
            id: r.id,
            stars: r.stars,
            hometownState: r.hometownState,
            hometownRegion: r.hometownRegion ?? 'CENTRAL',
          },
        });
        opts.pitchBonusPoints = pitch.totalActivePoints;
      }

      return recruiting.computeRecruitTeamInterestScaled(
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
        opts,
      );
    };

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
    // Sprint 37: each row writes BOTH `interest` (= base + earnedPoints,
    // recomputed live each tick) and `earnedPoints` (cumulative action
    // delta).
    type UpdateSpec = {
      id: string;
      interest: number;
      earnedPoints: number;
      actionsSpent: number;
    };
    type CreateSpec = {
      recruitId: string;
      teamId: string;
      interest: number;
      earnedPoints: number;
    };
    const updates: UpdateSpec[] = [];
    const creates: CreateSpec[] = [];

    for (const teamId of teamIds) {
      // Sprint 37: re-rank existing rows by LIVE interest (= base +
      // earnedPoints) before picking the top-N. Stale stored interest
      // (e.g. before a facilitiesLevel bump) would otherwise mis-order.
      const teamRows = (interestsByTeam.get(teamId) ?? [])
        .filter((r) => pendingIdSet.has(r.recruitId))
        .map((r) => {
          const meta = pendingRecruitMeta.find((m) => m.id === r.recruitId);
          const stars = meta?.stars ?? 3;
          const hometownRegion = meta?.hometownRegion ?? 'CENTRAL';
          const liveBase = computeBase(teamId, {
            id: r.recruitId,
            stars,
            hometownRegion,
            hometownState: meta?.hometownState ?? null,
          });
          const liveInterest = Math.max(
            0,
            Math.min(recruiting.MAX_INTEREST, liveBase + r.earnedPoints),
          );
          return { ...r, _liveBase: liveBase, _liveInterest: liveInterest };
        })
        // AI priority = stars desc, then live interest desc.
        .sort((a, b) => {
          const starA = recruitStarsById.get(a.recruitId) ?? 0;
          const starB = recruitStarsById.get(b.recruitId) ?? 0;
          if (starA !== starB) return starB - starA;
          return b._liveInterest - a._liveInterest;
        });
      let rows = teamRows.slice();

      if (rows.length < AI_TOP_N) {
        const existingRecruitIds = new Set(
          (interestsByTeam.get(teamId) ?? []).map((r) => r.recruitId),
        );
        const team = teamMetaById.get(teamId);
        if (team) {
          const candidates = pendingRecruitMeta
            .filter((r) => !existingRecruitIds.has(r.id))
            .map((r) => ({
              id: r.id,
              stars: r.stars,
              base: computeBase(teamId, {
                id: r.id,
                stars: r.stars,
                hometownRegion: r.hometownRegion,
                hometownState: r.hometownState,
              }),
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
            // New row: interest = base, earnedPoints = 0. The same-tick
            // AI delta is applied below via a synthetic UpdateSpec? — no,
            // creates already get the raw base; the next tick applies AI.
            creates.push({
              recruitId: c.id,
              teamId,
              interest: c.base,
              earnedPoints: 0,
            });
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
        // Sprint 37: earnedPoints accrues the delta; interest is rebuilt
        // from the LIVE base + earnedPoints so any team-attribute change
        // since the last tick is reflected.
        const newEarnedPoints = r.earnedPoints + delta;
        const newInterest = Math.max(
          0,
          Math.min(recruiting.MAX_INTEREST, r._liveBase + newEarnedPoints),
        );
        updates.push({
          id: r.id,
          interest: newInterest,
          earnedPoints: newEarnedPoints,
          actionsSpent: r.actionsSpent + 1,
        });
        aiActionsApplied += 1;
      }
    }

    // Bulk write. Creates first (freshly-replenished rows, interest = base,
    // earnedPoints = 0). Then updates for existing rows.
    if (creates.length > 0) {
      const CHUNK = 500;
      for (let off = 0; off < creates.length; off += CHUNK) {
        await client.recruitInterest.createMany({
          data: creates.slice(off, off + CHUNK).map((c) => ({
            recruitId: c.recruitId,
            teamId: c.teamId,
            interest: c.interest,
            earnedPoints: c.earnedPoints,
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
            data: {
              interest: u.interest,
              earnedPoints: u.earnedPoints,
              actionsSpent: u.actionsSpent,
            },
          }),
        ),
      );
    }

    // ─── 1.5. Sprint 36: AI NIL allocation ───
    // Run once at the half-cycle mark (week 6) so AI teams' NIL bonuses
    // factor into commit resolution. Trailing teams over-allocate to a
    // moonshot target; competitive teams spread proportional to headroom.
    if (week === 6) {
      const aiTeamIds = teamIds; // already excludes user team
      // Compute a global "leader interest" for trailing detection: max
      // of any team's #1-board recruit interest.
      let leaderInterest = 0;
      for (const tid of aiTeamIds) {
        const top = (interestsByTeam.get(tid) ?? [])[0];
        if (top && top.interest > leaderInterest) leaderInterest = top.interest;
      }
      // Pre-load each AI team's nil budget + used.
      const teamsBudget = await client.team.findMany({
        where: { id: { in: aiTeamIds } },
        select: { id: true, nilBudgetCents: true, nilBudgetUsedCents: true },
      });
      const budgetById = new Map(teamsBudget.map((t) => [t.id, t]));

      // Star lookup already exists in `recruitStarsById`. Build a
      // baseline-NIL lookup using the existing nil helper.
      const nilWrites: Array<{
        recruitId: string;
        teamId: string;
        offerCents: number;
        delta: number;
      }> = [];

      for (const tid of aiTeamIds) {
        const budget = budgetById.get(tid);
        if (!budget) continue;
        const remaining = budget.nilBudgetCents - budget.nilBudgetUsedCents;
        if (remaining <= 0) continue;
        const teamRows = (interestsByTeam.get(tid) ?? []).slice(0, 10);
        if (teamRows.length === 0) continue;
        const top = teamRows.map((r) => {
          const stars = recruitStarsById.get(r.recruitId) ?? 3;
          return {
            recruitId: r.recruitId,
            stars,
            currentInterest: r.interest,
            baselineNilCents: recruiting.getNilOfferBaselineCents({ stars }),
          };
        });
        const plans = planNilAllocation({
          teamId: tid,
          nilBudgetCents: budget.nilBudgetCents,
          nilBudgetUsedCents: budget.nilBudgetUsedCents,
          topRecruits: top,
          leaderInterest,
        });
        let usedDelta = 0;
        for (const p of plans) {
          if (p.newOfferCents <= 0) continue;
          if (usedDelta + p.newOfferCents > remaining) break; // budget exhausted
          nilWrites.push({
            recruitId: p.recruitId,
            teamId: tid,
            offerCents: p.newOfferCents,
            delta: p.newOfferCents,
          });
          usedDelta += p.newOfferCents;
        }
      }

      if (nilWrites.length > 0) {
        // Update RecruitInterest.nilOfferCents in batches.
        const CHUNK = 200;
        for (let off = 0; off < nilWrites.length; off += CHUNK) {
          const slice = nilWrites.slice(off, off + CHUNK);
          await client.$transaction(
            slice.map((w) =>
              client.recruitInterest.updateMany({
                where: { recruitId: w.recruitId, teamId: w.teamId },
                data: { nilOfferCents: w.offerCents },
              }),
            ),
          );
        }
        // Update Team.nilBudgetUsedCents in one tx per team.
        const usedByTeam = new Map<string, number>();
        for (const w of nilWrites) {
          usedByTeam.set(w.teamId, (usedByTeam.get(w.teamId) ?? 0) + w.delta);
        }
        await client.$transaction(
          Array.from(usedByTeam.entries()).map(([teamId, addCents]) => {
            const budget = budgetById.get(teamId)!;
            return client.team.update({
              where: { id: teamId },
              data: { nilBudgetUsedCents: budget.nilBudgetUsedCents + addCents },
            });
          }),
        );
      }
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
