// Sprint 34 Task 34.5 — practiceFocus IPC handlers + opponent summary.
//
// Drives the upsert + WEEK_ALREADY_PLAYED guard end-to-end via direct
// service calls (not via ipcMain.invoke; same pattern as Sprint 33's
// offseason integration tests).

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
import { resolvePicksForTeam } from '../../../main/src/practiceFocus/loadPicks';

const repoRoot = resolve(__dirname, '../../..');

let tmpDir: string;
let deps: SaveSlotServiceDeps;
let dbPath: string;
let client: PrismaClient;

beforeAll(async () => {
  tmpDir = mkdtempSync(join(tmpdir(), 'vcd-pf-ipc-'));
  deps = { repoRoot, baseDir: tmpDir };
  const slot = await createSaveSlot(deps, 'PF IPC');
  const path = await findSlotDbPathById(deps, slot.id);
  if (!path) throw new Error('save slot path not found');
  dbPath = path;
  client = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });
  // Ensure Season is in REGULAR for the WEEK_ALREADY_PLAYED guard test.
  await client.season.update({
    where: { year: 2026 },
    data: { phase: 'REGULAR', currentWeek: 0 },
  });
}, 240_000);

afterAll(async () => {
  await client?.$disconnect();
  rmSync(tmpDir, { recursive: true, force: true });
});

describe('Sprint 34 — practiceFocus IPC + resolvePicksForTeam', () => {
  it('resolvePicksForTeam returns auto-suggestion when no pick exists', async () => {
    const teams = await client.team.findMany({ take: 2 });
    const me = teams[0]!;
    const opponent = teams[1]!;
    const r = await resolvePicksForTeam(client, 2026, 0, me.id, opponent.id);
    expect(r.fromUserPick).toBe(false);
    expect(r.offenseFocus).toBe(r.autoOffenseSuggestion);
    expect(r.defenseFocus).toBe(r.autoDefenseSuggestion);
  });

  it('upsert creates a row; resolvePicksForTeam returns the user pick after', async () => {
    const teams = await client.team.findMany({ take: 2 });
    const me = teams[0]!;
    const opponent = teams[1]!;
    await client.practiceFocusPick.upsert({
      where: {
        seasonYear_week_teamId: { seasonYear: 2026, week: 1, teamId: me.id },
      },
      create: {
        seasonYear: 2026,
        week: 1,
        teamId: me.id,
        offenseFocus: 'POWER_HITTING',
        defenseFocus: 'BLOCK_HEAVY',
      },
      update: {
        offenseFocus: 'POWER_HITTING',
        defenseFocus: 'BLOCK_HEAVY',
      },
    });
    const r = await resolvePicksForTeam(client, 2026, 1, me.id, opponent.id);
    expect(r.fromUserPick).toBe(true);
    expect(r.offenseFocus).toBe('POWER_HITTING');
    expect(r.defenseFocus).toBe('BLOCK_HEAVY');
  });

  it('upsert replaces the existing pick (idempotent + replace semantics)', async () => {
    const teams = await client.team.findMany({ take: 2 });
    const me = teams[0]!;
    const opponent = teams[1]!;
    await client.practiceFocusPick.upsert({
      where: {
        seasonYear_week_teamId: { seasonYear: 2026, week: 1, teamId: me.id },
      },
      create: {
        seasonYear: 2026,
        week: 1,
        teamId: me.id,
        offenseFocus: 'BALL_CONTROL',
        defenseFocus: 'SERVE_RECEIVE_FOCUS',
      },
      update: {
        offenseFocus: 'BALL_CONTROL',
        defenseFocus: 'SERVE_RECEIVE_FOCUS',
      },
    });
    const r = await resolvePicksForTeam(client, 2026, 1, me.id, opponent.id);
    expect(r.offenseFocus).toBe('BALL_CONTROL');
    expect(r.defenseFocus).toBe('SERVE_RECEIVE_FOCUS');
  });

  it('opponent summary is well-formed (returns the FALLBACK structure when no PMS rows)', async () => {
    const teams = await client.team.findMany({ take: 2 });
    const me = teams[0]!;
    const opponent = teams[1]!;
    const r = await resolvePicksForTeam(client, 2026, 0, me.id, opponent.id);
    expect(r.opponentSummary.serveAceRate).toBeGreaterThanOrEqual(0);
    expect(r.opponentSummary.hittingPct).toBeGreaterThan(-1);
    expect(r.opponentSummary.hittingPct).toBeLessThan(1);
    expect(r.opponentSummary.blockPerSet).toBeGreaterThanOrEqual(0);
  });
});
