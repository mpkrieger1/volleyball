// Sprint 16: single atomic offseason transition.
//
// Steps (all in one $transaction):
//   1. For each team: compute per-player playing time from
//      PlayerMatchStat.rotationMinutes.
//   2. For each player: compute growth (developmentModel) + class advance.
//   3. Graduates → PlayerArchive; active returners → updated Player rows.
//   4. Enforce SCHOLARSHIP_CAP per team — cut the weakest.
//   5. Update Booster.enthusiasm from win% + tournament finish.
//   6. Season.phase → PRESEASON; Season.year + 1.

import { PrismaClient } from '@prisma/client';
import { createRng, offseason, coaching } from '@vcd/shared';
import { computeEnthusiasm, type TournamentFinish } from './boosterEnthusiasm';
import { pruneOldSeasons } from '../save/pruneOldSeasons';

// Sprint 23: how many seasons of full match data to retain. The current
// season + this many prior seasons remain replayable. Older non-tournament
// matches are deleted; older tournament matches keep metadata but lose
// PBP. This is the load-bearing knob for hitting PRD §3.5's save-file
// budget across long dynasties.
const DEFAULT_RETAIN_SEASONS = 1;
// Keep the last 3 graduating classes (≈3 × 1080 archive rows ≈ 3 MB).
// Older PlayerArchive rows are dropped; their final ratings + summaries
// are not recoverable but the active roster + recent careers remain.
const DEFAULT_RETAIN_ARCHIVE_YEARS = 3;

export type RunOffseasonInput = {
  dbPath: string;
  seed?: string;
};

export type RunOffseasonResult = {
  playersGraduated: number;
  playersCut: number;
  teamsUpdated: number;
  newSeasonYear: number;
};

type PlayerRow = {
  id: string;
  teamId: string;
  firstName: string;
  lastName: string;
  position: string;
  classYear: string;
  potential: number;
  redshirtUsed: boolean;
  ratingAttack: number;
  ratingBlock: number;
  ratingServe: number;
  ratingPass: number;
  ratingSet: number;
  ratingDig: number;
  ratingAthleticism: number;
  ratingIq: number;
  ratingStamina: number;
};

function ratingsOf(p: PlayerRow) {
  return {
    attack: p.ratingAttack,
    block: p.ratingBlock,
    serve: p.ratingServe,
    pass: p.ratingPass,
    set: p.ratingSet,
    dig: p.ratingDig,
    athleticism: p.ratingAthleticism,
    iq: p.ratingIq,
    stamina: p.ratingStamina,
  };
}

export async function runOffseason(input: RunOffseasonInput): Promise<RunOffseasonResult> {
  const client = new PrismaClient({ datasources: { db: { url: `file:${input.dbPath}` } } });
  try {
    const season = await client.season.findFirst({ orderBy: { year: 'desc' } });
    if (!season) throw new Error('No Season row.');
    const seasonYear = season.year;

    const [players, coaches, boosters, teams, matches, matchStats] = await Promise.all([
      client.player.findMany(),
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
      client.booster.findMany(),
      client.team.findMany({ select: { id: true } }),
      client.match.findMany({
        where: { winnerId: { not: null } },
        select: {
          id: true,
          homeTeamId: true,
          awayTeamId: true,
          winnerId: true,
          tournamentRound: true,
        },
      }),
      client.playerMatchStat.findMany({
        select: { playerId: true, rotationMinutes: true },
      }),
    ]);

    // Per-player total playing time.
    const minutesByPlayer = new Map<string, number>();
    for (const s of matchStats) {
      minutesByPlayer.set(s.playerId, (minutesByPlayer.get(s.playerId) ?? 0) + s.rotationMinutes);
    }

    // League max (per-team max, so play-time is normalized within team).
    const maxMinutesByTeam = new Map<string, number>();
    for (const p of players) {
      const m = minutesByPlayer.get(p.id) ?? 0;
      const cur = maxMinutesByTeam.get(p.teamId) ?? 0;
      if (m > cur) maxMinutesByTeam.set(p.teamId, m);
    }

    // Coach by team — development effect prefers HC.
    const coachesByTeam = new Map<string, typeof coaches>();
    for (const c of coaches) {
      if (!c.teamId) continue;
      const arr = coachesByTeam.get(c.teamId) ?? [];
      arr.push(c);
      coachesByTeam.set(c.teamId, arr);
    }
    const coachByTeam = new Map<string, number>();
    for (const [teamId, teamCoaches] of coachesByTeam) {
      coachByTeam.set(teamId, coaching.pickCoachRating(teamCoaches, 'development'));
    }

    // Win record + tournament finish per team.
    const winsByTeam = new Map<string, number>();
    const gamesByTeam = new Map<string, number>();
    const nationalChampionTeamId: string | null = season.nationalChampionTeamId ?? null;
    const finalFourTeams = new Set<string>();
    const madeBracketTeams = new Set<string>();
    for (const m of matches) {
      const loserId = m.winnerId === m.homeTeamId ? m.awayTeamId : m.homeTeamId;
      winsByTeam.set(m.winnerId!, (winsByTeam.get(m.winnerId!) ?? 0) + 1);
      gamesByTeam.set(m.winnerId!, (gamesByTeam.get(m.winnerId!) ?? 0) + 1);
      gamesByTeam.set(loserId, (gamesByTeam.get(loserId) ?? 0) + 1);
      if (m.tournamentRound === 'NCAA_FF') finalFourTeams.add(m.winnerId!).add(loserId);
      if (m.tournamentRound && m.tournamentRound.startsWith('NCAA_')) {
        madeBracketTeams.add(m.winnerId!);
        madeBracketTeams.add(loserId);
      }
    }

    const tournamentFinishFor = (teamId: string): TournamentFinish => {
      if (nationalChampionTeamId === teamId) return 'CHAMPION';
      if (finalFourTeams.has(teamId)) return 'FINAL_FOUR';
      if (madeBracketTeams.has(teamId)) return 'MADE_BRACKET';
      return 'NONE';
    };

    const rootRng = createRng(input.seed ?? `offseason:${seasonYear}`);

    // Plan per-player outcome.
    type UpdateSpec = {
      id: string;
      teamId: string;
      nextClassYear: string;
      newRatings: ReturnType<typeof ratingsOf>;
    };
    type ArchiveSpec = {
      originalPlayerId: string;
      firstName: string;
      lastName: string;
      position: string;
      finalTeamId: string;
      finalClassYear: string;
      finalRatingsJson: string;
      finalPotential: number;
      seasonRetired: number;
    };

    const updates: UpdateSpec[] = [];
    const archives: ArchiveSpec[] = [];

    for (const p of players as PlayerRow[]) {
      const playerRng = rootRng.fork(p.id);
      const advance = offseason.advanceClass({ classYear: p.classYear as offseason.ClassYear });

      if (advance.graduates) {
        archives.push({
          originalPlayerId: p.id,
          firstName: p.firstName,
          lastName: p.lastName,
          position: p.position,
          finalTeamId: p.teamId,
          finalClassYear: p.classYear,
          finalRatingsJson: JSON.stringify(ratingsOf(p)),
          finalPotential: p.potential,
          seasonRetired: seasonYear,
        });
        continue;
      }

      const maxMin = Math.max(1, maxMinutesByTeam.get(p.teamId) ?? 1);
      const minutes = minutesByPlayer.get(p.id) ?? 0;
      const playTime = minutes / maxMin;
      const coachRating = coachByTeam.get(p.teamId) ?? 50;

      const newRatings = offseason.computePlayerGrowth(
        {
          ratings: ratingsOf(p),
          potential: p.potential,
          classYear: p.classYear as offseason.ClassYear,
          redshirtUsed: p.redshirtUsed,
        },
        { ratingDevelop: coachRating },
        playTime,
        playerRng,
      );

      updates.push({
        id: p.id,
        teamId: p.teamId,
        nextClassYear: advance.nextClassYear!,
        newRatings,
      });
    }

    // Enforce scholarship cap on post-advance + post-archive rosters.
    // Build per-team "kept" set; anyone NOT in kept gets cut (deleted, not
    // archived — they weren't graduating).
    const updatesByTeam = new Map<string, UpdateSpec[]>();
    for (const u of updates) {
      let list = updatesByTeam.get(u.teamId);
      if (!list) {
        list = [];
        updatesByTeam.set(u.teamId, list);
      }
      list.push(u);
    }
    const cutPlayerIds: string[] = [];
    for (const t of teams) {
      const list = updatesByTeam.get(t.id) ?? [];
      const withOverall = list.map((u) => {
        const r = u.newRatings;
        const overall = Math.round(
          (r.attack + r.block + r.serve + r.pass + r.set + r.dig + r.athleticism + r.iq + r.stamina) /
            9,
        );
        return { id: u.id, overall };
      });
      const cap = offseason.enforceScholarshipCap(withOverall);
      for (const c of cap.cut) cutPlayerIds.push(c.id);
    }
    const cutSet = new Set(cutPlayerIds);

    // Apply writes atomically.
    await client.$transaction(
      async (tx) => {
        // Sprint 23: PlayerMatchStat has a Player FK with no cascade rule.
        // Before deleting any Player row (graduated or cut), purge their PMS
        // rows. The PlayerArchive row preserves season summary; per-match
        // granular stats for graduated/cut players are not needed by analytics
        // (they aggregate from active rosters only). This is also the
        // load-bearing cleanup for the PRD save-size budget — without it,
        // PMS grows unbounded across seasons.
        const playersToDelete = [
          ...archives.map((a) => a.originalPlayerId),
          ...cutPlayerIds,
        ];
        if (playersToDelete.length > 0) {
          await tx.playerMatchStat.deleteMany({
            where: { playerId: { in: playersToDelete } },
          });
        }

        // Archive graduates.
        if (archives.length > 0) {
          const CHUNK = 500;
          for (let off = 0; off < archives.length; off += CHUNK) {
            await tx.playerArchive.createMany({
              data: archives.slice(off, off + CHUNK),
            });
          }
          await tx.player.deleteMany({
            where: { id: { in: archives.map((a) => a.originalPlayerId) } },
          });
        }

        // Cut players (deleted outright, not archived — they're not graduates).
        if (cutPlayerIds.length > 0) {
          await tx.player.deleteMany({ where: { id: { in: cutPlayerIds } } });
        }

        // Update kept returners. Reset redshirtLocked for new season.
        for (const u of updates) {
          if (cutSet.has(u.id)) continue;
          await tx.player.update({
            where: { id: u.id },
            data: {
              classYear: u.nextClassYear,
              redshirtLocked: false,
              ratingAttack: u.newRatings.attack,
              ratingBlock: u.newRatings.block,
              ratingServe: u.newRatings.serve,
              ratingPass: u.newRatings.pass,
              ratingSet: u.newRatings.set,
              ratingDig: u.newRatings.dig,
              ratingAthleticism: u.newRatings.athleticism,
              ratingIq: u.newRatings.iq,
              ratingStamina: u.newRatings.stamina,
            },
          });
        }

        // Update booster enthusiasm.
        for (const b of boosters) {
          const games = gamesByTeam.get(b.teamId) ?? 0;
          const wins = winsByTeam.get(b.teamId) ?? 0;
          const winPct = games > 0 ? wins / games : 0.5;
          const finish = tournamentFinishFor(b.teamId);
          const enthusiasm = computeEnthusiasm(winPct, finish);
          await tx.booster.update({
            where: { id: b.id },
            data: { enthusiasm },
          });
        }

        // Sprint 17: refresh hiring pool for the new season.
        await tx.coachingPool.deleteMany();
        const pool = coaching.generateHiringPool({
          seed: `pool:${seasonYear + 1}`,
          seasonYear: seasonYear + 1,
          size: 100,
        });
        await tx.coachingPool.createMany({
          data: pool.map((p) => ({
            firstName: p.firstName,
            lastName: p.lastName,
            ratingRecruit: p.ratingRecruit,
            ratingDevelop: p.ratingDevelop,
            ratingStrategy: p.ratingStrategy,
            askingSalaryCents: p.askingSalaryCents,
            preferredRole: p.preferredRole,
            ageYears: p.ageYears,
            seasonAvailable: p.seasonAvailable,
          })),
        });

        // Advance to PRESEASON of next year.
        await tx.season.update({
          where: { id: season.id },
          data: {
            phase: 'PRESEASON',
            year: seasonYear + 1,
            currentWeek: 0,
            recruitingWeek: 0,
            portalWeek: 0,
            nationalChampionTeamId: null,
          },
        });
      },
      { maxWait: 30_000, timeout: 180_000 },
    );

    // Sprint 23: prune old-season match data to keep save-file size bounded.
    // Runs OUTSIDE the offseason transaction so the deletes can chunk and
    // VACUUM can reclaim space without holding the offseason lock for minutes.
    const prune = await pruneOldSeasons(client, {
      currentYear: seasonYear + 1,
      retainSeasons: DEFAULT_RETAIN_SEASONS,
      retainArchiveYears: DEFAULT_RETAIN_ARCHIVE_YEARS,
    });
    const anyPruned =
      prune.matchesDeleted > 0 ||
      prune.tournamentMatchesNulled > 0 ||
      prune.archivesDeleted > 0;
    if (anyPruned) {
      // eslint-disable-next-line no-console
      console.log(
        `[offseason] pruned ${prune.matchesDeleted} regular + ${prune.tournamentMatchesNulled} tournament + ${prune.archivesDeleted} archives (cutoff ${prune.cutoffYear})`,
      );
      // SQLite leaves freed pages in the file until VACUUM rebuilds it.
      // VACUUM cannot run inside a transaction; we already exited above.
      await client.$executeRawUnsafe('VACUUM');
    }

    return {
      playersGraduated: archives.length,
      playersCut: cutPlayerIds.length,
      teamsUpdated: boosters.length,
      newSeasonYear: seasonYear + 1,
    };
  } finally {
    await client.$disconnect();
  }
}
