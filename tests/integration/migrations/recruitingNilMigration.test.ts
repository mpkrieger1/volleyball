// Sprint 36 Task 36.1 — `20261228_000000_recruiting_nil` migration adds
// Team.{nilBudgetCents, nilBudgetUsedCents} + RecruitInterest.nilOfferCents.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import {
  createSaveSlot,
  openSaveSlot,
  findSlotDbPathById,
  type SaveSlotServiceDeps,
} from '../../../main/src/saveSlots/service';

const repoRoot = resolve(__dirname, '../../..');
const MIGRATION_NAME = '20261228_000000_recruiting_nil';

let tmpDir: string;
let deps: SaveSlotServiceDeps;

beforeAll(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'vcd-nil-mig-'));
  deps = { repoRoot, baseDir: tmpDir };
}, 90_000);

afterAll(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe('Sprint 36 — recruiting NIL migration', () => {
  it('adds Team.nilBudgetCents (default 0) + nilBudgetUsedCents (default 0)', async () => {
    const slot = await createSaveSlot(deps, 'NIL Mig Team');
    const dbPath = await findSlotDbPathById(deps, slot.id);
    const client = new PrismaClient({ datasources: { db: { url: `file:${dbPath!}` } } });
    try {
      const cols = await client.$queryRawUnsafe<
        Array<{ name: string; dflt_value: string | null }>
      >(`PRAGMA table_info("Team")`);
      const budget = cols.find((c) => c.name === 'nilBudgetCents');
      const used = cols.find((c) => c.name === 'nilBudgetUsedCents');
      expect(budget).toBeDefined();
      expect(used).toBeDefined();
      expect(budget!.dflt_value).toBe('0');
      expect(used!.dflt_value).toBe('0');
    } finally {
      await client.$disconnect();
    }
  }, 120_000);

  it('adds RecruitInterest.nilOfferCents (default 0)', async () => {
    const slot = await createSaveSlot(deps, 'NIL Mig Interest');
    const dbPath = await findSlotDbPathById(deps, slot.id);
    const client = new PrismaClient({ datasources: { db: { url: `file:${dbPath!}` } } });
    try {
      const cols = await client.$queryRawUnsafe<
        Array<{ name: string; dflt_value: string | null }>
      >(`PRAGMA table_info("RecruitInterest")`);
      const offer = cols.find((c) => c.name === 'nilOfferCents');
      expect(offer).toBeDefined();
      expect(offer!.dflt_value).toBe('0');
    } finally {
      await client.$disconnect();
    }
  }, 120_000);

  it('idempotent re-apply via openSaveSlot — _prisma_migrations not duplicated', async () => {
    const slot = await createSaveSlot(deps, 'NIL Mig Idem');
    await openSaveSlot(deps, slot.id);
    await openSaveSlot(deps, slot.id);
    const dbPath = await findSlotDbPathById(deps, slot.id);
    const client = new PrismaClient({ datasources: { db: { url: `file:${dbPath!}` } } });
    try {
      const dupes = await client.$queryRawUnsafe<Array<{ migration_name: string; c: bigint }>>(
        `SELECT migration_name, COUNT(*) as c FROM "_prisma_migrations" WHERE migration_name = '${MIGRATION_NAME}' GROUP BY migration_name HAVING c > 1`,
      );
      expect(dupes).toHaveLength(0);
    } finally {
      await client.$disconnect();
    }
  }, 180_000);
});
