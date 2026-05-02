// Sprint 22: full-season simulation orchestrator for calibration tests.
// Mirrors the flow in tests/integration/postseason/fullPostseason.test.ts
// but exposed as a single async function so calibration test + CLI script
// can both reuse it.

import { generateAndPersistSchedule } from '../schedule/generateAndPersist';
import { advanceWeek } from '../season/advanceWeek';
import { SimWorkerPool } from '../season/workerPool';
import { generateConfTournamentMatches } from '../postseason/generateConfTournamentMatches';
import { startNcaaTournament } from '../postseason/startNcaaTournament';
import { advanceTournamentRound } from '../postseason/advanceTournamentRound';

const NCAA_ROUNDS = [
  'NCAA_R64',
  'NCAA_R32',
  'NCAA_S16',
  'NCAA_E8',
  'NCAA_FF',
  'NCAA_CHAMP',
] as const;
const CT_ROUNDS = ['CT_R1', 'CT_SF', 'CT_F'] as const;

export type RunFullSeasonInput = {
  dbPath: string;
  workerScriptPath: string;
  seasonYear: number;
  seed: string;
  workerCount?: number;
};

export type RunFullSeasonResult = {
  weeksAdvanced: number;
  ctRoundsCompleted: number;
  ncaaRoundsCompleted: number;
  championTeamId: string | null;
  elapsedMs: number;
};

/**
 * Drive a save-slot DB through a full season: 13 regular weeks → conference
 * tournaments (3 rounds) → NCAA bracket (6 rounds). Throws on any failure.
 *
 * Caller owns the DB lifecycle (migrations applied + seed loaded BEFORE
 * calling). Caller also owns the SimWorkerPool — this fn creates one
 * internally and shuts it down on completion.
 */
export async function runFullSeason(input: RunFullSeasonInput): Promise<RunFullSeasonResult> {
  const start = Date.now();

  await generateAndPersistSchedule({
    dbPath: input.dbPath,
    seasonYear: input.seasonYear,
    seed: `${input.seed}:schedule`,
  });

  const pool = new SimWorkerPool({
    scriptPath: input.workerScriptPath,
    workerCount: input.workerCount ?? 4,
  });

  try {
    let weeksAdvanced = 0;
    for (let w = 0; w < 13; w++) {
      const res = await advanceWeek({
        dbPath: input.dbPath,
        pool,
        seed: `${input.seed}:w${w}`,
      });
      if (!res.ok) throw new Error(`advanceWeek week ${w} failed: ${res.message}`);
      weeksAdvanced += 1;
    }

    await generateConfTournamentMatches({ dbPath: input.dbPath });
    let ctRoundsCompleted = 0;
    for (const round of CT_ROUNDS) {
      const r = await advanceTournamentRound({ dbPath: input.dbPath, pool, round });
      if (!r.ok) throw new Error(`advance ${round} failed: ${r.message}`);
      ctRoundsCompleted += 1;
    }

    await startNcaaTournament({ dbPath: input.dbPath, seasonYear: input.seasonYear });
    let ncaaRoundsCompleted = 0;
    let championTeamId: string | null = null;
    for (const round of NCAA_ROUNDS) {
      const r = await advanceTournamentRound({ dbPath: input.dbPath, pool, round });
      if (!r.ok) throw new Error(`advance ${round} failed: ${r.message}`);
      ncaaRoundsCompleted += 1;
      if (r.championTeamId) championTeamId = r.championTeamId;
    }

    return {
      weeksAdvanced,
      ctRoundsCompleted,
      ncaaRoundsCompleted,
      championTeamId,
      elapsedMs: Date.now() - start,
    };
  } finally {
    await pool.shutdown();
  }
}
