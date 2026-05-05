import { create } from 'zustand';
import type { recruitingIpc } from '@vcd/shared';

export type BoardRecruit = recruitingIpc.BoardRecruitView;

type Filter = {
  position?: string;
  region?: string;
  minStars?: number;
};

export type RecruitingTab = 'all' | 'targets' | 'commits';

type RecruitingState = {
  phase: string;
  week: number;
  budgetRemaining: number;
  recruits: BoardRecruit[];
  status: 'idle' | 'loading' | 'advancing' | 'ready' | 'error';
  error: string | null;
  filter: Filter;
  tab: RecruitingTab;

  // Sprint 28: detail modal state.
  detailOpen: boolean;
  detail: recruitingIpc.RecruitDetailView | null;
  detailStatus: 'idle' | 'loading' | 'ready' | 'error';

  // Sprint 28: enriched header state (budget breakdown, team needs).
  budget: {
    total: number;
    spent: number;
    remaining: number;
    breakdown: { base: number; hc: number; ahc: number; ac: number };
  } | null;
  teamNeeds: recruitingIpc.PositionNeed[];

  load: (slotId: string, teamId: string) => Promise<void>;
  setFilter: (f: Filter) => void;
  setTab: (t: RecruitingTab) => void;
  openCycle: (slotId: string, seasonYear: number, classSize?: number) => Promise<void>;
  performAction: (
    slotId: string,
    teamId: string,
    recruitId: string,
    action: recruitingIpc.RecruitingActionType,
  ) => Promise<void>;
  advanceWeek: (slotId: string, userTeamId: string | null) => Promise<void>;
  closeCycle: (slotId: string) => Promise<void>;
  openDetail: (slotId: string, teamId: string, recruitId: string) => Promise<void>;
  closeDetail: () => void;
  loadHeader: (slotId: string, teamId: string) => Promise<void>;
  /** Sprint 37 Task 37.4: NIL slider confirm hook. */
  setNilOffer: (
    slotId: string,
    teamId: string,
    recruitId: string,
    offerCents: number,
  ) => Promise<void>;
};

export const useRecruitingStore = create<RecruitingState>((set, get) => ({
  phase: 'OFFSEASON',
  week: 0,
  budgetRemaining: 0,
  recruits: [],
  status: 'idle',
  error: null,
  filter: {},
  tab: 'targets',
  detailOpen: false,
  detail: null,
  detailStatus: 'idle',
  budget: null,
  teamNeeds: [],
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
    // Lazy-load header data in parallel.
    void get().loadHeader(slotId, teamId);
  },
  setFilter(f) {
    set({ filter: f });
  },
  setTab(t) {
    set({ tab: t });
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
    await get().load(slotId, teamId);
    // If the modal is open for this recruit, refresh detail too.
    const { detailOpen, detail } = get();
    if (detailOpen && detail?.recruitId === recruitId) {
      await get().openDetail(slotId, teamId, recruitId);
    }
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
  async openDetail(slotId, teamId, recruitId) {
    set({ detailOpen: true, detailStatus: 'loading', detail: null });
    const res = await window.vcd.recruiting.detail(slotId, teamId, recruitId);
    if (!res.ok) {
      set({ detailStatus: 'error', error: res.error.message });
      return;
    }
    set({ detail: res.detail, detailStatus: 'ready' });
  },
  closeDetail() {
    set({ detailOpen: false, detail: null, detailStatus: 'idle' });
  },
  async loadHeader(slotId, teamId) {
    const [b, n] = await Promise.all([
      window.vcd.recruiting.budget(slotId, teamId),
      window.vcd.recruiting.teamNeeds(slotId, teamId),
    ]);
    if (b.ok) {
      set({
        budget: {
          total: b.total,
          spent: b.spent,
          remaining: b.remaining,
          breakdown: b.breakdown,
        },
      });
    }
    if (n.ok) {
      set({ teamNeeds: n.needs });
    }
  },
  async setNilOffer(slotId, teamId, recruitId, offerCents) {
    const res = await window.vcd.recruiting.setNilOffer({
      slotId,
      teamId,
      recruitId,
      offerCents,
    });
    if (!res.ok) {
      set({ error: res.error.message });
      return;
    }
    // Reload the modal payload so the new offer + budget reflect.
    const fresh = await window.vcd.recruiting.detail(slotId, teamId, recruitId);
    if (fresh.ok) {
      set({ detail: fresh.detail });
    }
  },
}));
