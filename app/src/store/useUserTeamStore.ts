import { create } from 'zustand';

type Status = 'idle' | 'loading' | 'ready' | 'error';

type UserTeamState = {
  userTeamId: string | null;
  status: Status;
  error: string | null;
  load: (slotId: string) => Promise<void>;
  set: (slotId: string, teamId: string) => Promise<void>;
  reset: () => void;
};

export const useUserTeamStore = create<UserTeamState>((set) => ({
  userTeamId: null,
  status: 'idle',
  error: null,
  async load(slotId) {
    set({ status: 'loading', error: null });
    const res = await window.vcd.season.getUserTeam(slotId);
    if (!res.ok) {
      set({ status: 'error', error: res.error.message });
      return;
    }
    set({ userTeamId: res.userTeamId, status: 'ready' });
  },
  async set(slotId, teamId) {
    set({ status: 'loading', error: null });
    const res = await window.vcd.season.setUserTeam(slotId, teamId);
    if (!res.ok) {
      set({ status: 'error', error: res.error.message });
      return;
    }
    set({ userTeamId: res.userTeamId, status: 'ready' });
  },
  reset() {
    set({ userTeamId: null, status: 'idle', error: null });
  },
}));
