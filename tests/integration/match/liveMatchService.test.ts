// Sprint 29 Task 29.4 + 29.5: end-to-end live-match service.
// Validates start → playRallies → pause → resume → simulateRest +
// hasActive / hasPaused / dispose lifecycle.

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import {
  startLiveMatch,
  getLiveState,
  playRallies,
  pauseLiveMatch,
  hasPausedLiveMatch,
  hasActiveLiveMatch,
  disposeLiveMatch,
  simulateRestOfLiveMatch,
  _resetRegistryForTests,
  registrySize,
} from '../../../main/src/match/liveMatchService';

const repoRoot = resolve(__dirname, '../../..');
let tmpDir: string;
let dbPath: string;
let client: PrismaClient;
let teamA: string;
let teamB: string;

beforeAll(async () => {
  tmpDir = mkdtempSync(join(tmpdir(), 'vcd-livesvc-'));
  dbPath = join(tmpDir, 'game.db');
  const env = { ...process.env, DATABASE_URL: `file:${dbPath}` };
  execSync(`npx prisma migrate deploy`, { cwd: repoRoot, env, stdio: 'pipe' });
  execSync(`npx tsx prisma/seed.ts`, { cwd: repoRoot, env, stdio: 'pipe' });
  client = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });
  const teams = await client.team.findMany({ take: 2, orderBy: { abbr: 'asc' } });
  teamA = teams[0]!.id;
  teamB = teams[1]!.id;
}, 90_000);

afterAll(async () => {
  await client?.$disconnect();
  rmSync(tmpDir, { recursive: true, force: true });
});

beforeEach(() => {
  _resetRegistryForTests();
});

const SLOT = 'svc-slot';

async function makeMatch(): Promise<string> {
  const m = await client.match.create({
    data: {
      homeTeamId: teamA,
      awayTeamId: teamB,
      date: new Date(),
      week: 1,
      isConference: false,
    },
  });
  return m.id;
}

describe('liveMatchService — start / play / dispose', () => {
  it('start → returns initial state, registers match', async () => {
    const matchId = await makeMatch();
    const result = await startLiveMatch({
      dbPath,
      slotId: SLOT,
      matchId,
      seed: 'svc-1',
      useCoachAi: false,
      useLiveMomentum: false,
    });
    expect(result.resumed).toBe(false);
    expect(result.state.matchId).toBe(matchId);
    expect(result.state.status).toBe('in_progress');
    expect(result.state.currentSet.index).toBe(0);
    expect(registrySize()).toBe(1);

    // hasActive reports the match.
    const active = hasActiveLiveMatch(SLOT);
    expect(active.hasActive).toBe(true);
    expect(active.matchIds).toContain(matchId);
  });

  it('playRallies advances state', async () => {
    const matchId = await makeMatch();
    await startLiveMatch({
      dbPath,
      slotId: SLOT,
      matchId,
      seed: 'svc-2',
      useCoachAi: false,
      useLiveMomentum: false,
    });
    const result = playRallies(SLOT, matchId, 5);
    expect(result.ralliesPlayed).toBeGreaterThan(0);
    expect(result.ralliesPlayed).toBeLessThanOrEqual(5);
    expect(getLiveState(SLOT, matchId).rallyCursor).toBe(result.ralliesPlayed);
  });

  it('dispose removes match without persisting', async () => {
    const matchId = await makeMatch();
    await startLiveMatch({
      dbPath,
      slotId: SLOT,
      matchId,
      seed: 'svc-3',
      useCoachAi: false,
    });
    expect(registrySize()).toBe(1);
    disposeLiveMatch(SLOT, matchId);
    expect(registrySize()).toBe(0);
    expect(() => getLiveState(SLOT, matchId)).toThrow(/not in registry/);
    expect(await hasPausedLiveMatch(dbPath, matchId)).toBe(false);
  });
});

describe('liveMatchService — pause / resume', () => {
  it('pause persists state to DB and clears registry', async () => {
    const matchId = await makeMatch();
    await startLiveMatch({
      dbPath,
      slotId: SLOT,
      matchId,
      seed: 'svc-pause',
      useCoachAi: true,
      useLiveMomentum: true,
    });
    playRallies(SLOT, matchId, 25);

    await pauseLiveMatch(dbPath, SLOT, matchId);
    expect(registrySize()).toBe(0);
    expect(await hasPausedLiveMatch(dbPath, matchId)).toBe(true);

    const dbRow = await client.match.findUnique({ where: { id: matchId } });
    expect(dbRow?.liveStateJson).not.toBeNull();
    expect(dbRow?.coachActionsJson).toBe('[]');
  });

  it('resume reloads paused state byte-equal', async () => {
    const matchId = await makeMatch();
    await startLiveMatch({
      dbPath,
      slotId: SLOT,
      matchId,
      seed: 'svc-resume',
      useCoachAi: false,
      useLiveMomentum: false,
    });
    playRallies(SLOT, matchId, 10);
    const beforePause = JSON.parse(JSON.stringify(getLiveState(SLOT, matchId)));

    await pauseLiveMatch(dbPath, SLOT, matchId);
    const resumed = await startLiveMatch({
      dbPath,
      slotId: SLOT,
      matchId,
    });
    expect(resumed.resumed).toBe(true);
    expect(resumed.state).toEqual(beforePause);
  });
});

describe('liveMatchService — simulateRest', () => {
  it('completes the match and persists final box score', async () => {
    const matchId = await makeMatch();
    await startLiveMatch({
      dbPath,
      slotId: SLOT,
      matchId,
      seed: 'svc-rest',
      useCoachAi: false,
      useLiveMomentum: false,
    });
    playRallies(SLOT, matchId, 15);
    const before = getLiveState(SLOT, matchId);
    expect(before.status).toBe('in_progress');

    const done = await simulateRestOfLiveMatch(dbPath, SLOT, matchId);
    expect(done.matchId).toBe(matchId);
    expect(['home', 'away']).toContain(done.winner);
    expect(registrySize()).toBe(0);

    const dbRow = await client.match.findUnique({ where: { id: matchId } });
    expect(dbRow?.liveStateJson).toBeNull(); // cleared
    expect(dbRow?.coachActionsJson).toBe('[]'); // preserved
    expect(dbRow?.boxScoreJson).not.toBeNull();
    expect(dbRow?.pbpJson).not.toBeNull();
    expect(dbRow?.timelineJson).not.toBeNull();
    expect(dbRow?.winnerId).not.toBeNull();
  });
});
