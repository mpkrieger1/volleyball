// PRD Sprint 15 exit tests.
//
// Exit test 1: total NIL spend per team ≤ booster budget every week.
// Exit test 2: higher NIL → lower portal-entry probability (10k sims).
// Exit test 3: NIL data persists across Prisma-client reopens.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { createRng, portal } from '@vcd/shared';
import { autoDistributeNil } from '../../../main/src/nil/autoDistributeNil';
import { assignNil } from '../../../main/src/nil/assignNil';
import { openPortal } from '../../../main/src/portal/openPortal';
import { advancePortalWeek } from '../../../main/src/portal/advancePortalWeek';

const repoRoot = resolve(__dirname, '../../..');

let tmpDir: string;
let dbPath: string;
let client: PrismaClient;

beforeAll(async () => {
  tmpDir = mkdtempSync(join(tmpdir(), 'vcd-nil-sim-'));
  dbPath = join(tmpDir, 'game.db');
  const env = { ...process.env, DATABASE_URL: `file:${dbPath}` };
  execSync(`npx prisma migrate deploy`, { cwd: repoRoot, env, stdio: 'pipe' });
  execSync(`npx tsx prisma/seed.ts`, { cwd: repoRoot, env, stdio: 'pipe' });
  client = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });
  await client.season.create({
    data: { year: 2026, phase: 'OFFSEASON', currentWeek: 0 },
  });
}, 300_000);

afterAll(async () => {
  await client?.$disconnect();
  rmSync(tmpDir, { recursive: true, force: true });
});

describe('PRD Sprint 15 invariants', () => {
  it('exit test 1: total NIL spend per team ≤ booster budget (auto-distribute + portal advance)', async () => {
    // Auto-distribute for a handful of teams, then open portal + advance.
    // Spot-check: at no point should any team's NIL sum exceed its budget.
    const teams = await client.team.findMany({ take: 10, select: { id: true } });
    for (const t of teams) {
      const r = await autoDistributeNil({ dbPath, teamId: t.id });
      expect(r.ok).toBe(true);
    }
    // Open portal (which creates portal NIL on commit later).
    await openPortal({ dbPath, seed: 'nil-xt1' });
    for (let w = 0; w < 3; w++) {
      await advancePortalWeek({ dbPath, userTeamId: null, seed: `nil-xt1:w${w}` });
    }
    // Check every team's total NIL.
    const boosters = await client.booster.findMany();
    for (const b of boosters) {
      const teamPlayers = await client.player.findMany({
        where: { teamId: b.teamId },
        select: { id: true },
      });
      const agg = await client.nilDeal.aggregate({
        where: { playerId: { in: teamPlayers.map((p) => p.id) } },
        _sum: { amount: true },
      });
      const spent = agg._sum.amount ?? 0;
      expect(spent).toBeLessThanOrEqual(b.collectiveBudget);
    }
  }, 180_000);

  it('exit test 2: higher NIL → lower portal-entry probability (10k sims)', async () => {
    // Pure unit-level sim (does not touch DB) — same as entry-model test
    // but validates the aggregate Bernoulli rate across a large population.
    const N = 10_000;
    let entries0 = 0;
    let entries50k = 0;
    for (let i = 0; i < N; i++) {
      const rng = createRng(`nil-xt2:${i}`);
      const p0 = portal.computePortalEntryProbability(
        { overall: 70, classYear: 'SO', position: 'OH', nilValueCents: 0 },
        { prestige: 55 },
        { depthRank: 3 },
        rng.fork('prob-0'),
      );
      const p50 = portal.computePortalEntryProbability(
        { overall: 70, classYear: 'SO', position: 'OH', nilValueCents: 50_000_00 },
        { prestige: 55 },
        { depthRank: 3 },
        rng.fork('prob-50'),
      );
      if (portal.didPlayerEnterPortal(rng.fork('draw-0'), p0)) entries0 += 1;
      if (portal.didPlayerEnterPortal(rng.fork('draw-50'), p50)) entries50k += 1;
    }
    const delta = (entries0 - entries50k) / N;
    // eslint-disable-next-line no-console
    console.log(`Δ = ${(delta * 100).toFixed(2)}pp (no-NIL ${entries0} vs $50k ${entries50k})`);
    expect(delta).toBeGreaterThanOrEqual(0.02);
  });

  it('exit test 3: NIL data persists across Prisma-client reopens', async () => {
    const team = await client.team.findFirst({ select: { id: true } });
    const player = await client.player.findFirst({
      where: { teamId: team!.id },
      select: { id: true },
    });
    const AMOUNT = 15_000_00;
    const assignResult = await assignNil({
      dbPath,
      teamId: team!.id,
      playerId: player!.id,
      amountCents: AMOUNT,
    });
    expect(assignResult.ok).toBe(true);

    // Close + re-open client.
    await client.$disconnect();
    const fresh = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });
    try {
      const deal = await fresh.nilDeal.findFirst({
        where: { playerId: player!.id, brand: 'Team Collective' },
      });
      expect(deal).not.toBeNull();
      expect(deal!.amount).toBe(AMOUNT);
    } finally {
      await fresh.$disconnect();
    }
    // Reconnect the afterAll client.
    client = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });
  });
});
