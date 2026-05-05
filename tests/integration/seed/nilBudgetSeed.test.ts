// Sprint 36 Task 36.1 — fresh-league seed populates Team.nilBudgetCents
// from prestige tier. Backfill bumps legacy 0-budget rows.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import {
  createSaveSlot,
  findSlotDbPathById,
  type SaveSlotServiceDeps,
} from '../../../main/src/saveSlots/service';
import { backfillNilBudget } from '../../../main/src/saveSlots/backfillNilBudget';
import { deriveNilBudget } from '@vcd/shared/seed';

const repoRoot = resolve(__dirname, '../../..');

let tmpDir: string;
let deps: SaveSlotServiceDeps;
let dbPath: string;
let client: PrismaClient;

beforeAll(async () => {
  tmpDir = mkdtempSync(join(tmpdir(), 'vcd-nil-seed-'));
  deps = { repoRoot, baseDir: tmpDir };
  const slot = await createSaveSlot(deps, 'NIL Seed');
  const path = await findSlotDbPathById(deps, slot.id);
  if (!path) throw new Error('save slot path not found');
  dbPath = path;
  client = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });
}, 240_000);

afterAll(async () => {
  await client?.$disconnect();
  rmSync(tmpDir, { recursive: true, force: true });
});

describe('Sprint 36 — NIL budget seed', () => {
  it('every team has the prestige-derived NIL budget', async () => {
    const teams = await client.team.findMany({
      select: { id: true, prestige: true, nilBudgetCents: true },
    });
    expect(teams.length).toBeGreaterThan(300);
    for (const t of teams) {
      expect(t.nilBudgetCents).toBe(deriveNilBudget(t.prestige));
    }
  }, 60_000);

  it('high-prestige team caps at $300k; lowest tier hits $30k floor', async () => {
    const top = await client.team.findFirst({ orderBy: { prestige: 'desc' } });
    const bottom = await client.team.findFirst({ orderBy: { prestige: 'asc' } });
    expect(top!.nilBudgetCents).toBeLessThanOrEqual(300_000 * 100);
    expect(bottom!.nilBudgetCents).toBeGreaterThanOrEqual(30_000 * 100);
  });

  it('backfillNilBudget is idempotent on a fresh save (no rows to bump)', async () => {
    const updated = await backfillNilBudget(client);
    expect(updated).toBe(0);
  });

  it('backfillNilBudget bumps reset-to-zero rows on legacy save', async () => {
    // Simulate a legacy save: zero out all budgets.
    await client.team.updateMany({ data: { nilBudgetCents: 0 } });
    const updated = await backfillNilBudget(client);
    expect(updated).toBeGreaterThan(0);
    const stillZero = await client.team.count({ where: { nilBudgetCents: 0 } });
    expect(stillZero).toBe(0);

    // Re-run: idempotent.
    const updated2 = await backfillNilBudget(client);
    expect(updated2).toBe(0);
  });
});
