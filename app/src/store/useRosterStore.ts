import { create } from 'zustand';
import type { rosterIpc, matchIpc } from '@vcd/shared';

type Status = 'idle' | 'loading' | 'ready' | 'error';
export type RosterMode = 'ratings' | 'stats';
type SeasonOk = Extract<matchIpc.SeasonAnalyticsResponse, { ok: true }>;

type RosterState = {
  players: rosterIpc.RosterPlayer[];
  selectedPlayerId: string | null;
  profile: rosterIpc.PlayerProfile | null;
  profileStatus: Status;
  status: Status;
  error: string | null;

  // Sprint 28: stats-mode toggle. When stats are loaded, RosterView swaps
  // the rating columns for season totals.
  mode: RosterMode;
  seasonStats: SeasonOk | null;
  statsStatus: Status;

  load: (slotId: string, teamId: string) => Promise<void>;
  loadStats: (slotId: string, teamId: string) => Promise<void>;
  setMode: (mode: RosterMode) => void;
  selectPlayer: (playerId: string | null) => void;
  loadProfile: (slotId: string, playerId: string) => Promise<void>;
  reset: () => void;
};

export const useRosterStore = create<RosterState>((set) => ({
  players: [],
  selectedPlayerId: null,
  profile: null,
  profileStatus: 'idle',
  status: 'idle',
  error: null,
  mode: 'ratings',
  seasonStats: null,
  statsStatus: 'idle',
  async load(slotId, teamId) {
    set({ status: 'loading', error: null });
    const res = await window.vcd.roster.listForTeam(slotId, teamId);
    if (!res.ok) {
      set({ status: 'error', error: res.error.message });
      return;
    }
    set({ players: res.players, status: 'ready' });
  },
  selectPlayer(playerId) {
    set({ selectedPlayerId: playerId });
    if (playerId === null) {
      set({ profile: null, profileStatus: 'idle' });
    }
  },
  async loadProfile(slotId, playerId) {
    set({ profileStatus: 'loading', error: null });
    const res = await window.vcd.roster.getProfile(slotId, playerId);
    if (!res.ok) {
      set({ profileStatus: 'error', error: res.error.message });
      return;
    }
    set({ profile: res.profile, profileStatus: 'ready' });
  },
  async loadStats(slotId, teamId) {
    set({ statsStatus: 'loading', error: null });
    const res = await window.vcd.match.seasonAnalytics(slotId, teamId);
    if (!res.ok) {
      set({ statsStatus: 'error', error: res.error.message });
      return;
    }
    set({ seasonStats: res, statsStatus: 'ready' });
  },
  setMode(mode) {
    set({ mode });
  },
  reset() {
    set({
      players: [],
      selectedPlayerId: null,
      profile: null,
      profileStatus: 'idle',
      status: 'idle',
      error: null,
      mode: 'ratings',
      seasonStats: null,
      statsStatus: 'idle',
    });
  },
}));
