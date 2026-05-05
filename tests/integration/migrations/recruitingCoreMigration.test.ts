// Sprint 35 Task 35.1 — `20261214_000000_recruiting_core` migration adds
// academicsLevel + hometownState + priorities + commitmentStatus.

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
const MIGRATION_NAME = '20261214_000000_recruiting_core';

let tmpDir: string;
let deps: SaveSlotServiceDeps;

beforeAll(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'vcd-rc-mig-'));
  deps = { repoRoot, baseDir: tmpDir };
}, 90_000);

afterAll(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe('Sprint 35 — recruiting-core migration', () => {
  it('adds Team.academicsLevel (default 50)', async () => {
    const slot = await createSaveSlot(deps, 'RC Mig Team');
    const dbPath = await findSlotDbPathById(deps, slot.id);
    const client = new PrismaClient({ datasources: { db: { url: `file:${dbPath!}` } } });
    try {
      const cols = await client.$queryRawUnsafe<
        Array<{ name: string; dflt_value: string | null }>
      >(`PRAGMA table_info("Team")`);
      const ac = cols.find((c) => c.name === 'academicsLevel');
      expect(ac).toBeDefined();
      expect(ac!.dflt_value).toBe('50');
    } finally {
      await client.$disconnect();
    }
  }, 120_000);

  it('adds Coach.hometownState (nullable)', async () => {
    const slot = await createSaveSlot(deps, 'RC Mig Coach');
    const dbPath = await findSlotDbPathById(deps, slot.id);
    const client = new PrismaClient({ datasources: { db: { url: `file:${dbPath!}` } } });
    try {
      const cols = await client.$queryRawUnsafe<
        Array<{ name: string; notnull: number }>
      >(`PRAGMA table_info("Coach")`);
      const hs = cols.find((c) => c.name === 'hometownState');
      expect(hs).toBeDefined();
      expect(hs!.notnull).toEqual(0n);
    } finally {
      await client.$disconnect();
    }
  }, 120_000);

  it('adds Recruit.prioritiesJson (nullable) + wantsToLeaveHome (default false) + commitmentStatus (default EXPLORING)', async () => {
    const slot = await createSaveSlot(deps, 'RC Mig Recruit');
    const dbPath = await findSlotDbPathById(deps, slot.id);
    const client = new PrismaClient({ datasources: { db: { url: `file:${dbPath!}` } } });
    try {
      const cols = await client.$queryRawUnsafe<
        Array<{ name: string; notnull: number; dflt_value: string | null }>
      >(`PRAGMA table_info("Recruit")`);
      const pj = cols.find((c) => c.name === 'prioritiesJson');
      const wlh = cols.find((c) => c.name === 'wantsToLeaveHome');
      const cs = cols.find((c) => c.name === 'commitmentStatus');
      expect(pj).toBeDefined();
      expect(pj!.notnull).toEqual(0n);
      expect(wlh).toBeDefined();
      expect(cs).toBeDefined();
      expect(cs!.dflt_value).toBe("'EXPLORING'");
    } finally {
      await client.$disconnect();
    }
  }, 120_000);

  it('idempotent re-apply via openSaveSlot — _prisma_migrations not duplicated', async () => {
    const slot = await createSaveSlot(deps, 'RC Mig Idem');
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
