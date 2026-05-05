// Sprint 11: advance a single tournament round.
//
// Loads all unplayed matches with the given tournamentRound, dispatches to
// the worker pool (same pattern as advanceWeek), persists results
// atomically, then generates the next round's Match rows by pairing
// winners within each bracketGroupKey by bracketSlot (matches 2i and 2i+1
// pair to form next-round match i). The Final Four is special-cased: it
// pairs E8 winners across regions by FF_REGION_PAIRS.

import { PrismaClient } from '@prisma/client';
import { sim, tournament, type seasonIpc } from '@vcd/shared';
import * as pbpCodec from '@vcd/shared/sim/pbpCodec';
import { lineupFromTeam } from '../match/lineupFromTeam';
import { pickStartersForTeams, type StarterIds } from '../match/pickStarters';
import { SimWorkerPool } from '../season/workerPool';
import { computeSeasonAwards } from '../awards/computeSeasonAwards';

export type AdvanceTournamentRoundInput = {
  dbPath: string;
  pool: SimWorkerPool;
  round: tournament.TournamentRound;
  seed?: string;
};

export type AdvanceTournamentRoundResult =
  | { ok: true; round: tournament.TournamentRound; matchesPlayed: number; nextRoundCreated: number; championTeamId?: string }
  | { ok: false; code: 'NOT_FOUND' | 'INTERNAL'; message: string };

export async function advanceTournamentRound(
  input: AdvanceTournamentRoundInput,
): Promise<AdvanceTournamentRoundResult> {
  const client = new PrismaClient({ datasources: { db: { url: `file:${input.dbPath}` } } });
  try {
    const matches = await client.match.findMany({
      where: { tournamentRound: input.round, winnerId: null },
      include: { homeTeam: true, awayTeam: true },
      orderBy: [{ bracketGroupKey: 'asc' }, { bracketSlot: 'asc' }],
    });

    if (matches.length === 0) {
      return {
        ok: false,
        code: 'NOT_FOUND',
        message: `No unplayed matches for round ${input.round}.`,
      };
    }

    const seed = input.seed ?? `postseason:${input.round}`;

    // Sprint 18: pick starters per team before sim dispatch (one bulk roster
    // query) so PlayerMatchStat rows can be written at persistence time.
    const teamIds = Array.from(new Set(matches.flatMap((m) => [m.homeTeamId, m.awayTeamId])));
    const startersByTeamId = await pickStartersForTeams(client, teamIds);
    const startersByMatchId = new Map<string, { home: StarterIds; away: StarterIds }>();
    for (const m of matches) {
      const homeIds = startersByTeamId.get(m.homeTeamId);
      const awayIds = startersByTeamId.get(m.awayTeamId);
      if (!homeIds || !awayIds) {
        return {
          ok: false,
          code: 'INTERNAL',
          message: `Could not pick starters for match ${m.id}`,
        };
      }
      startersByMatchId.set(m.id, { home: homeIds, away: awayIds });
    }

    const responses: seasonIpc.WorkerSimResponse[] = [];
    let completed = 0;
    const promises = matches.map((m, idx) => {
      const home = lineupFromTeam(
        { id: m.homeTeam.id, abbr: m.homeTeam.abbr, prestige: m.homeTeam.prestige },
        `${seed}:${idx}`,
        'home',
      );
      const away = lineupFromTeam(
        { id: m.awayTeam.id, abbr: m.awayTeam.abbr, prestige: m.awayTeam.prestige },
        `${seed}:${idx}`,
        'away',
      );
      return input.pool
        .submit({
          matchId: m.id,
          homeTeamId: m.homeTeamId,
          awayTeamId: m.awayTeamId,
          homeLineup: home,
          awayLineup: away,
          seed: `${seed}:${idx}`,
        })
        .then((res) => {
          responses.push(res);
          completed += 1;
          return res;
        });
    });
    await Promise.all(promises);

    const errors = responses.filter((r) => !r.ok);
    if (errors.length > 0) {
      return {
        ok: false,
        code: 'INTERNAL',
        message: `${errors.length} worker(s) reported errors.`,
      };
    }

    const next = tournament.nextRound(input.round);

    // Build next-round Match rows from winners.
    type NextSpec = {
      homeTeamId: string;
      awayTeamId: string;
      tournamentRound: tournament.TournamentRound;
      bracketSlot: number;
      bracketGroupKey: string;
      week: number;
      date: Date;
    };
    const nextRoundSpecs: NextSpec[] = [];
    let championTeamId: string | undefined;

    if (next) {
      const winnerByMatchId = new Map<string, string>();
      for (const r of responses) {
        if (r.ok) winnerByMatchId.set(r.matchId, r.winnerId);
      }

      // Group current-round matches by bracketGroupKey (conf id for CT,
      // region key for NCAA R64..E8, 'NCAA' for FF/CHAMP). For CT and
      // NCAA regional rounds, pair by bracketSlot 2i / 2i+1.
      const byGroup = new Map<string, typeof matches>();
      for (const m of matches) {
        const key = m.bracketGroupKey ?? '';
        let list = byGroup.get(key);
        if (!list) {
          list = [];
          byGroup.set(key, list);
        }
        list.push(m);
      }

      const nextRoundWeek = weekForRound(next);
      const nextRoundDate = dateForRound(next);

      if (input.round === 'NCAA_E8') {
        // Elite 8 → Final Four. Pair E8 winners across regions by
        // FF_REGION_PAIRS. There are exactly 4 E8 matches, one per region.
        const winnerByRegion = new Map<string, string>();
        for (const m of matches) {
          const w = winnerByMatchId.get(m.id);
          if (w && m.bracketGroupKey) winnerByRegion.set(m.bracketGroupKey, w);
        }
        tournament.FF_REGION_PAIRS.forEach(([rA, rB], slot) => {
          const wA = winnerByRegion.get(rA);
          const wB = winnerByRegion.get(rB);
          if (!wA || !wB) return;
          nextRoundSpecs.push({
            homeTeamId: wA,
            awayTeamId: wB,
            tournamentRound: next,
            bracketSlot: slot,
            bracketGroupKey: tournament.NCAA_GLOBAL_GROUP,
            week: nextRoundWeek,
            date: nextRoundDate,
          });
        });
      } else {
        // Generic "pair matches 2i and 2i+1 within each group" logic.
        for (const [groupKey, list] of byGroup) {
          const sorted = list.slice().sort((a, b) => (a.bracketSlot ?? 0) - (b.bracketSlot ?? 0));
          for (let i = 0; i + 1 < sorted.length; i += 2) {
            const a = sorted[i]!;
            const b = sorted[i + 1]!;
            const wa = winnerByMatchId.get(a.id);
            const wb = winnerByMatchId.get(b.id);
            if (!wa || !wb) continue;
            // For NCAA regional rounds the next round's group key stays as
            // the region until E8; beyond that (handled above) it switches
            // to NCAA_GLOBAL_GROUP.
            const nextGroupKey =
              next === 'NCAA_CHAMP' ? tournament.NCAA_GLOBAL_GROUP : groupKey;
            nextRoundSpecs.push({
              homeTeamId: wa,
              awayTeamId: wb,
              tournamentRound: next,
              bracketSlot: Math.floor(i / 2),
              bracketGroupKey: nextGroupKey,
              week: nextRoundWeek,
              date: nextRoundDate,
            });
          }
        }
      }
    } else {
      // Terminal round (CT_F or NCAA_CHAMP). No next round. If this is the
      // NCAA_CHAMP, capture the champion team.
      if (input.round === 'NCAA_CHAMP') {
        const r = responses.find((rr) => rr.ok);
        if (r && r.ok) championTeamId = r.winnerId;
      }
    }

    await client.$transaction(
      async (tx) => {
        for (const r of responses) {
          if (!r.ok) continue;
          // Sprint 23: gzip + base64 PBP at the worker→DB boundary.
          const encoded = pbpCodec.encodePbpJsonString(r.pbpJson);
          await tx.match.update({
            where: { id: r.matchId },
            data: {
              winnerId: r.winnerId,
              pbpJson: encoded.payload,
              pbpEncoding: encoded.encoding,
              boxScoreJson: JSON.stringify(r.boxScore),
              timelineJson: JSON.stringify(r.timeline),
            },
          });
          await tx.set.deleteMany({ where: { matchId: r.matchId } });
          for (let i = 0; i < r.setScores.length; i++) {
            const s = r.setScores[i]!;
            await tx.set.create({
              data: {
                matchId: r.matchId,
                index: i,
                home: s.home,
                away: s.away,
                durationSec: 1200,
              },
            });
          }
          // Sprint 18: per-player stat rows. Idempotent re-run replaces.
          await tx.playerMatchStat.deleteMany({ where: { matchId: r.matchId } });
          const ids = startersByMatchId.get(r.matchId);
          if (ids) {
            await tx.playerMatchStat.createMany({
              data: sim.buildPlayerMatchStatRows({
                matchId: r.matchId,
                homePlayerIds: ids.home,
                awayPlayerIds: ids.away,
                boxScore: r.boxScore,
              }),
            });
          }
        }
        // Create next-round rows.
        for (const spec of nextRoundSpecs) {
          await tx.match.create({
            data: {
              homeTeamId: spec.homeTeamId,
              awayTeamId: spec.awayTeamId,
              date: spec.date,
              week: spec.week,
              isConference: tournament.isCtRound(spec.tournamentRound),
              isTournament: true,
              isNeutralSite: true,
              tournamentRound: spec.tournamentRound,
              bracketSlot: spec.bracketSlot,
              bracketGroupKey: spec.bracketGroupKey,
            },
          });
        }
        // Terminal round updates.
        if (championTeamId) {
          const season = await tx.season.findFirst({ orderBy: { year: 'desc' } });
          if (season) {
            // Sprint 18: compute AA awards inside the same transaction as the
            // NCAA_CHAMP transition. Idempotent: skips if Award rows already
            // exist for this seasonYear.
            await computeSeasonAwards(tx, season.year);
            // Sprint 37 (Task 37.5b): rolled back the Sprint 31 retro
            // auto-open-portal-after-NCAA_CHAMP. Per Sprint 33, phase
            // management belongs to `advanceOffseasonEvent` exclusively —
            // closing the championship game transitions phase to OFFSEASON,
            // and the user walks the offseason event sequence (which opens
            // portal at PLAYERS_TRANSFERRING).
            await tx.season.update({
              where: { id: season.id },
              data: {
                nationalChampionTeamId: championTeamId,
                phase: 'OFFSEASON',
              },
            });
          }
        }
      },
      { maxWait: 30_000, timeout: 60_000 },
    );

    return {
      ok: true,
      round: input.round,
      matchesPlayed: completed,
      nextRoundCreated: nextRoundSpecs.length,
      ...(championTeamId ? { championTeamId } : {}),
    };
  } finally {
    await client.$disconnect();
  }
}

function weekForRound(r: tournament.TournamentRound): number {
  switch (r) {
    case 'CT_R1': return 14;
    case 'CT_SF': return 15;
    case 'CT_F': return 16;
    case 'NCAA_R64': return 17;
    case 'NCAA_R32': return 18;
    case 'NCAA_S16': return 19;
    case 'NCAA_E8': return 20;
    case 'NCAA_FF': return 21;
    case 'NCAA_CHAMP': return 22;
  }
}

function dateForRound(r: tournament.TournamentRound): Date {
  const base = new Date('2026-11-25T00:00:00.000Z');
  return new Date(base.getTime() + weekForRound(r) * 24 * 60 * 60 * 1000);
}
