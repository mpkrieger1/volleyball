// Sprint 34 — store for the SeasonHub PracticeFocusPicker tile.

import { create } from 'zustand';
import type { practiceFocusIpc } from '@vcd/shared';

type WeekState = practiceFocusIpc.GetWeekStateResponse extends infer T
  ? Extract<T, { ok: true }>
  : never;

type State = {
  weekState: WeekState | null;
  status: 'idle' | 'loading' | 'ready' | 'saving' | 'error';
  error: string | null;
  loadWeekState: (slotId: string, teamId: string, week: number) => Promise<void>;
  setPick: (
    slotId: string,
    teamId: string,
    week: number,
    offenseFocus: string,
    defenseFocus: string,
  ) => Promise<void>;
};

export const usePracticeFocusStore = create<State>((set, get) => ({
  weekState: null,
  status: 'idle',
  error: null,
  async loadWeekState(slotId, teamId, week) {
    set({ status: 'loading', error: null });
    const res = await window.vcd.practiceFocus.getWeekState({ slotId, teamId, week });
    if (!res.ok) {
      set({ status: 'error', error: res.error.message });
      return;
    }
    set({ weekState: res, status: 'ready' });
  },
  async setPick(slotId, teamId, week, offenseFocus, defenseFocus) {
    set({ status: 'saving', error: null });
    const res = await window.vcd.practiceFocus.setPick({
      slotId,
      teamId,
      week,
      offenseFocus,
      defenseFocus,
    });
    if (!res.ok) {
      set({ status: 'error', error: res.error.message });
      return;
    }
    await get().loadWeekState(slotId, teamId, week);
  },
}));
