// Sprint 29 Task 29.4: live-match IPC handlers.

import { ipcMain } from 'electron';
import { liveMatchIpc } from '@vcd/shared';
import { findSlotDbPathById, type SaveSlotServiceDeps } from '../saveSlots/service';
import {
  startLiveMatch,
  createAndStartLiveMatch,
  getLiveState,
  playRallies,
  playToSetEnd,
  playToMatchEnd,
  pauseLiveMatch,
  disposeLiveMatch,
  hasPausedLiveMatch,
  hasActiveLiveMatch,
  simulateRestOfLiveMatch,
  callUserTimeout,
  callUserSubstitution,
  applySetRotation,
  listPausedLiveMatches,
  LiveMatchError,
} from '../match/liveMatchService';

function toIpcError(err: unknown) {
  if (err instanceof LiveMatchError) {
    return { ok: false as const, error: { code: err.code, message: err.message } };
  }
  return {
    ok: false as const,
    error: { code: 'INTERNAL' as const, message: (err as Error).message },
  };
}

async function resolveSlotDb(deps: SaveSlotServiceDeps, slotId: string): Promise<string> {
  const dbPath = await findSlotDbPathById(deps, slotId);
  if (!dbPath) throw new LiveMatchError('NOT_FOUND', `slot ${slotId} not found`);
  return dbPath;
}

export function registerLiveMatchHandlers(deps: SaveSlotServiceDeps): void {
  ipcMain.handle(liveMatchIpc.LIVE_MATCH_IPC_CHANNELS.createAndStart, async (_e, raw: unknown) => {
    try {
      const req = liveMatchIpc.LiveCreateAndStartRequest.parse(raw);
      const dbPath = await resolveSlotDb(deps, req.slotId);
      const result = await createAndStartLiveMatch({
        dbPath,
        slotId: req.slotId,
        homeTeamId: req.homeTeamId,
        awayTeamId: req.awayTeamId,
        ...(req.seed !== undefined && { seed: req.seed }),
        ...(req.useCoachAi !== undefined && { useCoachAi: req.useCoachAi }),
        ...(req.useLiveMomentum !== undefined && { useLiveMomentum: req.useLiveMomentum }),
        ...(req.userTeam && { userTeam: req.userTeam }),
      });
      return { ok: true as const, state: result.state, matchId: result.matchId };
    } catch (err) {
      return toIpcError(err);
    }
  });

  ipcMain.handle(liveMatchIpc.LIVE_MATCH_IPC_CHANNELS.start, async (_e, raw: unknown) => {
    try {
      const req = liveMatchIpc.LiveStartRequest.parse(raw);
      const dbPath = await resolveSlotDb(deps, req.slotId);
      const result = await startLiveMatch({
        dbPath,
        slotId: req.slotId,
        matchId: req.matchId,
        ...(req.seed !== undefined && { seed: req.seed }),
        ...(req.useCoachAi !== undefined && { useCoachAi: req.useCoachAi }),
        ...(req.useLiveMomentum !== undefined && { useLiveMomentum: req.useLiveMomentum }),
        ...(req.userTeam && { userTeam: req.userTeam }),
      });
      return { ok: true as const, state: result.state, resumed: result.resumed };
    } catch (err) {
      return toIpcError(err);
    }
  });

  ipcMain.handle(liveMatchIpc.LIVE_MATCH_IPC_CHANNELS.getState, async (_e, raw: unknown) => {
    try {
      const req = liveMatchIpc.LiveGetStateRequest.parse(raw);
      const state = getLiveState(req.slotId, req.matchId);
      return { ok: true as const, state };
    } catch (err) {
      return toIpcError(err);
    }
  });

  ipcMain.handle(liveMatchIpc.LIVE_MATCH_IPC_CHANNELS.playRallies, async (_e, raw: unknown) => {
    try {
      const req = liveMatchIpc.LivePlayRalliesRequest.parse(raw);
      const result = playRallies(req.slotId, req.matchId, req.n);
      return {
        ok: true as const,
        state: result.state,
        ralliesPlayed: result.ralliesPlayed,
        pausedFor: result.pausedFor,
      };
    } catch (err) {
      return toIpcError(err);
    }
  });

  ipcMain.handle(liveMatchIpc.LIVE_MATCH_IPC_CHANNELS.playToSetEnd, async (_e, raw: unknown) => {
    try {
      const req = liveMatchIpc.LivePlayToBoundaryRequest.parse(raw);
      const result = playToSetEnd(req.slotId, req.matchId);
      return {
        ok: true as const,
        state: result.state,
        ralliesPlayed: result.ralliesPlayed,
        pausedFor: result.pausedFor,
      };
    } catch (err) {
      return toIpcError(err);
    }
  });

  ipcMain.handle(liveMatchIpc.LIVE_MATCH_IPC_CHANNELS.playToMatchEnd, async (_e, raw: unknown) => {
    try {
      const req = liveMatchIpc.LivePlayToBoundaryRequest.parse(raw);
      const result = playToMatchEnd(req.slotId, req.matchId);
      return {
        ok: true as const,
        state: result.state,
        ralliesPlayed: result.ralliesPlayed,
        pausedFor: result.pausedFor,
      };
    } catch (err) {
      return toIpcError(err);
    }
  });

  ipcMain.handle(liveMatchIpc.LIVE_MATCH_IPC_CHANNELS.pause, async (_e, raw: unknown) => {
    try {
      const req = liveMatchIpc.LivePauseRequest.parse(raw);
      const dbPath = await resolveSlotDb(deps, req.slotId);
      await pauseLiveMatch(dbPath, req.slotId, req.matchId);
      return { ok: true as const };
    } catch (err) {
      return toIpcError(err);
    }
  });

  ipcMain.handle(liveMatchIpc.LIVE_MATCH_IPC_CHANNELS.resume, async (_e, raw: unknown) => {
    try {
      const req = liveMatchIpc.LiveResumeRequest.parse(raw);
      const dbPath = await resolveSlotDb(deps, req.slotId);
      // Resume = start with paused state already in DB.
      const result = await startLiveMatch({
        dbPath,
        slotId: req.slotId,
        matchId: req.matchId,
      });
      return { ok: true as const, state: result.state, resumed: result.resumed };
    } catch (err) {
      return toIpcError(err);
    }
  });

  ipcMain.handle(liveMatchIpc.LIVE_MATCH_IPC_CHANNELS.simulateRest, async (_e, raw: unknown) => {
    try {
      const req = liveMatchIpc.LiveSimulateRestRequest.parse(raw);
      const dbPath = await resolveSlotDb(deps, req.slotId);
      await simulateRestOfLiveMatch(dbPath, req.slotId, req.matchId);
      return { ok: true as const };
    } catch (err) {
      return toIpcError(err);
    }
  });

  ipcMain.handle(liveMatchIpc.LIVE_MATCH_IPC_CHANNELS.dispose, async (_e, raw: unknown) => {
    try {
      const req = liveMatchIpc.LiveDisposeRequest.parse(raw);
      disposeLiveMatch(req.slotId, req.matchId);
      return { ok: true as const };
    } catch (err) {
      return toIpcError(err);
    }
  });

  ipcMain.handle(liveMatchIpc.LIVE_MATCH_IPC_CHANNELS.hasPaused, async (_e, raw: unknown) => {
    try {
      const req = liveMatchIpc.LiveHasPausedRequest.parse(raw);
      const dbPath = await resolveSlotDb(deps, req.slotId);
      const hasPaused = await hasPausedLiveMatch(dbPath, req.matchId);
      return { ok: true as const, hasPaused };
    } catch (err) {
      return toIpcError(err);
    }
  });

  ipcMain.handle(liveMatchIpc.LIVE_MATCH_IPC_CHANNELS.callTimeout, async (_e, raw: unknown) => {
    try {
      const req = liveMatchIpc.LiveCallTimeoutRequest.parse(raw);
      const state = callUserTimeout(req.slotId, req.matchId, req.skill);
      return { ok: true as const, state };
    } catch (err) {
      return toIpcError(err);
    }
  });

  ipcMain.handle(liveMatchIpc.LIVE_MATCH_IPC_CHANNELS.substitute, async (_e, raw: unknown) => {
    try {
      const req = liveMatchIpc.LiveSubstituteRequest.parse(raw);
      const state = callUserSubstitution(req.slotId, req.matchId, req.outIdx, req.inPlayerId);
      return { ok: true as const, state };
    } catch (err) {
      return toIpcError(err);
    }
  });

  ipcMain.handle(liveMatchIpc.LIVE_MATCH_IPC_CHANNELS.setRotation, async (_e, raw: unknown) => {
    try {
      const req = liveMatchIpc.LiveSetRotationRequest.parse(raw);
      const state = applySetRotation(req.slotId, req.matchId, {
        slots: req.slots,
        system: req.system,
        libero: req.libero,
        ...(req.setterSlot ? { setterSlot: req.setterSlot } : {}),
        ...(req.setterSlotsTwo ? { setterSlotsTwo: req.setterSlotsTwo } : {}),
        hint: req.hint,
      });
      return { ok: true as const, state };
    } catch (err) {
      return toIpcError(err);
    }
  });

  ipcMain.handle(liveMatchIpc.LIVE_MATCH_IPC_CHANNELS.listPaused, async (_e, raw: unknown) => {
    try {
      const req = liveMatchIpc.LiveListPausedRequest.parse(raw);
      const dbPath = await resolveSlotDb(deps, req.slotId);
      const matches = await listPausedLiveMatches(dbPath);
      return { ok: true as const, matches };
    } catch (err) {
      return toIpcError(err);
    }
  });

  ipcMain.handle(liveMatchIpc.LIVE_MATCH_IPC_CHANNELS.hasActive, async (_e, raw: unknown) => {
    try {
      const req = liveMatchIpc.LiveHasActiveRequest.parse(raw);
      const result = hasActiveLiveMatch(req.slotId);
      return { ok: true as const, hasActive: result.hasActive, matchIds: result.matchIds };
    } catch (err) {
      return toIpcError(err);
    }
  });
}
