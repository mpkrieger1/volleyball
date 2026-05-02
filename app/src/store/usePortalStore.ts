import { create } from 'zustand';
import type { portalIpc } from '@vcd/shared';

export type PortalEntry = portalIpc.PortalEntryView;

type PortalFilter = { position?: string };

type PortalState = {
  phase: string;
  week: number;
  budgetRemaining: number;
  incoming: PortalEntry[];
  outgoing: PortalEntry[];
  status: 'idle' | 'loading' | 'advancing' | 'ready' | 'error';
  error: string | null;
  tab: 'incoming' | 'outgoing';
  filter: PortalFilter;
  load: (slotId: string, teamId: string) => Promise<void>;
  setTab: (t: 'incoming' | 'outgoing') => void;
  setFilter: (f: PortalFilter) => void;
  openPortal: (slotId: string) => Promise<void>;
  performAction: (
    slotId: string,
    teamId: string,
    transferPortalId: string,
    action: portalIpc.PortalActionType,
    nilAmountCents?: number,
  ) => Promise<void>;
  advance: (slotId: string, userTeamId: string | null) => Promise<void>;
  close: (slotId: string) => Promise<void>;
};

export const usePortalStore = create<PortalState>((set, get) => ({
  phase: 'OFFSEASON',
  week: 0,
  budgetRemaining: 0,
  incoming: [],
  outgoing: [],
  status: 'idle',
  error: null,
  tab: 'incoming',
  filter: {},
  async load(slotId, teamId) {
    set({ status: 'loading', error: null });
    const res = await window.vcd.portal.state(slotId, teamId);
    if (!res.ok) {
      set({ status: 'error', error: res.error.message });
      return;
    }
    set({
      phase: res.phase,
      week: res.week,
      budgetRemaining: res.budgetRemaining,
      incoming: res.incoming,
      outgoing: res.outgoing,
      status: 'ready',
    });
  },
  setTab(t) {
    set({ tab: t });
  },
  setFilter(f) {
    set({ filter: f });
  },
  async openPortal(slotId) {
    set({ status: 'advancing', error: null });
    const res = await window.vcd.portal.open(slotId);
    if (!res.ok) {
      set({ status: 'error', error: res.error.message });
      return;
    }
    set({ status: 'ready' });
  },
  async performAction(slotId, teamId, transferPortalId, action, nilAmountCents) {
    const res = await window.vcd.portal.action({
      slotId,
      teamId,
      transferPortalId,
      action,
      ...(nilAmountCents ? { nilAmountCents } : {}),
    });
    if (!res.ok) {
      set({ error: res.error.message });
      return;
    }
    await get().load(slotId, teamId);
  },
  async advance(slotId, userTeamId) {
    set({ status: 'advancing', error: null });
    const res = await window.vcd.portal.advance(slotId, userTeamId);
    if (!res.ok) {
      set({ status: 'error', error: res.error.message });
      return;
    }
    set({ status: 'ready' });
  },
  async close(slotId) {
    set({ status: 'advancing', error: null });
    const res = await window.vcd.portal.close(slotId);
    if (!res.ok) {
      set({ status: 'error', error: res.error.message });
      return;
    }
    set({ status: 'ready' });
  },
}));
