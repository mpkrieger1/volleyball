import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { loadExpectedCounts } from '../../prisma/seedCsv';

const repoRoot = resolve(__dirname, '../..');
let tmpDir: string;
let dbPath: string;
let client: PrismaClient;

beforeAll(async () => {
  tmpDir = mkdtempSync(join(tmpdir(), 'vcd-seedtest-'));
  dbPath = join(tmpDir, 'seed.db');
  const env = { ...process.env, DATABASE_URL: `file:${dbPath}` };
  execSync(`npx prisma migrate deploy`, { cwd: repoRoot, env, stdio: 'pipe' });
  execSync(`npx tsx prisma/seed.ts`, { cwd: repoRoot, env, stdio: 'pipe' });
  client = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });
}, 60_000);

afterAll(async () => {
  await client?.$disconnect();
  rmSync(tmpDir, { recursive: true, force: true });
});

describe('seed run', () => {
  const expected = loadExpectedCounts();

  it('writes the expected conference and team counts (PRD exit test 1)', async () => {
    const [c, t] = await Promise.all([client.conference.count(), client.team.count()]);
    expect(c).toBe(expected.conferences);
    expect(t).toBe(expected.teams);
  });

  it('every team resolves to exactly one conference (PRD exit test 3)', async () => {
    const teams = await client.team.findMany({ include: { conference: true } });
    for (const t of teams) {
      expect(t.conference).toBeTruthy();
      expect(t.conferenceId).toBe(t.conference.id);
    }
  });

  it('every team has non-null primary and secondary colors (PRD exit test 3)', async () => {
    const teams = await client.team.findMany();
    for (const t of teams) {
      expect(t.primaryColor).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(t.secondaryColor).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });
});
