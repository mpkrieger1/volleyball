import { create } from 'zustand';
import type { seasonIpc } from '@vcd/shared';

type Progress = {
  totalMatches: number;
  completedMatches: number;
  phase: 'sim' | 'persist' | 'done';
};

type SeasonState = {
  currentWeek: number;
  phase: string;
  status: 'idle' | 'loading' | 'advancing' | 'error';
  error: string | null;
  progress: Progress | null;
  cancellationId: string | null;
  lastAdvanceElapsedMs: number | null;

  loadCurrentWeek: (slotId: string) => Promise<void>;
  advance: (slotId: string) => Promise<void>;
  cancel: () => Promise<void>;
};

export const useSeasonStore = create<SeasonState>((set, get) => ({
  currentWeek: 0,
  phase: 'PRESEASON',
  status: 'idle',
  error: null,
  progress: null,
  cancellationId: null,
  lastAdvanceElapsedMs: null,

  async loadCurrentWeek(slotId) {
    set({ status: 'loading', error: null });
    const res = await window.vcd.season.getCurrentWeek(slotId);
    if (!res.ok) {
      set({ status: 'error', error: res.error.message });
      return;
    }
    set({ currentWeek: res.currentWeek, phase: res.phase, status: 'idle' });
  },

  async advance(slotId) {
    const id = `adv-${Date.now()}-${crypto.randomUUID()}`;
    set({
      status: 'advancing',
      error: null,
      progress: null,
      cancellationId: id,
    });
    const unsub = window.vcd.season.onProgress((evt: seasonIpc.SeasonProgressEvent) => {
      if (evt.cancellationId !== id) return;
      set({
        progress: {
          totalMatches: evt.totalMatches,
          completedMatches: evt.completedMatches,
          phase: evt.phase,
        },
      });
    });
    try {
      const res = await window.vcd.season.advanceWeek({ slotId, cancellationId: id });
      if (!res.ok) {
        set({ status: 'error', error: res.error.message, cancellationId: null });
        return;
      }
      set({
        status: 'idle',
        currentWeek: res.week + 1,
        progress: null,
        cancellationId: null,
        lastAdvanceElapsedMs: res.elapsedMs,
      });
    } finally {
      unsub();
    }
  },

  async cancel() {
    const id = get().cancellationId;
    if (!id) return;
    await window.vcd.season.cancel(id);
  },
}));
