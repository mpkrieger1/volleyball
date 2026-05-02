import { create } from 'zustand';
import type { nilIpc } from '@vcd/shared';

export type NilRow = nilIpc.NilRosterRowView;

type NilState = {
  collectiveBudget: number;
  totalSpent: number;
  remaining: number;
  enthusiasm: number;
  roster: NilRow[];
  status: 'idle' | 'loading' | 'working' | 'ready' | 'error';
  error: string | null;
  load: (slotId: string, teamId: string) => Promise<void>;
  assign: (slotId: string, teamId: string, playerId: string, amountCents: number) => Promise<void>;
  revoke: (slotId: string, teamId: string, playerId: string) => Promise<void>;
  autoDistribute: (slotId: string, teamId: string) => Promise<void>;
};

export const useNilStore = create<NilState>((set, get) => ({
  collectiveBudget: 0,
  totalSpent: 0,
  remaining: 0,
  enthusiasm: 50,
  roster: [],
  status: 'idle',
  error: null,
  async load(slotId, teamId) {
    set({ status: 'loading', error: null });
    const res = await window.vcd.nil.state(slotId, teamId);
    if (!res.ok) {
      set({ status: 'error', error: res.error.message });
      return;
    }
    set({
      collectiveBudget: res.collectiveBudget,
      totalSpent: res.totalSpent,
      remaining: res.remaining,
      enthusiasm: res.enthusiasm,
      roster: res.roster,
      status: 'ready',
    });
  },
  async assign(slotId, teamId, playerId, amountCents) {
    const res = await window.vcd.nil.assign({ slotId, teamId, playerId, amountCents });
    if (!res.ok) {
      set({ error: res.error.message });
      return;
    }
    await get().load(slotId, teamId);
  },
  async revoke(slotId, teamId, playerId) {
    const res = await window.vcd.nil.revoke({ slotId, teamId, playerId });
    if (!res.ok) {
      set({ error: res.error.message });
      return;
    }
    await get().load(slotId, teamId);
  },
  async autoDistribute(slotId, teamId) {
    set({ status: 'working', error: null });
    const res = await window.vcd.nil.autoDistribute(slotId, teamId);
    if (!res.ok) {
      set({ status: 'error', error: res.error.message });
      return;
    }
    await get().load(slotId, teamId);
  },
}));
