import { create } from 'zustand';
import type { recruitingIpc } from '@vcd/shared';

export type BoardRecruit = recruitingIpc.BoardRecruitView;

type Filter = {
  position?: string;
  region?: string;
  minStars?: number;
};

type RecruitingState = {
  phase: string;
  week: number;
  budgetRemaining: number;
  recruits: BoardRecruit[];
  status: 'idle' | 'loading' | 'advancing' | 'ready' | 'error';
  error: string | null;
  filter: Filter;
  load: (slotId: string, teamId: string) => Promise<void>;
  setFilter: (f: Filter) => void;
  openCycle: (slotId: string, seasonYear: number, classSize?: number) => Promise<void>;
  performAction: (
    slotId: string,
    teamId: string,
    recruitId: string,
    action: recruitingIpc.RecruitingActionType,
  ) => Promise<void>;
  advanceWeek: (slotId: string, userTeamId: string | null) => Promise<void>;
  closeCycle: (slotId: string) => Promise<void>;
};

export const useRecruitingStore = create<RecruitingState>((set, get) => ({
  phase: 'OFFSEASON',
  week: 0,
  budgetRemaining: 0,
  recruits: [],
  status: 'idle',
  error: null,
  filter: {},
  async load(slotId, teamId) {
    set({ status: 'loading', error: null });
    const res = await window.vcd.recruiting.state(slotId, teamId);
    if (!res.ok) {
      set({ status: 'error', error: res.error.message });
      return;
    }
    set({
      phase: res.phase,
      week: res.week,
      budgetRemaining: res.budgetRemaining,
      recruits: res.recruits,
      status: 'ready',
    });
  },
  setFilter(f) {
    set({ filter: f });
  },
  async openCycle(slotId, seasonYear, classSize) {
    set({ status: 'advancing', error: null });
    const res = await window.vcd.recruiting.open(slotId, seasonYear, classSize);
    if (!res.ok) {
      set({ status: 'error', error: res.error.message });
      return;
    }
    set({ status: 'ready' });
  },
  async performAction(slotId, teamId, recruitId, action) {
    const res = await window.vcd.recruiting.action({ slotId, teamId, recruitId, action });
    if (!res.ok) {
      set({ error: res.error.message });
      return;
    }
    // Refresh board.
    await get().load(slotId, teamId);
  },
  async advanceWeek(slotId, userTeamId) {
    set({ status: 'advancing', error: null });
    const res = await window.vcd.recruiting.advance(slotId, userTeamId);
    if (!res.ok) {
      set({ status: 'error', error: res.error.message });
      return;
    }
    set({ status: 'ready' });
  },
  async closeCycle(slotId) {
    set({ status: 'advancing', error: null });
    const res = await window.vcd.recruiting.close(slotId);
    if (!res.ok) {
      set({ status: 'error', error: res.error.message });
      return;
    }
    set({ status: 'ready' });
  },
}));
