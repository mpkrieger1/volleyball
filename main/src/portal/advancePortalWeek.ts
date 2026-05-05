// Sprint 14: advance one week of the portal cycle.
//
// Flow (mirrors advanceRecruitingWeek after Sprint 13's batching fix):
//   1. AI ticks: for each team, apply CALL-equivalent delta to its top
//      portal targets (by current interest). Batched via array
//      $transaction. No interactive tx wrapping.
//   2. Commit resolution: for each ACTIVE portal entry, collect team
//      interests. If `shouldDecide` fires, pickCommittingTeam (interest^5)
//      selects the winner; TransferPortal.status='SIGNED', newTeamId set.
//   3. Increment Season.portalWeek.

import { PrismaClient } from '@prisma/client';
import { createRng, portal, recruiting, coaching } from '@vcd/shared';
import { ratingsAverage } from './ratingsAverage';

const AI_TOP_N = 8;

export type AdvancePortalWeekInput = {
  dbPath: string;
  userTeamId?: string | null;
  seed?: string;
};

export type AdvancePortalWeekResult = {
  week: number;
  aiActionsApplied: number;
  commitsResolved: number;
};

export async function advancePortalWeek(
  input: AdvancePortalWeekInput,
): Promise<AdvancePortalWeekResult> {
  const client = new PrismaClient({ datasources: { db: { url: `file:${input.dbPath}` } } });
  try {
    const season = await client.season.findFirst({ orderBy: { year: 'desc' } });
    if (!season) throw new Error('No Season row.');
    // Sprint 33: phase check removed. Portal now runs inside the
    // PLAYERS_TRANSFERRING event of the OFFSEASON sequence — caller is in
    // OFFSEASON phase but using portalWeek as the loop counter.
    const week = season.portalWeek;

    const [teams, coaches] = await Promise.all([
      client.team.findMany({ select: { id: true } }),
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
    const teamIds = teams
      .map((t) => t.id)
      .filter((id) => id !== input.userTeamId);
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

    const rootRng = createRng(input.seed ?? `portal-adv:${season.year}:${week}`);
    const aiRng = rootRng.fork('ai');

    const activeEntries = await client.transferPortal.findMany({
      where: { status: 'ACTIVE' },
      include: { player: true, interests: true },
    });
    const activeIdSet = new Set(activeEntries.map((e) => e.id));

    type InterestRow = {
      id: string;
      transferPortalId: string;
      teamId: string;
      interest: number;
      actionsSpent: number;
    };
    const interestsByTeam = new Map<string, InterestRow[]>();
    for (const e of activeEntries) {
      for (const i of e.interests) {
        if (!activeIdSet.has(i.transferPortalId)) continue;
        let list = interestsByTeam.get(i.teamId);
        if (!list) {
          list = [];
          interestsByTeam.set(i.teamId, list);
        }
        list.push(i);
      }
    }
    for (const list of interestsByTeam.values()) {
      list.sort((a, b) => b.interest - a.interest);
    }

    type UpdateSpec = { id: string; interest: number; actionsSpent: number };
    const updates: UpdateSpec[] = [];
    let aiActionsApplied = 0;
    const callDelta = portal.PORTAL_ACTIONS.CALL.delta;

    for (const teamId of teamIds) {
      const teamRows = (interestsByTeam.get(teamId) ?? []).slice(0, AI_TOP_N);
      if (teamRows.length === 0) continue;
      const coachRating = coachRatingByTeam.get(teamId) ?? 50;
      const localRng = aiRng.fork(teamId);
      const scale = coachRating / 100;

      for (const r of teamRows) {
        const jitter = 0.8 + localRng.next() * 0.4;
        const delta = Math.round(callDelta * scale * jitter);
        const next = Math.min(1000, r.interest + delta);
        updates.push({ id: r.id, interest: next, actionsSpent: r.actionsSpent + 1 });
        aiActionsApplied += 1;
      }
    }

    if (updates.length > 0) {
      await client.$transaction(
        updates.map((u) =>
          client.portalInterest.update({
            where: { id: u.id },
            data: { interest: u.interest, actionsSpent: u.actionsSpent },
          }),
        ),
      );
    }

    const commitRng = rootRng.fork('commit');
    let commitsResolved = 0;

    const latestEntries = await client.transferPortal.findMany({
      where: { status: 'ACTIVE' },
      include: { player: true, interests: true },
    });

    type UpdateCommitSpec = {
      transferPortalId: string;
      newTeamId: string;
      nilOfferAmount: number | null;
    };
    const commitWrites: UpdateCommitSpec[] = [];

    for (const e of latestEntries) {
      if (e.interests.length === 0) continue;
      const maxInterest = e.interests.reduce((m, r) => (r.interest > m ? r.interest : m), 0);
      const overall = ratingsAverage(e.player);
      const tier =
        overall >= 80 ? 5 : overall >= 72 ? 4 : overall >= 62 ? 3 : overall >= 52 ? 2 : 1;
      if (!recruiting.shouldDecide(week, tier as 1 | 2 | 3 | 4 | 5, maxInterest)) continue;

      const picked = recruiting.pickCommittingTeam(
        commitRng.fork(e.id),
        e.interests.map((i) => ({ teamId: i.teamId, interest: i.interest })),
      );
      if (!picked) continue;

      const nilFromWinner = e.interests.find((i) => i.teamId === picked)?.lastNilOffer ?? 0;
      commitWrites.push({
        transferPortalId: e.id,
        newTeamId: picked,
        nilOfferAmount: nilFromWinner > 0 ? nilFromWinner : null,
      });
      commitsResolved += 1;
    }

    if (commitWrites.length > 0) {
      await client.$transaction(
        commitWrites.map((c) =>
          client.transferPortal.update({
            where: { id: c.transferPortalId },
            data: {
              status: 'SIGNED',
              newTeamId: c.newTeamId,
              nilOfferAmount: c.nilOfferAmount,
            },
          }),
        ),
      );
    }

    await client.season.update({
      where: { id: season.id },
      data: { portalWeek: week + 1 },
    });

    return { week, aiActionsApplied, commitsResolved };
  } finally {
    await client.$disconnect();
  }
}
