// Sprint 29 Task 29.3: Zustand store driving the Live Play Hub.
// Sprint 30 Task 30.5: extended with timeout / substitution actions.

import { create } from 'zustand';
import type { sim, liveMatchIpc } from '@vcd/shared';

type LiveMatchState = sim.LiveMatchState;
type SkillKey = liveMatchIpc.SkillKey;

export type LivePlayPhase =
  | 'idle'
  | 'starting'
  | 'ready'
  | 'playing'
  | 'paused'
  | 'finished'
  | 'error';

export type LivePlayState = {
  phase: LivePlayPhase;
  slotId: string | null;
  matchId: string | null;
  state: LiveMatchState | null;
  /** Last reason play stopped (e.g. set_complete, set_point). */
  pausedFor: string | null;
  /** Per-team display names from the match's teams. */
  homeName: string | null;
  awayName: string | null;
  error: string | null;
  /**
   * Retro fix #8: highest setIndex for which the user has dismissed or
   * saved the rotation editor. -1 = haven't seen any. Lives in store
   * (not component state) so it survives navigation away/back during
   * a single match.
   */
  rotationEditorSeenForSet: number;
  markRotationEditorSeen: (setIndex: number) => void;

  startNewMatch: (slotId: string, homeTeamId: string, awayTeamId: string, homeName: string, awayName: string) => Promise<void>;
  resumeMatch: (slotId: string, matchId: string, homeName: string, awayName: string) => Promise<void>;
  playRallies: (n: number) => Promise<void>;
  playToSetEnd: () => Promise<void>;
  playToMatchEnd: () => Promise<void>;
  pause: () => Promise<void>;
  simulateRest: () => Promise<void>;
  /** Sprint 30 Task 30.5: call a timeout for the user team. Optional skill = +5% boost target. */
  callTimeout: (skill?: SkillKey) => Promise<void>;
  /** Sprint 30 Task 30.5: substitute a bench player into a slot. */
  substitute: (outIdx: number, inPlayerId: string) => Promise<void>;
  /** Sprint 31 Task 31.1: apply a rotation editor save. */
  setRotation: (req: liveMatchIpc.LiveSetRotationRequest) => Promise<void>;
  /** Clear the most recent banner (e.g., opponent-action). */
  clearBanner: () => void;
  reset: () => void;
};

export const useLivePlayStore = create<LivePlayState>((set, get) => ({
  phase: 'idle',
  slotId: null,
  matchId: null,
  state: null,
  pausedFor: null,
  homeName: null,
  awayName: null,
  error: null,
  rotationEditorSeenForSet: -1,
  markRotationEditorSeen(setIndex) {
    set((prev) => ({
      rotationEditorSeenForSet: Math.max(prev.rotationEditorSeenForSet, setIndex),
    }));
  },

  async startNewMatch(slotId, homeTeamId, awayTeamId, homeName, awayName) {
    set({
      phase: 'starting',
      slotId,
      matchId: null,
      state: null,
      pausedFor: null,
      homeName,
      awayName,
      error: null,
    });
    const res = await window.vcd.match.live.createAndStart({
      slotId,
      homeTeamId,
      awayTeamId,
      useCoachAi: true,
      useLiveMomentum: true,
    });
    if (!res.ok) {
      set({ phase: 'error', error: res.error.message });
      return;
    }
    set({ phase: 'ready', matchId: res.matchId, state: res.state });
  },

  async resumeMatch(slotId, matchId, homeName, awayName) {
    set({
      phase: 'starting',
      slotId,
      matchId,
      state: null,
      pausedFor: null,
      homeName,
      awayName,
      error: null,
    });
    const res = await window.vcd.match.live.resume(slotId, matchId);
    if (!res.ok) {
      set({ phase: 'error', error: res.error.message });
      return;
    }
    set({ phase: 'ready', state: res.state });
  },

  async playRallies(n) {
    const { slotId, matchId } = get();
    if (!slotId || !matchId) return;
    set({ phase: 'playing' });
    const res = await window.vcd.match.live.playRallies(slotId, matchId, n);
    if (!res.ok) {
      set({ phase: 'error', error: res.error.message });
      return;
    }
    const finished = res.state.status === 'finished';
    set({
      phase: finished ? 'finished' : 'paused',
      state: res.state,
      pausedFor: res.pausedFor,
    });
  },

  async playToSetEnd() {
    const { slotId, matchId } = get();
    if (!slotId || !matchId) return;
    set({ phase: 'playing' });
    const res = await window.vcd.match.live.playToSetEnd(slotId, matchId);
    if (!res.ok) {
      set({ phase: 'error', error: res.error.message });
      return;
    }
    const finished = res.state.status === 'finished';
    set({
      phase: finished ? 'finished' : 'paused',
      state: res.state,
      pausedFor: res.pausedFor,
    });
  },

  async playToMatchEnd() {
    const { slotId, matchId } = get();
    if (!slotId || !matchId) return;
    set({ phase: 'playing' });
    const res = await window.vcd.match.live.playToMatchEnd(slotId, matchId);
    if (!res.ok) {
      set({ phase: 'error', error: res.error.message });
      return;
    }
    const finished = res.state.status === 'finished';
    set({
      phase: finished ? 'finished' : 'paused',
      state: res.state,
      pausedFor: res.pausedFor,
    });
  },

  async callTimeout(skill) {
    const { slotId, matchId } = get();
    if (!slotId || !matchId) return;
    const res = await window.vcd.match.live.callTimeout(slotId, matchId, skill);
    if (!res.ok) {
      set({ error: res.error.message });
      return;
    }
    set({ state: res.state, error: null });
  },

  async substitute(outIdx, inPlayerId) {
    const { slotId, matchId } = get();
    if (!slotId || !matchId) return;
    const res = await window.vcd.match.live.substitute(slotId, matchId, outIdx, inPlayerId);
    if (!res.ok) {
      set({ error: res.error.message });
      return;
    }
    set({ state: res.state, error: null });
  },

  async setRotation(req) {
    const { slotId, matchId } = get();
    if (!slotId || !matchId) return;
    const res = await window.vcd.match.live.setRotation({ ...req, slotId, matchId });
    if (!res.ok) {
      set({ error: res.error.message });
      return;
    }
    set({ state: res.state, error: null });
  },

  clearBanner() {
    set({ pausedFor: null });
  },

  async pause() {
    const { slotId, matchId } = get();
    if (!slotId || !matchId) return;
    const res = await window.vcd.match.live.pause(slotId, matchId);
    if (!res.ok) {
      set({ phase: 'error', error: res.error.message });
      return;
    }
    set({ phase: 'idle' });
  },

  async simulateRest() {
    const { slotId, matchId } = get();
    if (!slotId || !matchId) return;
    set({ phase: 'playing' });
    const res = await window.vcd.match.live.simulateRest(slotId, matchId);
    if (!res.ok) {
      set({ phase: 'error', error: res.error.message });
      return;
    }
    set({ phase: 'finished' });
  },

  reset() {
    const { slotId, matchId } = get();
    if (slotId && matchId) {
      // Best-effort dispose so the registry doesn't leak.
      void window.vcd.match.live.dispose(slotId, matchId);
    }
    set({
      phase: 'idle',
      slotId: null,
      matchId: null,
      state: null,
      pausedFor: null,
      homeName: null,
      awayName: null,
      error: null,
      rotationEditorSeenForSet: -1,
    });
  },
}));
