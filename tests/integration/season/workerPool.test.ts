import { afterEach, describe, expect, it } from 'vitest';
import { resolve } from 'node:path';
import { sim } from '@vcd/shared';
import { SimWorkerPool, PoolCancelledError } from '../../../main/src/season/workerPool';

const scriptPath = resolve(__dirname, '../../../workers/dist/simWorkerThread.js');

const balanced = (): sim.PlayerRatings => ({
  attack: 50, block: 50, serve: 50, pass: 50, set: 50, dig: 50,
  athleticism: 50, iq: 50, stamina: 50,
});

const lineup = (team: sim.TeamSide): sim.PlayerLineup => ({
  team,
  players: Array.from({ length: 6 }, () => balanced()),
});

const makeReq = (i: number) => ({
  matchId: `m-${i}`,
  homeTeamId: `h-${i}`,
  awayTeamId: `a-${i}`,
  homeLineup: lineup('home'),
  awayLineup: lineup('away'),
  seed: `pool-${i}`,
});

let pool: SimWorkerPool | null = null;

afterEach(async () => {
  if (pool) await pool.shutdown();
  pool = null;
});

describe('SimWorkerPool', () => {
  it('runs all submitted jobs to completion', async () => {
    pool = new SimWorkerPool({ scriptPath, workerCount: 2 });
    const reqs = Array.from({ length: 20 }, (_, i) => makeReq(i));
    const results = await Promise.all(reqs.map((r) => pool!.submit(r)));
    expect(results.length).toBe(20);
    for (const r of results) {
      expect(r.ok).toBe(true);
    }
  }, 30_000);

  it('uses multiple workers (both processed some jobs)', async () => {
    pool = new SimWorkerPool({ scriptPath, workerCount: 2 });
    // 4 synthetic jobs launched concurrently; with 2 workers the busyCount
    // should hit 2 at some point.
    const reqs = Array.from({ length: 4 }, (_, i) => makeReq(i));
    const promise = Promise.all(reqs.map((r) => pool!.submit(r)));
    // Busy measurement — give dispatch a tick.
    await new Promise((r) => setTimeout(r, 10));
    expect(pool.busyCount).toBeGreaterThanOrEqual(2);
    const res = await promise;
    expect(res.every((r) => r.ok)).toBe(true);
  }, 30_000);

  it('cancelQueued rejects queued jobs with PoolCancelledError', async () => {
    pool = new SimWorkerPool({ scriptPath, workerCount: 1 });
    // Submit many — one runs, rest queue.
    const reqs = Array.from({ length: 10 }, (_, i) => makeReq(i));
    const promises = reqs.map((r) => pool!.submit(r));
    pool.cancelQueued();
    const outcomes = await Promise.allSettled(promises);
    const rejectedCount = outcomes.filter(
      (o) => o.status === 'rejected' && (o.reason as Error) instanceof PoolCancelledError,
    ).length;
    expect(rejectedCount).toBeGreaterThan(0);
  }, 30_000);

  it('shutdown drains cleanly', async () => {
    pool = new SimWorkerPool({ scriptPath, workerCount: 2 });
    await pool.submit(makeReq(0));
    await pool.shutdown();
    pool = null; // skip afterEach shutdown
    // After shutdown, further submits reject.
    const again = new SimWorkerPool({ scriptPath, workerCount: 1 });
    await again.shutdown();
    await expect(again.submit(makeReq(99))).rejects.toThrow();
  }, 30_000);
});
