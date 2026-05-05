// Sprint 32 Task 32.1 — fresh-league seed populates Team.facilitiesLevel
// from the prestige tier. Spot-checks five teams across all four tiers.

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
import { deriveFacilitiesLevel } from '@vcd/shared/seed';

const repoRoot = resolve(__dirname, '../../..');

let tmpDir: string;
let deps: SaveSlotServiceDeps;

beforeAll(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'vcd-fac-seed-'));
  deps = { repoRoot, baseDir: tmpDir };
}, 90_000);

afterAll(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe('Sprint 32 — Team.facilitiesLevel seed', () => {
  it('every team has facilitiesLevel matching the prestige tier', async () => {
    const slot = await createSaveSlot(deps, 'Seed Test');
    const dbPath = await findSlotDbPathById(deps, slot.id);
    expect(dbPath).not.toBeNull();
    const client = new PrismaClient({ datasources: { db: { url: `file:${dbPath!}` } } });
    try {
      const teams = await client.team.findMany({
        select: { id: true, abbr: true, prestige: true, facilitiesLevel: true },
      });
      expect(teams.length).toBeGreaterThan(300); // PRD: ~340 D-I W teams

      // Every team's facilitiesLevel must match deriveFacilitiesLevel(prestige).
      for (const t of teams) {
        expect(t.facilitiesLevel).toBe(deriveFacilitiesLevel(t.prestige));
      }

      // Spot-check coverage: confirm we have teams in each tier so the
      // assertion isn't vacuous on any branch.
      const byTier = {
        elite: teams.filter((t) => t.prestige >= 90),
        high: teams.filter((t) => t.prestige >= 75 && t.prestige < 90),
        mid: teams.filter((t) => t.prestige >= 50 && t.prestige < 75),
        low: teams.filter((t) => t.prestige < 50),
      };
      expect(byTier.elite.length).toBeGreaterThan(0);
      expect(byTier.high.length).toBeGreaterThan(0);
      expect(byTier.mid.length).toBeGreaterThan(0);
      expect(byTier.low.length).toBeGreaterThan(0);

      expect(byTier.elite.every((t) => t.facilitiesLevel === 7)).toBe(true);
      expect(byTier.high.every((t) => t.facilitiesLevel === 5)).toBe(true);
      expect(byTier.mid.every((t) => t.facilitiesLevel === 4)).toBe(true);
      expect(byTier.low.every((t) => t.facilitiesLevel === 3)).toBe(true);
    } finally {
      await client.$disconnect();
    }
  }, 180_000);
});
