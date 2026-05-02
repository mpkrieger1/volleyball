// Round-trips a Team row against a temporary SQLite DB built from the migration SQL.
// Proves the schema + generated client agree before any seed code runs.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';

const repoRoot = resolve(__dirname, '../..');
let tmpDir: string;
let dbPath: string;
let client: PrismaClient;

beforeAll(async () => {
  tmpDir = mkdtempSync(join(tmpdir(), 'vcd-dbtest-'));
  dbPath = join(tmpDir, 'test.db');
  execSync(`npx prisma migrate deploy`, {
    cwd: repoRoot,
    env: { ...process.env, DATABASE_URL: `file:${dbPath}` },
    stdio: 'pipe',
  });
  client = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });
});

afterAll(async () => {
  await client?.$disconnect();
  rmSync(tmpDir, { recursive: true, force: true });
});

describe('PrismaClient round-trip', () => {
  it('creates + reads a Conference + Team', async () => {
    const conf = await client.conference.create({
      data: { name: 'Test Conf', abbr: 'TEST', tier: 'P4', autoBidEligible: true },
    });
    const team = await client.team.create({
      data: {
        schoolName: 'Test State',
        abbr: 'TS',
        conferenceId: conf.id,
        primaryColor: '#112233',
        secondaryColor: '#445566',
        logoPath: 'placeholder:TS',
        prestige: 60,
      },
    });
    const read = await client.team.findUnique({
      where: { id: team.id },
      include: { conference: true },
    });
    expect(read?.schoolName).toBe('Test State');
    expect(read?.conference.abbr).toBe('TEST');
  });

  it('migrations folder is committed and non-empty', () => {
    const dir = readdirSync(resolve(repoRoot, 'prisma/migrations')).filter(
      (x) => x !== 'migration_lock.toml',
    );
    expect(dir.length).toBeGreaterThan(0);
  });
});
