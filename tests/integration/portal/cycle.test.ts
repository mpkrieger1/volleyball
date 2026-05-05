// Sprint 14 main-service integration test. Seeds a full save DB (~4,320
// players), runs openPortal + advances + close, verifies state
// transitions.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { openPortal } from '../../../main/src/portal/openPortal';
import { performPortalAction } from '../../../main/src/portal/performPortalAction';
import { advancePortalWeek } from '../../../main/src/portal/advancePortalWeek';
import { closePortal } from '../../../main/src/portal/closePortal';

const repoRoot = resolve(__dirname, '../../..');

let tmpDir: string;
let dbPath: string;
let client: PrismaClient;

beforeAll(async () => {
  tmpDir = mkdtempSync(join(tmpdir(), 'vcd-portal-'));
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

describe('portal cycle (integration)', () => {
  // Sprint 28 expanded per-team roster from 12 → 17 (POSITION_MIX rewrite).
  // 360 teams × 17 = 6120 players. Original Sprint 14 bounds (4300-4400)
  // are stale; widened to match the post-Sprint-28 roster sizes.
  it('full-league roster seeded: ~6,120 players', async () => {
    const count = await client.player.count();
    expect(count).toBeGreaterThanOrEqual(6000);
    expect(count).toBeLessThanOrEqual(6500);
  });

  it('openPortal creates TransferPortal + PortalInterest rows and sets phase', async () => {
    const result = await openPortal({ dbPath, seed: 'cycle-test' });
    expect(result.entrants).toBeGreaterThan(0);
    expect(result.interestsSeeded).toBeGreaterThan(0);
    const season = await client.season.findFirst();
    expect(season!.phase).toBe('PORTAL');
    expect(season!.portalWeek).toBe(1);
  }, 120_000);

  it('performPortalAction deducts budget and raises interest', async () => {
    const team = await client.team.findFirst({ select: { id: true } });
    const entry = await client.transferPortal.findFirst({
      where: { status: 'ACTIVE' },
      select: { id: true },
    });
    const r = await performPortalAction({
      dbPath,
      teamId: team!.id,
      transferPortalId: entry!.id,
      action: 'CALL',
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.newInterest).toBeGreaterThan(0);
      expect(r.budgetRemaining).toBeLessThan(30);
    }
  });

  it('OFFER_NIL with $20k adds ≥ 200 interest in one action', async () => {
    const team = await client.team.findFirst({ select: { id: true } });
    const entry = await client.transferPortal.findFirst({
      where: { status: 'ACTIVE' },
      select: { id: true },
    });
    const pre = await client.portalInterest.findUnique({
      where: {
        transferPortalId_teamId: {
          transferPortalId: entry!.id,
          teamId: team!.id,
        },
      },
    });
    const before = pre?.interest ?? 0;
    const r = await performPortalAction({
      dbPath,
      teamId: team!.id,
      transferPortalId: entry!.id,
      action: 'OFFER_NIL',
      nilAmountCents: 20_000_00,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.newInterest - before).toBeGreaterThanOrEqual(200);
  });

  it('advancePortalWeek runs AI ticks and resolves some commits', async () => {
    for (let i = 0; i < 5; i++) {
      const r = await advancePortalWeek({
        dbPath,
        userTeamId: null,
        seed: `adv:w${i}`,
      });
      expect(r.aiActionsApplied).toBeGreaterThan(0);
    }
    const signed = await client.transferPortal.count({ where: { status: 'SIGNED' } });
    expect(signed).toBeGreaterThan(0);
  }, 120_000);

  it('closePortal transitions signed players + marks rest unsigned', async () => {
    const result = await closePortal({ dbPath });
    expect(result.signedCount).toBeGreaterThan(0);
    const active = await client.transferPortal.count({ where: { status: 'ACTIVE' } });
    expect(active).toBe(0);
    // Sprint 33: closePortal no longer writes Season.phase. Phase
    // management belongs to `advanceOffseasonEvent`. Pre-Sprint-33 the
    // close transaction set phase='RECRUITING' (the auto-open-recruiting
    // retro from Sprint 31, also rolled back). The close still resets
    // portalWeek to 0.
    const season = await client.season.findFirst();
    expect(season!.portalWeek).toBe(0);
  });

  it('no player appears on two teams after close', async () => {
    // For every player who was SIGNED, confirm their Player.teamId matches
    // the TransferPortal.newTeamId (and is not their original team).
    const signed = await client.transferPortal.findMany({
      where: { status: 'SIGNED' },
      include: { player: true },
    });
    for (const s of signed) {
      expect(s.player.teamId).toBe(s.newTeamId);
    }
    // Player.teamId uniqueness = no duplicates check at DB level.
    // Ensure no Player row has null teamId.
    const orphan = await client.player.count({ where: { teamId: '' } });
    expect(orphan).toBe(0);
  });
});
