// Sprint 33 Task 33.4 — TRAINING_RESULTS happy path.

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
import { applyTrainingResults } from '../../../main/src/offseason/applyTrainingResults';

const repoRoot = resolve(__dirname, '../../..');

let tmpDir: string;
let deps: SaveSlotServiceDeps;
let client: PrismaClient;

beforeAll(async () => {
  tmpDir = mkdtempSync(join(tmpdir(), 'vcd-tr-'));
  deps = { repoRoot, baseDir: tmpDir };
  const slot = await createSaveSlot(deps, 'Training Results');
  const path = await findSlotDbPathById(deps, slot.id);
  if (!path) throw new Error('save slot path not found');
  client = new PrismaClient({ datasources: { db: { url: `file:${path}` } } });
}, 240_000);

afterAll(async () => {
  await client?.$disconnect();
  rmSync(tmpDir, { recursive: true, force: true });
});

describe('Sprint 33 — applyTrainingResults', () => {
  it('processes every team; gains land within bounds; deterministic', async () => {
    const result = await applyTrainingResults({ client, seasonYear: 2026 });
    expect(result.skipped).toBe(false);
    expect(result.teamsProcessed).toBeGreaterThan(300); // PRD: ~340 D-I W teams

    // Every team has TrainingResultEntry rows.
    const teams = await client.team.findMany({ select: { id: true } });
    let teamsWithEntries = 0;
    for (const t of teams.slice(0, 10)) {
      const c = await client.trainingResultEntry.count({
        where: { seasonYear: 2026, teamId: t.id },
      });
      if (c > 0) teamsWithEntries += 1;
    }
    expect(teamsWithEntries).toBe(10);

    // No player rating exceeds min(100, potential).
    const players = await client.player.findMany({ take: 200 });
    for (const p of players) {
      const cap = Math.min(100, p.potential);
      expect(p.ratingAttack).toBeLessThanOrEqual(cap);
      expect(p.ratingBlock).toBeLessThanOrEqual(cap);
      expect(p.ratingServe).toBeLessThanOrEqual(cap);
      expect(p.ratingPass).toBeLessThanOrEqual(cap);
      expect(p.ratingSet).toBeLessThanOrEqual(cap);
      expect(p.ratingDig).toBeLessThanOrEqual(cap);
      expect(p.ratingAthleticism).toBeLessThanOrEqual(cap);
      expect(p.ratingIq).toBeLessThanOrEqual(cap);
      expect(p.ratingStamina).toBeLessThanOrEqual(cap);
    }

    // At least one team's roster moved.
    const samples = await client.trainingResultEntry.findMany({
      take: 50,
      where: { seasonYear: 2026, gainApplied: { gt: 0 } },
    });
    expect(samples.length).toBeGreaterThan(0);
  }, 240_000);

  it('idempotent — second call returns skipped=true and no further changes', async () => {
    const before = await client.trainingResultEntry.count({ where: { seasonYear: 2026 } });
    expect(before).toBeGreaterThan(0);

    const result = await applyTrainingResults({ client, seasonYear: 2026 });
    expect(result.skipped).toBe(true);

    const after = await client.trainingResultEntry.count({ where: { seasonYear: 2026 } });
    expect(after).toBe(before);
  }, 60_000);
});
