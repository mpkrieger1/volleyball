// Sprint 27 Task 27.5: standings store. Hydrates conference standings,
// RPI top-25, and stat leaders in one IPC round-trip.

import { create } from 'zustand';
import type { standingsIpc } from '@vcd/shared';

type StandingsState = {
  conferenceStandings: standingsIpc.ConferenceStandingRow[];
  rpiTop25: standingsIpc.RpiTop25Row[];
  statLeaders: Partial<Record<standingsIpc.StatCategory, standingsIpc.StatLeaderRow[]>>;
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string | null;
  loadOverview: (slotId: string) => Promise<void>;
};

export const useStandingsStore = create<StandingsState>((set) => ({
  conferenceStandings: [],
  rpiTop25: [],
  statLeaders: {},
  status: 'idle',
  error: null,
  async loadOverview(slotId) {
    set({ status: 'loading', error: null });
    const res = await window.vcd.standings.getOverview(slotId);
    if (!res.ok) {
      set({ status: 'error', error: res.error.message });
      return;
    }
    set({
      conferenceStandings: res.conferenceStandings,
      rpiTop25: res.rpiTop25,
      statLeaders: res.statLeaders,
      status: 'ready',
    });
  },
}));
