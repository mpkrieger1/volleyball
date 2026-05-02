// Sprint 11: create Match rows for the first round of every conference
// tournament. Called once per season after the regular season completes.

import { PrismaClient } from '@prisma/client';
import { standings, tournament } from '@vcd/shared';

export type GenerateConfTournamentsInput = {
  dbPath: string;
};

export type GenerateConfTournamentsResult = {
  matchesCreated: number;
  pairings: tournament.CtFirstRoundPairing[];
};

export async function generateConfTournamentMatches(
  input: GenerateConfTournamentsInput,
): Promise<GenerateConfTournamentsResult> {
  const client = new PrismaClient({ datasources: { db: { url: `file:${input.dbPath}` } } });
  try {
    const [teams, matches, season] = await Promise.all([
      client.team.findMany(),
      client.match.findMany({
        where: { winnerId: { not: null } },
        select: {
          homeTeamId: true,
          awayTeamId: true,
          winnerId: true,
          isConference: true,
        },
      }),
      client.season.findFirst({ orderBy: { year: 'desc' } }),
    ]);
    if (!season) throw new Error('No Season row found.');

    const standingsMatches = matches.map((m) => ({
      homeTeamId: m.homeTeamId,
      awayTeamId: m.awayTeamId,
      winnerId: m.winnerId!,
      isConference: m.isConference,
    }));
    const standingsTeams = teams.map((t) => ({ id: t.id, conferenceId: t.conferenceId }));
    const confStandings = standings.computeConferenceStandings(standingsMatches, standingsTeams);

    const allPairings: tournament.CtFirstRoundPairing[] = [];
    for (const [confId, confRows] of confStandings) {
      const pairings = tournament.buildConfFirstRoundPairings(
        confId,
        confRows.map((r) => ({ teamId: r.teamId, rank: r.rank })),
      );
      allPairings.push(...pairings);
    }

    // Synthetic week: place CT matches past the regular season.
    const ctWeekByRound: Record<string, number> = { CT_R1: 14, CT_SF: 15, CT_F: 16 };
    const baseDate = new Date('2026-11-25T00:00:00.000Z');

    await client.$transaction(
      async (tx) => {
        // Idempotent: clear any prior CT matches for this season's weeks.
        await tx.match.deleteMany({
          where: { tournamentRound: { in: ['CT_R1', 'CT_SF', 'CT_F'] } },
        });
        for (const p of allPairings) {
          await tx.match.create({
            data: {
              homeTeamId: p.higherSeedTeamId,
              awayTeamId: p.lowerSeedTeamId,
              date: new Date(
                baseDate.getTime() + (ctWeekByRound[p.round] ?? 14) * 24 * 60 * 60 * 1000,
              ),
              week: ctWeekByRound[p.round] ?? 14,
              isConference: true,
              isTournament: true,
              isNeutralSite: true,
              tournamentRound: p.round,
              bracketSlot: p.bracketSlot,
              bracketGroupKey: p.conferenceId,
            },
          });
        }
        await tx.season.update({
          where: { id: season.id },
          data: { phase: 'CONF_TOURNEY' },
        });
      },
      { maxWait: 30_000, timeout: 60_000 },
    );

    return { matchesCreated: allPairings.length, pairings: allPairings };
  } finally {
    await client.$disconnect();
  }
}
