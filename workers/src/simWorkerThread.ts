// Worker-thread entry. Main spawns this via `new Worker(...)`. The worker
// listens for WorkerSimRequest messages on parentPort, runs simulateMatch +
// computeBoxScore + serializeMatchPbp, and posts back a WorkerSimResponse.
//
// No DB access. No Electron APIs. Pure CPU-bound work so multiple workers
// can run in parallel.

import { parentPort } from 'node:worker_threads';
import { sim, seasonIpc } from '@vcd/shared';
import { simulateMatch } from './sim/match';
import { buildMatchTimeline } from './sim/buildTimeline';
import type { TeamMatchState } from './sim/set';

if (!parentPort) {
  throw new Error('simWorkerThread must be spawned as a worker_thread');
}

parentPort.on('message', (raw: unknown) => {
  const parsed = seasonIpc.WorkerSimRequest.safeParse(raw);
  if (!parsed.success) {
    const bad: seasonIpc.WorkerSimResponse = {
      ok: false,
      matchId: (raw as { matchId?: string })?.matchId ?? 'unknown',
      error: `Invalid request: ${parsed.error.message.slice(0, 400)}`,
    };
    parentPort!.postMessage(bad);
    return;
  }
  const req = parsed.data;
  try {
    const home: TeamMatchState = {
      lineup: req.homeLineup,
      rotation: sim.initialRotation(),
      libero: sim.liberoOff(5),
      setterIndex: 0,
      system: sim.defaultSystem51(),
    };
    const away: TeamMatchState = {
      lineup: req.awayLineup,
      rotation: sim.initialRotation(),
      libero: sim.liberoOff(5),
      setterIndex: 0,
      system: sim.defaultSystem51(),
    };
    const match = simulateMatch({
      seed: req.seed,
      home,
      away,
      initialServer: 'home',
      useCoachAi: true,
    });
    const boxScore = sim.computeBoxScore(match);
    const pbpJson = sim.serializeMatchPbp(match);
    const winnerId = match.winner === 'home' ? req.homeTeamId : req.awayTeamId;
    const setScores = match.sets.map((s) => ({ home: s.homeScore, away: s.awayScore }));
    const timeline: sim.MatchTimeline = buildMatchTimeline(match);

    const response: seasonIpc.WorkerSimResponse = {
      ok: true,
      matchId: req.matchId,
      homeTeamId: req.homeTeamId,
      awayTeamId: req.awayTeamId,
      winnerId,
      boxScore,
      pbpJson,
      setScores,
      timeline,
    };
    parentPort!.postMessage(response);
  } catch (err) {
    const response: seasonIpc.WorkerSimResponse = {
      ok: false,
      matchId: req.matchId,
      error: (err as Error).message,
    };
    parentPort!.postMessage(response);
  }
});
