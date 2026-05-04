// Sprint 28 Task 28.3: recruits arrive at preseason→regular transition.
// At save creation (PRESEASON), no recruits exist. After startRegular, the
// recruiting class is open and per-team boards seeded.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { startRegular } from '../../../main/src/season/startRegular';

const repoRoot = resolve(__dirname, '../../..');
let tmpDir: string;
let dbPath: string;
let client: PrismaClient;

beforeAll(async () => {
  tmpDir = mkdtempSync(join(tmpdir(), 'vcd-week1gen-'));
  dbPath = join(tmpDir, 'game.db');
  const env = { ...process.env, DATABASE_URL: `file:${dbPath}` };
  execSync(`npx prisma migrate deploy`, { cwd: repoRoot, env, stdio: 'pipe' });
  execSync(`npx tsx prisma/seed.ts`, { cwd: repoRoot, env, stdio: 'pipe' });
  client = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });
}, 180_000);

afterAll(async () => {
  await client?.$disconnect();
  rmSync(tmpDir, { recursive: true, force: true });
});

describe('preseason→regular auto-generation', () => {
  it('fresh save in PRESEASON has 0 recruits', async () => {
    const recruitCount = await client.recruit.count();
    expect(recruitCount).toBe(0);
  });

  it('coaches exist at save creation (HC always-filled invariant)', async () => {
    const teams = await client.team.count();
    const hcCount = await client.coach.count({ where: { role: 'HC' } });
    expect(hcCount).toBe(teams);
  });

  it('startRegular opens the recruiting cycle and creates recruits', async () => {
    // Need at least one Season row in PRESEASON for startRegular.
    await client.season.upsert({
      where: { year: 2026 },
      create: { year: 2026, phase: 'PRESEASON', currentWeek: 0 },
      update: { phase: 'PRESEASON' },
    });

    const result = await startRegular({ dbPath, seed: 'week1-test' });
    expect(result.ok).toBe(true);

    const recruitCount = await client.recruit.count();
    expect(recruitCount).toBeGreaterThan(0);
  }, 120_000);

  it('startRegular is idempotent: re-running does not double-generate', async () => {
    const before = await client.recruit.count();
    // Reset season to PRESEASON to allow re-running.
    await client.season.update({
      where: { year: 2026 },
      data: { phase: 'PRESEASON' },
    });
    const result = await startRegular({ dbPath, seed: 'week1-test' });
    expect(result.ok).toBe(true);
    const after = await client.recruit.count();
    expect(after).toBe(before);
  }, 60_000);
});
