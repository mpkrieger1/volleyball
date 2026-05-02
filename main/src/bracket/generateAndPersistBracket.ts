// Sprint 10: Build & persist the 64-team NCAA bracket for a given save + season.
// Persists RPI snapshots (final regular-season week) and BracketEntry rows.

import { PrismaClient } from '@prisma/client';
import { bracket, bracketIpc, perf } from '@vcd/shared';

export type GenerateBracketInput = {
  dbPath: string;
  seasonYear: number;
  metric: bracketIpc.BracketMetric; // 'RPI' | 'NET'
  /**
   * Sprint 11: when the post-season path calls this, real conference-tournament
   * winners replace Sprint 10's top-RPI-per-conf stub. Pass the result of
   * `autoBidsFromTournamentWinners` here.
   */
  autoBidsOverride?: bracket.AutoBidResult[];
};

export type GenerateBracketResult = {
  seasonYear: number;
  metric: bracketIpc.BracketMetric;
  entries: bracket.BracketEntryRow[];
};

export async function generateAndPersistBracket(
  input: GenerateBracketInput,
): Promise<GenerateBracketResult> {
  return perf.recordPerfAsync('generateAndPersistBracket', () =>
    generateAndPersistBracketImpl(input),
  );
}

async function generateAndPersistBracketImpl(
  input: GenerateBracketInput,
): Promise<GenerateBracketResult> {
  const client = new PrismaClient({ datasources: { db: { url: `file:${input.dbPath}` } } });
  try {
    const [teams, conferences, playedMatches, season] = await Promise.all([
      client.team.findMany(),
      client.conference.findMany(),
      client.match.findMany({
        where: { winnerId: { not: null } },
        select: {
          homeTeamId: true,
          awayTeamId: true,
          winnerId: true,
          isNeutralSite: true,
          week: true,
        },
      }),
      client.season.findUnique({ where: { year: input.seasonYear } }),
    ]);

    const teamIds = teams.map((t) => t.id);
    const bracketMatches: bracket.BracketMatch[] = playedMatches.map((m) => ({
      homeTeamId: m.homeTeamId,
      awayTeamId: m.awayTeamId,
      winnerId: m.winnerId!,
      isNeutralSite: m.isNeutralSite,
    }));

    const rpiResults = bracket.computeRPI(bracketMatches, teamIds);
    const netResults = bracket.computeNET(bracketMatches, teamIds);

    // Metric-ranked field.
    const rankedIds =
      input.metric === 'NET' ? bracket.rankByNET(netResults) : bracket.rankByRPI(rpiResults);

    const teamRows: bracket.TeamRow[] = teams.map((t) => ({
      id: t.id,
      abbr: t.abbr,
      schoolName: t.schoolName,
      conferenceId: t.conferenceId,
      region: t.region,
    }));
    const confRows: bracket.ConferenceRow[] = conferences.map((c) => ({
      id: c.id,
      abbr: c.abbr,
      autoBidEligible: c.autoBidEligible,
    }));

    const autoBids = input.autoBidsOverride ?? bracket.selectAutoBids(teamRows, confRows, rankedIds);

    const metricByTeam = new Map<string, bracket.TeamMetricInput>();
    const primaryResults =
      input.metric === 'NET'
        ? ([...netResults.values()].map((r) => ({
            teamId: r.teamId,
            wins: r.wins,
            losses: r.losses,
          })) as Array<{ teamId: string; wins: number; losses: number }>)
        : ([...rpiResults.values()].map((r) => ({
            teamId: r.teamId,
            wins: r.wins,
            losses: r.losses,
          })));
    rankedIds.forEach((id, i) => {
      const base = primaryResults.find((p) => p.teamId === id);
      if (!base) return;
      metricByTeam.set(id, { teamId: id, wins: base.wins, losses: base.losses, metricRank: i + 1 });
    });

    const selected = bracket.selectField(
      teamRows,
      confRows,
      [...metricByTeam.values()],
      autoBids,
    );

    if (selected.length !== 64) {
      throw new Error(`Selection produced ${selected.length} teams; expected 64`);
    }

    const entries = bracket.seedBracket(selected);

    // Determine snapshot week: the highest match.week observed, or 0 if none.
    const snapshotWeek = playedMatches.reduce((mx, m) => (m.week > mx ? m.week : mx), 0);

    await client.$transaction(
      async (tx) => {
        // RPI snapshot (persist every team, not just selected).
        await tx.rPISnapshot.deleteMany({ where: { week: snapshotWeek } });
        await tx.rPISnapshot.createMany({
          data: [...rpiResults.values()].map((r) => ({
            week: snapshotWeek,
            teamId: r.teamId,
            rpi: r.rpi,
            wins: r.wins,
            losses: r.losses,
            sos: r.sos,
            q1Wins: r.q1Wins,
            q2Wins: r.q2Wins,
            q3Wins: r.q3Wins,
            q4Wins: r.q4Wins,
          })),
        });
        // Bracket entries for this season.
        await tx.bracketEntry.deleteMany({ where: { seasonYear: input.seasonYear } });
        await tx.bracketEntry.createMany({
          data: entries.map((e) => ({
            seasonYear: input.seasonYear,
            region: e.region,
            seed: e.seed,
            teamId: e.teamId,
            autoBid: e.autoBid,
            metricRank: e.metricRank,
          })),
        });
        if (season) {
          await tx.season.update({
            where: { year: input.seasonYear },
            data: { phase: 'NCAA' },
          });
        }
      },
      { maxWait: 30_000, timeout: 60_000 },
    );

    return { seasonYear: input.seasonYear, metric: input.metric, entries };
  } finally {
    await client.$disconnect();
  }
}
