// Sprint 13 main-service integration test: open → performAction × N →
// advanceRecruitingWeek → closeRecruitingCycle. Uses a small class size
// (300) so the test completes quickly. Runs in the default suite.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { openRecruitingCycle } from '../../../main/src/recruiting/openRecruitingCycle';
import { performAction } from '../../../main/src/recruiting/performAction';
import { advanceRecruitingWeek } from '../../../main/src/recruiting/advanceRecruitingWeek';
import { closeRecruitingCycle } from '../../../main/src/recruiting/closeRecruitingCycle';

const repoRoot = resolve(__dirname, '../../..');

let tmpDir: string;
let dbPath: string;
let client: PrismaClient;

beforeAll(async () => {
  tmpDir = mkdtempSync(join(tmpdir(), 'vcd-rec-cyc-'));
  dbPath = join(tmpDir, 'game.db');
  const env = { ...process.env, DATABASE_URL: `file:${dbPath}` };
  execSync(`npx prisma migrate deploy`, { cwd: repoRoot, env, stdio: 'pipe' });
  execSync(`npx tsx prisma/seed.ts`, { cwd: repoRoot, env, stdio: 'pipe' });
  client = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });
  // Need a Season row with phase=OFFSEASON so openCycle can transition it.
  await client.season.create({
    data: { year: 2026, phase: 'OFFSEASON', currentWeek: 0 },
  });
}, 300_000);

afterAll(async () => {
  await client?.$disconnect();
  rmSync(tmpDir, { recursive: true, force: true });
});

describe('recruiting cycle (integration, small class)', () => {
  it('openRecruitingCycle persists recruits + seeds interests + transitions phase', async () => {
    const result = await openRecruitingCycle({
      dbPath,
      seasonYear: 2026,
      classSize: 300,
      boardSizePerTeam: 10,
      seed: 'cycle-test',
    });
    expect(result.recruitsCreated).toBe(300);
    expect(result.interestsSeeded).toBeGreaterThan(0);

    const season = await client.season.findFirst();
    expect(season!.phase).toBe('RECRUITING');
    expect(season!.recruitingWeek).toBe(1);

    const pendingCount = await client.recruit.count({ where: { commitState: 'PENDING' } });
    expect(pendingCount).toBe(300);
  });

  it('performAction deducts budget and raises interest', async () => {
    const team = await client.team.findFirst({ select: { id: true } });
    const recruit = await client.recruit.findFirst({
      where: { commitState: 'PENDING' },
      select: { id: true },
    });
    const r = await performAction({
      dbPath,
      teamId: team!.id,
      recruitId: recruit!.id,
      action: 'PHONE_CALL',
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.newInterest).toBeGreaterThan(0);
      expect(r.budgetRemaining).toBeLessThan(50);
    }
  });

  it('performAction rejects when budget exhausted', async () => {
    const team = await client.team.findFirst({ select: { id: true } });
    const recruit = await client.recruit.findFirst({
      where: { commitState: 'PENDING' },
      select: { id: true },
    });
    // Max out the budget with OFFER_SCHOLARSHIPs (15 each → fits a few, then fails).
    for (let i = 0; i < 5; i++) {
      await performAction({
        dbPath,
        teamId: team!.id,
        recruitId: recruit!.id,
        action: 'OFFER_SCHOLARSHIP',
      });
    }
    const rejected = await performAction({
      dbPath,
      teamId: team!.id,
      recruitId: recruit!.id,
      action: 'OFFER_SCHOLARSHIP',
    });
    expect(rejected.ok).toBe(false);
    if (!rejected.ok) expect(rejected.code).toBe('INSUFFICIENT_BUDGET');
  });

  it('advanceRecruitingWeek runs AI ticks and resolves some commits by week 10', async () => {
    const interestRowCount = await client.recruitInterest.count();
    expect(interestRowCount).toBeGreaterThan(0);

    // Advance 9 more weeks (we're at recruitingWeek=1 → advance to 10).
    // Sprint 37: with pitch reasons + per-tick recompute, recruits may
    // all commit before week 10 in small classes — leaving some weeks
    // with 0 AI actions (no PENDING rows left). Aggregate-over-cycle
    // is the meaningful assertion.
    let totalAiActions = 0;
    for (let i = 0; i < 9; i++) {
      const r = await advanceRecruitingWeek({
        dbPath,
        userTeamId: null,
        seed: `adv:w${i}`,
      });
      totalAiActions += r.aiActionsApplied;
    }
    expect(totalAiActions).toBeGreaterThan(0);
    const committed = await client.recruit.count({ where: { commitState: 'COMMITTED' } });
    expect(committed).toBeGreaterThan(0);
  }, 60_000);

  it('closeRecruitingCycle leaves zero PENDING and transitions to OFFSEASON', async () => {
    // Sprint 37 Task 37.3: with pitch reasons added, every PENDING recruit
    // may have committed by week 10 (uncommittedCount can be 0). The
    // invariant we care about is: post-close, no recruit is PENDING and
    // the season transitions back to OFFSEASON.
    const result = await closeRecruitingCycle({ dbPath });
    expect(result.uncommittedCount).toBeGreaterThanOrEqual(0);
    const pending = await client.recruit.count({ where: { commitState: 'PENDING' } });
    expect(pending).toBe(0);
    const season = await client.season.findFirst();
    expect(season!.phase).toBe('OFFSEASON');
  });
});
