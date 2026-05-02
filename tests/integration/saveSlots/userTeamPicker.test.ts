// Sprint 21: integration test for the user-team picker IPC
// (season.getUserTeam / season.setUserTeam).

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { getUserTeam, setUserTeam } from '../../../main/src/season/userTeam';

const repoRoot = resolve(__dirname, '../../..');
let tmpDir: string;
let dbPath: string;
let client: PrismaClient;
let firstTeamId: string;
let secondTeamId: string;

beforeAll(async () => {
  tmpDir = mkdtempSync(join(tmpdir(), 'vcd-userteam-'));
  dbPath = join(tmpDir, 'game.db');
  const env = { ...process.env, DATABASE_URL: `file:${dbPath}` };
  execSync(`npx prisma migrate deploy`, { cwd: repoRoot, env, stdio: 'pipe' });
  execSync(`npx tsx prisma/seed.ts`, { cwd: repoRoot, env, stdio: 'pipe' });
  client = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });
  // The bare seed script doesn't create a Season row (that happens during
  // save-slot creation in main/src/saveSlots/service.ts). Create one
  // manually for this isolated integration test.
  await client.season.create({
    data: { year: 2026, phase: 'PRESEASON', currentWeek: 0 },
  });
  const teams = await client.team.findMany({ take: 2, orderBy: { abbr: 'asc' } });
  firstTeamId = teams[0]!.id;
  secondTeamId = teams[1]!.id;
}, 90_000);

afterAll(async () => {
  await client?.$disconnect();
  rmSync(tmpDir, { recursive: true, force: true });
});

describe('userTeam (Sprint 21)', () => {
  it('getUserTeam returns null on a fresh save', async () => {
    const result = await getUserTeam(client);
    expect(result).not.toBeNull();
    expect(result?.userTeamId).toBeNull();
  });

  it('setUserTeam writes Season.userTeamId', async () => {
    const result = await setUserTeam(client, firstTeamId);
    expect('error' in result).toBe(false);
    if (!('error' in result)) {
      expect(result.userTeamId).toBe(firstTeamId);
    }

    const season = await client.season.findFirst({ orderBy: { year: 'desc' } });
    expect(season?.userTeamId).toBe(firstTeamId);
  });

  it('setUserTeam is idempotent — second call overwrites', async () => {
    await setUserTeam(client, firstTeamId);
    const second = await setUserTeam(client, secondTeamId);
    expect('error' in second).toBe(false);
    if (!('error' in second)) {
      expect(second.userTeamId).toBe(secondTeamId);
    }
    const season = await client.season.findFirst({ orderBy: { year: 'desc' } });
    expect(season?.userTeamId).toBe(secondTeamId);
  });

  it('setUserTeam returns TEAM_NOT_FOUND for unknown teamId', async () => {
    const result = await setUserTeam(client, 'no-such-team');
    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.error).toBe('TEAM_NOT_FOUND');
    }
  });

  it('getUserTeam reads the most recent value after set', async () => {
    await setUserTeam(client, firstTeamId);
    const result = await getUserTeam(client);
    expect(result?.userTeamId).toBe(firstTeamId);
  });
});
