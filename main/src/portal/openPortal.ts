// Sprint 14: open the transfer portal. Computes entry probability for
// every player, creates TransferPortal rows for entrants, seeds initial
// PortalInterest for each team.

import { PrismaClient } from '@prisma/client';
import { createRng, portal, recruiting, coaching } from '@vcd/shared';
import { ratingsAverage } from './ratingsAverage';

export type OpenPortalInput = {
  dbPath: string;
  seed?: string;
};

export type OpenPortalResult = {
  entrants: number;
  interestsSeeded: number;
};

const DEFAULT_BOARD_PER_TEAM = 15;

export async function openPortal(input: OpenPortalInput): Promise<OpenPortalResult> {
  const client = new PrismaClient({ datasources: { db: { url: `file:${input.dbPath}` } } });
  try {
    const [players, teams, coaches, season, nilAggregates] = await Promise.all([
      client.player.findMany(),
      client.team.findMany({ select: { id: true, prestige: true, region: true } }),
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
      client.season.findFirst({ orderBy: { year: 'desc' } }),
      // Sprint 15: aggregate NIL value per player.
      client.nilDeal.groupBy({
        by: ['playerId'],
        _sum: { amount: true },
      }),
    ]);
    if (!season) throw new Error('No Season row.');

    const nilByPlayer = new Map<string, number>();
    for (const row of nilAggregates) {
      nilByPlayer.set(row.playerId, row._sum.amount ?? 0);
    }

    // Compute depth rank per (teamId, position). Players sorted by overall desc.
    const teamById = new Map(teams.map((t) => [t.id, t]));
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

    // Group players by (teamId, position).
    const depthKey = (teamId: string, position: string) => `${teamId}|${position}`;
    const groups = new Map<string, typeof players>();
    for (const p of players) {
      const key = depthKey(p.teamId, p.position);
      let list = groups.get(key);
      if (!list) {
        list = [];
        groups.set(key, list);
      }
      list.push(p);
    }
    for (const list of groups.values()) {
      list.sort((a, b) => ratingsAverage(b) - ratingsAverage(a));
    }
    const depthRankById = new Map<string, number>();
    for (const list of groups.values()) {
      list.forEach((p, i) => depthRankById.set(p.id, i + 1));
    }

    const rootRng = createRng(input.seed ?? `portal:${season.year}`);

    // 1. Determine entrants.
    const entrantIds: string[] = [];
    for (const p of players) {
      const team = teamById.get(p.teamId);
      if (!team) continue;
      const rank = depthRankById.get(p.id) ?? 1;
      const probRng = rootRng.fork(`prob:${p.id}`);
      const drawRng = rootRng.fork(`draw:${p.id}`);
      const prob = portal.computePortalEntryProbability(
        {
          overall: ratingsAverage(p),
          classYear: p.classYear as 'FR' | 'SO' | 'JR' | 'SR' | 'GR',
          position: p.position,
          nilValueCents: nilByPlayer.get(p.id) ?? 0,
        },
        { prestige: team.prestige },
        { depthRank: rank },
        probRng,
      );
      if (portal.didPlayerEnterPortal(drawRng, prob)) {
        entrantIds.push(p.id);
      }
    }

    // 2. Create TransferPortal rows + seed PortalInterest per team.
    const entrants = players.filter((p) => entrantIds.includes(p.id));

    let interestsSeeded = 0;
    await client.$transaction(
      async (tx) => {
        // Idempotent regen.
        await tx.portalInterest.deleteMany();
        await tx.portalBudget.deleteMany();
        await tx.transferPortal.deleteMany();

        for (const p of entrants) {
          const tp = await tx.transferPortal.create({
            data: {
              playerId: p.id,
              reasonCode: inferReasonCode(p, depthRankById.get(p.id) ?? 1),
              enteredDate: new Date(),
              status: 'ACTIVE',
              enteredAtWeek: 1,
            },
          });

          // Seed initial interest for every team (minus the origin team)
          // whose computed baseInterest is high enough to board.
          // Per-team board cap DEFAULT_BOARD_PER_TEAM isn't enforced here;
          // every entrant has one row per interested team (could be all
          // 359 other teams). With ~10% of 4,320 players = ~430 entrants,
          // worst-case rows = 430 × 359 = ~154k. Too many. So: limit to
          // the top-20 teams per entrant by base interest.
          const scores = teams
            .filter((t) => t.id !== p.teamId)
            .map((t) => ({
              teamId: t.id,
              base: portal.computePortalBaseInterest(
                { overall: ratingsAverage(p) },
                {
                  teamId: t.id,
                  prestige: t.prestige,
                  coachRatingRecruit: coachRatingByTeam.get(t.id) ?? 50,
                },
              ),
            }))
            .sort((a, b) => b.base - a.base)
            .slice(0, DEFAULT_BOARD_PER_TEAM);

          for (const s of scores) {
            if (s.base <= 0) continue;
            await tx.portalInterest.create({
              data: {
                transferPortalId: tp.id,
                teamId: s.teamId,
                interest: s.base,
                actionsSpent: 0,
                lastNilOffer: 0,
              },
            });
            interestsSeeded += 1;
          }
        }

        await tx.season.update({
          where: { id: season.id },
          data: { phase: 'PORTAL', portalWeek: 1 },
        });
      },
      { maxWait: 30_000, timeout: 120_000 },
    );

    // Suppress noise about `recruiting` unused import (it is referenced
    // only through shared namespaces).
    void recruiting;

    return { entrants: entrants.length, interestsSeeded };
  } finally {
    await client.$disconnect();
  }
}

function inferReasonCode(
  p: { classYear: string; position: string },
  depthRank: number,
): string {
  if (depthRank >= 4) return 'PLAYING_TIME';
  if (p.classYear === 'FR') return 'FIT';
  return 'DEVELOPMENT';
}
