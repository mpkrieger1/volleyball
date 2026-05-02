// End-to-end schedule generation + persistence against a real seeded DB.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { generateAndPersistSchedule } from '../../../main/src/schedule/generateAndPersist';

const repoRoot = resolve(__dirname, '../../..');
let tmpDir: string;
let dbPath: string;
let client: PrismaClient;

beforeAll(async () => {
  tmpDir = mkdtempSync(join(tmpdir(), 'vcd-schedule-'));
  dbPath = join(tmpDir, 'game.db');
  const env = { ...process.env, DATABASE_URL: `file:${dbPath}` };
  execSync(`npx prisma migrate deploy`, { cwd: repoRoot, env, stdio: 'pipe' });
  execSync(`npx tsx prisma/seed.ts`, { cwd: repoRoot, env, stdio: 'pipe' });
  client = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });
}, 120_000);

afterAll(async () => {
  await client?.$disconnect();
  rmSync(tmpDir, { recursive: true, force: true });
});

describe('generateAndPersistSchedule', () => {
  it('persists a full schedule and stats are self-consistent', async () => {
    const result = await generateAndPersistSchedule({
      dbPath,
      seasonYear: 2026,
      seed: 'schedule-test-1',
    });
    expect(result.stats.totalMatches).toBeGreaterThan(4000);
    expect(result.stats.totalMatches).toBe(
      result.stats.confMatches + result.stats.nonConfMatches,
    );

    const count = await client.match.count();
    expect(count).toBe(result.stats.totalMatches);
  }, 60_000);

  it('regeneration with the same seed produces byte-identical Match rows (PRD S7 exit test 4)', async () => {
    const r1 = await generateAndPersistSchedule({
      dbPath,
      seasonYear: 2026,
      seed: 'det-seed',
    });
    const snapshot1 = await client.match.findMany({
      orderBy: [{ date: 'asc' }, { homeTeamId: 'asc' }, { awayTeamId: 'asc' }],
      select: {
        homeTeamId: true,
        awayTeamId: true,
        date: true,
        week: true,
        isConference: true,
        isTournament: true,
        isNeutralSite: true,
      },
    });
    const r2 = await generateAndPersistSchedule({
      dbPath,
      seasonYear: 2026,
      seed: 'det-seed',
    });
    const snapshot2 = await client.match.findMany({
      orderBy: [{ date: 'asc' }, { homeTeamId: 'asc' }, { awayTeamId: 'asc' }],
      select: {
        homeTeamId: true,
        awayTeamId: true,
        date: true,
        week: true,
        isConference: true,
        isTournament: true,
        isNeutralSite: true,
      },
    });
    expect(r1.stats).toEqual(r2.stats);
    expect(snapshot1).toEqual(snapshot2);
  }, 120_000);
});
