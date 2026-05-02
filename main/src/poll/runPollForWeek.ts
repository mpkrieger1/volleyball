// Runs the Sprint 9 voter-model poll for a given week and persists Poll rows.
// Called by advanceWeek after each week's atomic match transaction commits.

import { PrismaClient } from '@prisma/client';
import { poll, perf } from '@vcd/shared';

export type RunPollInput = {
  dbPath: string;
  week: number;
  seed: number | string;
};

export type RunPollResult = {
  week: number;
  rowsWritten: number;
};

export async function runPollForWeek(input: RunPollInput): Promise<RunPollResult> {
  return perf.recordPerfAsync('runPollForWeek', () => runPollForWeekImpl(input));
}

async function runPollForWeekImpl(input: RunPollInput): Promise<RunPollResult> {
  const client = new PrismaClient({ datasources: { db: { url: `file:${input.dbPath}` } } });
  try {
    // Load teams + played matches through this week.
    const [teams, conferences] = await Promise.all([
      client.team.findMany(),
      client.conference.findMany(),
    ]);

    const playedMatches = await client.match.findMany({
      where: { winnerId: { not: null }, week: { lte: input.week } },
      select: { homeTeamId: true, awayTeamId: true, winnerId: true, date: true, week: true },
    });

    const metrics = poll.computeTeamMetrics(
      playedMatches.map((m) => ({
        homeTeamId: m.homeTeamId,
        awayTeamId: m.awayTeamId,
        winnerId: m.winnerId!,
        date: m.date,
      })),
      teams.map((t) => t.id),
    );

    // Previous poll (for inertia).
    const prevPoll = input.week > 0
      ? await client.poll.findMany({
          where: { week: input.week - 1 },
          orderBy: { rank: 'asc' },
        })
      : [];
    const prevPollRows: poll.PollRow[] = prevPoll.map((p) => ({
      rank: p.rank,
      teamId: p.teamId,
      points: 0, // not persisted in the DB schema; inertia only reads `rank`
      firstPlaceVotes: p.firstPlaceVotes,
    }));

    // Generate ballots.
    const voters = poll.makeVoters(
      `${input.seed}:voters`,
      conferences.map((c) => c.id),
    );
    const ballotInput: poll.BallotInputTeam[] = teams.map((t) => ({
      id: t.id,
      abbr: t.abbr,
      prestige: t.prestige,
      conferenceId: t.conferenceId,
    }));
    const ballots = voters.map((v) => poll.generateBallot(v, metrics, ballotInput));

    const rawPoll = poll.aggregatePoll(ballots);

    // Upsets: this-week matches where loser was top-10 in prevPoll.
    const thisWeekMatches = playedMatches.filter((m) => m.week === input.week);
    const upsets = poll.detectUpsets(
      thisWeekMatches.map((m) => ({
        winnerId: m.winnerId!,
        homeTeamId: m.homeTeamId,
        awayTeamId: m.awayTeamId,
      })),
      prevPollRows.length > 0 ? prevPollRows : null,
    );

    const finalPoll = poll.applyInertia(
      prevPollRows.length > 0 ? prevPollRows : null,
      rawPoll,
      metrics,
      upsets,
    );

    // Persist: clear + insert this week's rows.
    await client.$transaction(
      async (tx) => {
        await tx.poll.deleteMany({ where: { week: input.week } });
        await tx.poll.createMany({
          data: finalPoll.map((row) => ({
            week: input.week,
            rank: row.rank,
            teamId: row.teamId,
            prevRank:
              prevPollRows.find((p) => p.teamId === row.teamId)?.rank ?? null,
            firstPlaceVotes: row.firstPlaceVotes,
          })),
        });
      },
      { maxWait: 10_000, timeout: 30_000 },
    );

    return { week: input.week, rowsWritten: finalPoll.length };
  } finally {
    await client.$disconnect();
  }
}
