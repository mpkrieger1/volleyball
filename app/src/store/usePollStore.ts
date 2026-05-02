import { create } from 'zustand';
import type { pollIpc } from '@vcd/shared';

type Row = pollIpc.PollRowView;

type PollState = {
  week: number;
  rows: Row[];
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string | null;
  load: (slotId: string) => Promise<void>;
};

export const usePollStore = create<PollState>((set) => ({
  week: 0,
  rows: [],
  status: 'idle',
  error: null,
  async load(slotId) {
    set({ status: 'loading', error: null });
    const res = await window.vcd.poll.latest(slotId);
    if (!res.ok) {
      set({ status: 'error', error: res.error.message });
      return;
    }
    set({ week: res.week, rows: res.rows, status: 'ready' });
  },
}));
