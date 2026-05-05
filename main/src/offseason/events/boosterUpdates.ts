// Sprint 33 — BOOSTER_UPDATES event handler.
//
// Compute per-team enthusiasm from this season's win record + tournament
// finish. Extracted from runOffseason.ts:317-328 + the tournamentFinishFor
// resolver (137-160). Idempotent: enthusiasm is a deterministic function
// of the win record + finish, so re-runs produce the same value.
//
// MUST run BEFORE ADVANCE_YEAR — needs Match data from this season's year
// (which pruneOldSeasons in ADVANCE_YEAR removes for very old seasons).

import type { PrismaClient } from '@prisma/client';
import { computeEnthusiasm, type TournamentFinish } from '../boosterEnthusiasm';

export type BoosterUpdatesResult = {
  event: 'BOOSTER_UPDATES';
  teamsUpdated: number;
};

export async function boosterUpdates(
  client: PrismaClient,
  seasonYear: number,
): Promise<BoosterUpdatesResult> {
  const [season, matches, boosters] = await Promise.all([
    client.season.findFirst({ where: { year: seasonYear } }),
    client.match.findMany({
      where: { winnerId: { not: null } },
      select: {
        homeTeamId: true,
        awayTeamId: true,
        winnerId: true,
        tournamentRound: true,
      },
    }),
    client.booster.findMany(),
  ]);

  const winsByTeam = new Map<string, number>();
  const gamesByTeam = new Map<string, number>();
  const finalFour = new Set<string>();
  const madeBracket = new Set<string>();
  for (const m of matches) {
    const loserId = m.winnerId === m.homeTeamId ? m.awayTeamId : m.homeTeamId;
    winsByTeam.set(m.winnerId!, (winsByTeam.get(m.winnerId!) ?? 0) + 1);
    gamesByTeam.set(m.winnerId!, (gamesByTeam.get(m.winnerId!) ?? 0) + 1);
    gamesByTeam.set(loserId, (gamesByTeam.get(loserId) ?? 0) + 1);
    if (m.tournamentRound === 'NCAA_FF') {
      finalFour.add(m.winnerId!);
      finalFour.add(loserId);
    }
    if (m.tournamentRound && m.tournamentRound.startsWith('NCAA_')) {
      madeBracket.add(m.winnerId!);
      madeBracket.add(loserId);
    }
  }
  const champion = season?.nationalChampionTeamId ?? null;

  const finishOf = (teamId: string): TournamentFinish => {
    if (champion === teamId) return 'CHAMPION';
    if (finalFour.has(teamId)) return 'FINAL_FOUR';
    if (madeBracket.has(teamId)) return 'MADE_BRACKET';
    return 'NONE';
  };

  for (const b of boosters) {
    const games = gamesByTeam.get(b.teamId) ?? 0;
    const wins = winsByTeam.get(b.teamId) ?? 0;
    const winPct = games > 0 ? wins / games : 0.5;
    const enthusiasm = computeEnthusiasm(winPct, finishOf(b.teamId));
    await client.booster.update({ where: { id: b.id }, data: { enthusiasm } });
  }

  return { event: 'BOOSTER_UPDATES', teamsUpdated: boosters.length };
}
