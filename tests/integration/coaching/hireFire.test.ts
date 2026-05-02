// Sprint 17: hire/fire service integration test.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { hireCoach } from '../../../main/src/coaching/hireCoach';
import { fireCoach, BUYOUT_FACTOR } from '../../../main/src/coaching/fireCoach';
import { coaching } from '@vcd/shared';

const repoRoot = resolve(__dirname, '../../..');

let tmpDir: string;
let dbPath: string;
let client: PrismaClient;

beforeAll(async () => {
  tmpDir = mkdtempSync(join(tmpdir(), 'vcd-coaching-'));
  dbPath = join(tmpDir, 'game.db');
  const env = { ...process.env, DATABASE_URL: `file:${dbPath}` };
  execSync(`npx prisma migrate deploy`, { cwd: repoRoot, env, stdio: 'pipe' });
  execSync(`npx tsx prisma/seed.ts`, { cwd: repoRoot, env, stdio: 'pipe' });
  client = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });
  await client.season.create({
    data: { year: 2026, phase: 'OFFSEASON', currentWeek: 0 },
  });
  // Seed a hiring pool directly.
  const pool = coaching.generateHiringPool({
    seed: 'test-pool',
    seasonYear: 2026,
    size: 50,
  });
  await client.coachingPool.createMany({
    data: pool.map((p) => ({
      firstName: p.firstName,
      lastName: p.lastName,
      ratingRecruit: p.ratingRecruit,
      ratingDevelop: p.ratingDevelop,
      ratingStrategy: p.ratingStrategy,
      askingSalaryCents: p.askingSalaryCents,
      preferredRole: p.preferredRole,
      ageYears: p.ageYears,
      seasonAvailable: p.seasonAvailable,
    })),
  });
}, 300_000);

afterAll(async () => {
  await client?.$disconnect();
  rmSync(tmpDir, { recursive: true, force: true });
});

describe('coaching hire/fire (Sprint 17)', () => {
  it('hireCoach adds a Coach to the team and removes from pool', async () => {
    const team = await client.team.findFirst();
    expect(team).not.toBeNull();
    const poolRow = await client.coachingPool.findFirst({
      where: { preferredRole: 'AC' },
    });
    expect(poolRow).not.toBeNull();

    const preAcCount = await client.coach.count({
      where: { teamId: team!.id, role: 'AC' },
    });

    // Replaces existing AC.
    const result = await hireCoach({
      dbPath,
      teamId: team!.id,
      poolId: poolRow!.id,
      role: 'AC',
      contractYears: 2,
      salaryCents: poolRow!.askingSalaryCents,
    });

    expect(result.coachId).toBeTruthy();
    expect(result.replacedCoachId).toBeTruthy();

    const postAcCount = await client.coach.count({
      where: { teamId: team!.id, role: 'AC' },
    });
    expect(postAcCount).toBe(preAcCount); // still exactly one AC on team

    const poolGone = await client.coachingPool.findUnique({ where: { id: poolRow!.id } });
    expect(poolGone).toBeNull();
  });

  it('fireCoach mid-contract creates a CoachBuyout and debits operating budget', async () => {
    const team = await client.team.findFirst({ orderBy: { prestige: 'desc' } });
    expect(team).not.toBeNull();
    const budgetBefore = team!.operatingBudgetCents;

    const ahc = await client.coach.findFirst({
      where: { teamId: team!.id, role: 'AHC' },
    });
    expect(ahc).not.toBeNull();

    // Ensure contract has remaining years.
    await client.coach.update({
      where: { id: ahc!.id },
      data: { contractYears: 3, salary: 10_000_00, hireSeason: 2026 },
    });

    const fired = await fireCoach({ dbPath, teamId: team!.id, coachId: ahc!.id });

    const expectedBuyout = Math.round(3 * 10_000_00 * BUYOUT_FACTOR);
    expect(fired.buyoutCents).toBe(expectedBuyout);
    expect(fired.newBudgetCents).toBe(budgetBefore - expectedBuyout);

    const ledger = await client.coachBuyout.findFirst({
      where: { coachId: ahc!.id },
    });
    expect(ledger).not.toBeNull();
    expect(ledger!.amountCents).toBe(expectedBuyout);

    const teamAfter = await client.team.findUnique({ where: { id: team!.id } });
    expect(teamAfter!.operatingBudgetCents).toBe(budgetBefore - expectedBuyout);
  });

  // Sprint 25: 360 sequential coach.count queries can push past the 5s
  // default under disk contention (concurrent dynasty / weekPerf runs).
  // Isolated this lands at ~3.6s; bumped to 30s for resilience.
  it('firing the HC triggers auto-backfill so every team still has an HC', { timeout: 30_000 }, async () => {
    const team = await client.team.findFirst({ orderBy: { prestige: 'asc' } });
    expect(team).not.toBeNull();
    const hc = await client.coach.findFirst({
      where: { teamId: team!.id, role: 'HC' },
    });
    expect(hc).not.toBeNull();
    await client.coach.update({
      where: { id: hc!.id },
      data: { contractYears: 2, salary: 5_000_00, hireSeason: 2026 },
    });

    const fired = await fireCoach({ dbPath, teamId: team!.id, coachId: hc!.id });
    expect(fired.backfilledCoachId).not.toBeNull();

    const hcAfter = await client.coach.findFirst({
      where: { teamId: team!.id, role: 'HC' },
    });
    expect(hcAfter).not.toBeNull();
    expect(hcAfter!.id).toBe(fired.backfilledCoachId);

    // All teams invariant — still one HC each.
    const allTeams = await client.team.findMany({ select: { id: true } });
    for (const t of allTeams) {
      const hcCount = await client.coach.count({ where: { teamId: t.id, role: 'HC' } });
      expect(hcCount).toBe(1);
    }
  });

  it('fireCoach rejects when operating budget is insufficient', async () => {
    const team = await client.team.findFirst();
    expect(team).not.toBeNull();
    // Drain budget.
    await client.team.update({
      where: { id: team!.id },
      data: { operatingBudgetCents: 0 },
    });
    const ac = await client.coach.findFirst({
      where: { teamId: team!.id, role: 'AC' },
    });
    expect(ac).not.toBeNull();
    await client.coach.update({
      where: { id: ac!.id },
      data: { contractYears: 3, salary: 1_000_00, hireSeason: 2026 },
    });
    await expect(
      fireCoach({ dbPath, teamId: team!.id, coachId: ac!.id }),
    ).rejects.toThrow(/INSUFFICIENT_BUDGET/);
  });
});
