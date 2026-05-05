// Sprint 37 — championship aggregator integration test.

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
import { loadHcChampionships } from '../../../main/src/recruiting/championships';

const repoRoot = resolve(__dirname, '../../..');

let tmpDir: string;
let deps: SaveSlotServiceDeps;
let dbPath: string;
let client: PrismaClient;

beforeAll(async () => {
  tmpDir = mkdtempSync(join(tmpdir(), 'vcd-champ-'));
  deps = { repoRoot, baseDir: tmpDir };
  const slot = await createSaveSlot(deps, 'Champ Test');
  const path = await findSlotDbPathById(deps, slot.id);
  if (!path) throw new Error('save slot path not found');
  dbPath = path;
  client = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });
}, 240_000);

afterAll(async () => {
  await client?.$disconnect();
  rmSync(tmpDir, { recursive: true, force: true });
});

describe('loadHcChampionships', () => {
  it('returns empty history when team has no championships', async () => {
    const team = await client.team.findFirstOrThrow();
    const hc = await client.coach.findFirstOrThrow({ where: { teamId: team.id, role: 'HC' } });
    const out = await loadHcChampionships({
      client,
      teamId: team.id,
      hcId: hc.id,
      hcHireSeason: hc.hireSeason,
    });
    expect(out.coachId).toBe(hc.id);
    expect(out.nationalChampYears).toEqual([]);
    expect(out.confChampYears).toEqual([]);
  });

  it('counts national championships from Season.nationalChampionTeamId', async () => {
    const team = await client.team.findFirstOrThrow();
    const hc = await client.coach.findFirstOrThrow({ where: { teamId: team.id, role: 'HC' } });
    // Synthesize a 2024 + 2025 national title for this team.
    await client.season.upsert({
      where: { year: 2024 },
      create: { year: 2024, phase: 'OFFSEASON', currentWeek: 0, nationalChampionTeamId: team.id },
      update: { nationalChampionTeamId: team.id },
    });
    await client.season.upsert({
      where: { year: 2025 },
      create: { year: 2025, phase: 'OFFSEASON', currentWeek: 0, nationalChampionTeamId: team.id },
      update: { nationalChampionTeamId: team.id },
    });
    // Force hireSeason to 2024 so both synthetic titles fall within tenure.
    const out = await loadHcChampionships({
      client,
      teamId: team.id,
      hcId: hc.id,
      hcHireSeason: 2024,
    });
    expect(out.nationalChampYears.sort()).toEqual([2024, 2025]);
  });

  it('counts conference championships from Match.tournamentRound===CT_F + winnerId', async () => {
    const teams = await client.team.findMany({ take: 2 });
    const team = teams[0]!;
    const opp = teams[1]!;
    const hc = await client.coach.findFirstOrThrow({ where: { teamId: team.id, role: 'HC' } });
    // Synthesize a CT_F match with this team winning in 2026.
    await client.match.create({
      data: {
        date: new Date('2026-12-05T00:00:00Z'),
        week: 14,
        homeTeamId: team.id,
        awayTeamId: opp.id,
        winnerId: team.id,
        tournamentRound: 'CT_F',
        isTournament: true,
        isConference: true,
      },
    });
    const out = await loadHcChampionships({
      client,
      teamId: team.id,
      hcId: hc.id,
      hcHireSeason: hc.hireSeason,
    });
    expect(out.confChampYears).toContain(2026);
  });

  it('excludes championships before hireSeason', async () => {
    const team = await client.team.findFirstOrThrow();
    const hc = await client.coach.findFirstOrThrow({ where: { teamId: team.id, role: 'HC' } });
    // Use a hireSeason of 9999 so the synthetic 2024/2025 nat champs are excluded.
    const out = await loadHcChampionships({
      client,
      teamId: team.id,
      hcId: hc.id,
      hcHireSeason: 9999,
    });
    expect(out.nationalChampYears).toEqual([]);
  });
});
