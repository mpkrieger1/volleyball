// Sprint 11: after all conference tournament finals complete, regenerate the
// 64-team NCAA bracket using real CT champion auto-bids, then create R64
// Match rows. Called once per season.

import { PrismaClient } from '@prisma/client';
import { bracket, tournament } from '@vcd/shared';
import { generateAndPersistBracket } from '../bracket/generateAndPersistBracket';

export type StartNcaaTournamentInput = {
  dbPath: string;
  seasonYear: number;
};

export type StartNcaaTournamentResult = {
  r64MatchesCreated: number;
  autoBidCount: number;
};

export async function startNcaaTournament(
  input: StartNcaaTournamentInput,
): Promise<StartNcaaTournamentResult> {
  const client = new PrismaClient({ datasources: { db: { url: `file:${input.dbPath}` } } });
  try {
    // 1. Load CT_F winners → auto-bids.
    const ctFinals = await client.match.findMany({
      where: { tournamentRound: 'CT_F', winnerId: { not: null } },
      select: {
        homeTeamId: true,
        awayTeamId: true,
        winnerId: true,
        bracketGroupKey: true,
      },
    });
    const autoBids = bracket.autoBidsFromTournamentWinners(
      ctFinals.map((m) => ({
        homeTeamId: m.homeTeamId,
        awayTeamId: m.awayTeamId,
        winnerId: m.winnerId!,
        bracketGroupKey: m.bracketGroupKey ?? '',
      })),
    );

    // 2. Regenerate the bracket with real auto-bids.
    await generateAndPersistBracket({
      dbPath: input.dbPath,
      seasonYear: input.seasonYear,
      metric: 'RPI',
      autoBidsOverride: autoBids,
    });

    // 3. Build R64 pairings from BracketEntry rows.
    const entries = await client.bracketEntry.findMany({
      where: { seasonYear: input.seasonYear },
    });
    const seedByRegion = new Map<bracket.BracketRegion, Map<number, string>>();
    for (const r of bracket.REGIONS) seedByRegion.set(r, new Map());
    for (const e of entries) {
      const inner = seedByRegion.get(e.region as bracket.BracketRegion);
      inner?.set(e.seed, e.teamId);
    }
    const pairings = tournament.buildNcaaR64Pairings(seedByRegion);

    // 4. Persist R64 Match rows; phase → NCAA.
    const baseDate = new Date('2026-11-25T00:00:00.000Z');
    const r64Date = new Date(baseDate.getTime() + 17 * 24 * 60 * 60 * 1000);
    await client.$transaction(
      async (tx) => {
        // Idempotent: clear any prior NCAA matches for a clean regeneration.
        await tx.match.deleteMany({
          where: {
            tournamentRound: {
              in: [
                'NCAA_R64',
                'NCAA_R32',
                'NCAA_S16',
                'NCAA_E8',
                'NCAA_FF',
                'NCAA_CHAMP',
              ],
            },
          },
        });
        for (const p of pairings) {
          await tx.match.create({
            data: {
              homeTeamId: p.higherSeedTeamId,
              awayTeamId: p.lowerSeedTeamId,
              date: r64Date,
              week: 17,
              isConference: false,
              isTournament: true,
              isNeutralSite: true,
              tournamentRound: 'NCAA_R64',
              bracketSlot: p.bracketSlot,
              bracketGroupKey: p.region,
            },
          });
        }
        const season = await tx.season.findFirst({ orderBy: { year: 'desc' } });
        if (season) {
          await tx.season.update({
            where: { id: season.id },
            data: { phase: 'NCAA' },
          });
        }
      },
      { maxWait: 30_000, timeout: 60_000 },
    );

    return {
      r64MatchesCreated: pairings.length,
      autoBidCount: autoBids.length,
    };
  } finally {
    await client.$disconnect();
  }
}
