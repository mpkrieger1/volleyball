// Spawn the compiled simWorkerThread.js, send one request, await response.

import { describe, expect, it } from 'vitest';
import { Worker } from 'node:worker_threads';
import { resolve } from 'node:path';
import { sim, seasonIpc } from '@vcd/shared';

const scriptPath = resolve(__dirname, '../../../workers/dist/simWorkerThread.js');

const balanced = (): sim.PlayerRatings => ({
  attack: 50, block: 50, serve: 50, pass: 50, set: 50, dig: 50,
  athleticism: 50, iq: 50, stamina: 50,
});

const lineup = (team: sim.TeamSide): sim.PlayerLineup => ({
  team,
  players: Array.from({ length: 6 }, () => balanced()),
});

function runOnce(req: unknown): Promise<seasonIpc.WorkerSimResponse> {
  return new Promise((res, rej) => {
    const w = new Worker(scriptPath);
    w.on('message', async (msg) => {
      await w.terminate();
      res(msg as seasonIpc.WorkerSimResponse);
    });
    w.on('error', rej);
    w.postMessage(req);
  });
}

describe('simWorkerThread', () => {
  it('returns a schema-valid ok response for a valid request', async () => {
    const req: seasonIpc.WorkerSimRequest = {
      matchId: 'm-1',
      homeTeamId: 'home-team',
      awayTeamId: 'away-team',
      homeLineup: lineup('home'),
      awayLineup: lineup('away'),
      seed: 'thread-1',
    };
    const res = await runOnce(req);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.matchId).toBe('m-1');
      expect(['home-team', 'away-team']).toContain(res.winnerId);
      expect(() => sim.MatchBoxScoreSchema.parse(res.boxScore)).not.toThrow();
      expect(res.pbpJson.length).toBeGreaterThan(0);
    }
  }, 15_000);

  it('returns an error response for an invalid request', async () => {
    const res = await runOnce({ matchId: 'bad', garbage: true });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.matchId).toBe('bad');
  }, 15_000);
});
