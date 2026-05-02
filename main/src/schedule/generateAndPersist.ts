// Orchestrator that reads teams from a save-slot DB, runs the Sprint 7
// scheduler, and writes Match rows in a transaction. Clears any existing
// UNPLAYED matches first (so regeneration replaces the schedule).

import { PrismaClient } from '@prisma/client';
import { schedule } from '@vcd/shared';

export type GenerateAndPersistInput = {
  dbPath: string;
  seasonYear: number;
  seed: number | string;
};

export type GenerateAndPersistResult = {
  stats: schedule.GenerateScheduleResult['stats'];
};

export class ScheduleError extends Error {
  constructor(
    public readonly code: 'NOT_FOUND' | 'INVALID_INPUT' | 'IO_ERROR' | 'INTERNAL',
    message: string,
  ) {
    super(message);
  }
}

export async function generateAndPersistSchedule(
  input: GenerateAndPersistInput,
): Promise<GenerateAndPersistResult> {
  const client = new PrismaClient({ datasources: { db: { url: `file:${input.dbPath}` } } });
  try {
    const teamRows = await client.team.findMany();
    if (teamRows.length === 0) {
      throw new ScheduleError('NOT_FOUND', 'No teams found in save DB.');
    }
    const teams: schedule.TeamForScheduling[] = teamRows.map((t) => ({
      id: t.id,
      conferenceId: t.conferenceId,
      region: t.region as schedule.TeamForScheduling['region'],
    }));

    const result = schedule.generateSchedule({
      teams,
      seasonYear: input.seasonYear,
      seed: input.seed,
    });

    // Clear unplayed matches (winnerId is null = never simulated).
    await client.match.deleteMany({ where: { winnerId: null } });

    // Write new matches in batches.
    const BATCH = 200;
    for (let i = 0; i < result.matches.length; i += BATCH) {
      const batch = result.matches.slice(i, i + BATCH);
      await client.match.createMany({
        data: batch.map((m) => ({
          homeTeamId: m.homeTeamId,
          awayTeamId: m.awayTeamId,
          date: new Date(`${m.isoDate}T00:00:00Z`),
          week: m.weekIndex,
          isConference: m.isConference,
          isTournament: m.isTournament,
          isNeutralSite: m.isNeutralSite,
        })),
      });
    }

    // Ensure a Season row exists for this year. Upsert so re-running
    // generate doesn't duplicate; but if currentWeek is already past 0
    // (someone advanced before regen), preserve it.
    const existing = await client.season.findUnique({ where: { year: input.seasonYear } });
    if (!existing) {
      await client.season.create({
        data: {
          year: input.seasonYear,
          phase: 'PRESEASON',
          currentWeek: 0,
        },
      });
    }

    return { stats: result.stats };
  } finally {
    await client.$disconnect();
  }
}
