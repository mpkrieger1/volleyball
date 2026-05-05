// Sprint 29 Task 29.5: migration + Match.liveStateJson / coachActionsJson
// persistence. Verifies the columns exist, default to NULL, can store and
// round-trip a serialized LiveMatchState, and that the LiveMatchStateSchema
// validates the round-tripped state.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { sim } from '@vcd/shared';
import {
  createLiveMatchState,
  LiveMatchStateSchema,
  serializeCoachActionLog,
  parseCoachActionLog,
  type TeamLiveState,
} from '@vcd/shared/sim/live/state';

const repoRoot = resolve(__dirname, '../../..');
let tmpDir: string;
let dbPath: string;
let client: PrismaClient;

const balanced = (): sim.PlayerRatings => ({
  attack: 50, block: 50, serve: 50, pass: 50, set: 50, dig: 50,
  athleticism: 50, iq: 50, stamina: 50,
});

const liveTeam = (team: sim.TeamSide): TeamLiveState => ({
  lineup: { team, players: Array.from({ length: 6 }, () => balanced()) },
  rotation: sim.initialRotation(),
  libero: sim.liberoOff(5),
  setterIndex: 0,
  system: sim.defaultSystem51(),
});

beforeAll(async () => {
  tmpDir = mkdtempSync(join(tmpdir(), 'vcd-livestate-'));
  dbPath = join(tmpDir, 'game.db');
  const env = { ...process.env, DATABASE_URL: `file:${dbPath}` };
  execSync(`npx prisma migrate deploy`, { cwd: repoRoot, env, stdio: 'pipe' });
  execSync(`npx tsx prisma/seed.ts`, { cwd: repoRoot, env, stdio: 'pipe' });
  client = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });
}, 90_000);

afterAll(async () => {
  await client?.$disconnect();
  rmSync(tmpDir, { recursive: true, force: true });
});

describe('Match.liveStateJson + coachActionsJson columns (Sprint 29 Task 29.5)', () => {
  it('a fresh match has both columns null', async () => {
    const teams = await client.team.findMany({ take: 2, orderBy: { abbr: 'asc' } });
    const m = await client.match.create({
      data: {
        homeTeamId: teams[0]!.id,
        awayTeamId: teams[1]!.id,
        date: new Date(),
        week: 1,
        isConference: false,
      },
    });
    expect(m.liveStateJson).toBeNull();
    expect(m.coachActionsJson).toBeNull();
  });

  it('round-trips a paused LiveMatchState', async () => {
    const state = createLiveMatchState({
      matchId: 'rt-1',
      seed: 'rt-seed',
      home: liveTeam('home'),
      away: liveTeam('away'),
      initialServer: 'home',
      useCoachAi: true,
      useLiveMomentum: true,
    });
    const teams = await client.team.findMany({ take: 2, orderBy: { abbr: 'asc' } });
    const m = await client.match.create({
      data: {
        homeTeamId: teams[0]!.id,
        awayTeamId: teams[1]!.id,
        date: new Date(),
        week: 2,
        isConference: false,
        liveStateJson: JSON.stringify(state),
        coachActionsJson: serializeCoachActionLog([]),
      },
    });

    const reread = await client.match.findUnique({ where: { id: m.id } });
    expect(reread?.liveStateJson).not.toBeNull();
    expect(reread?.coachActionsJson).toBe('[]');

    const parsedState = LiveMatchStateSchema.parse(JSON.parse(reread!.liveStateJson!));
    expect(parsedState).toEqual(state);

    expect(parseCoachActionLog(reread!.coachActionsJson)).toEqual([]);
  });

  it('clearing liveStateJson on completion sets it back to null', async () => {
    const teams = await client.team.findMany({ take: 2, orderBy: { abbr: 'asc' } });
    const m = await client.match.create({
      data: {
        homeTeamId: teams[0]!.id,
        awayTeamId: teams[1]!.id,
        date: new Date(),
        week: 3,
        isConference: false,
        liveStateJson: '{"placeholder":true}',
        coachActionsJson: '[]',
      },
    });
    await client.match.update({
      where: { id: m.id },
      data: { liveStateJson: null },
    });
    const reread = await client.match.findUnique({ where: { id: m.id } });
    expect(reread?.liveStateJson).toBeNull();
    // coachActionsJson is preserved — it's the audit trail.
    expect(reread?.coachActionsJson).toBe('[]');
  });
});
