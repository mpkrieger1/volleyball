import { create } from 'zustand';
import type { offseasonIpc } from '@vcd/shared';

export type RosterRow = offseasonIpc.PreseasonRosterRow;

type OffseasonState = {
  phase: string;
  year: number;
  roster: RosterRow[];
  status: 'idle' | 'loading' | 'working' | 'ready' | 'error';
  error: string | null;
  load: (slotId: string, teamId: string) => Promise<void>;
  toggleRedshirt: (
    slotId: string,
    teamId: string,
    playerId: string,
    redshirtUsed: boolean,
  ) => Promise<void>;
  runOffseason: (slotId: string, teamId: string) => Promise<void>;
  startRegular: (slotId: string, teamId: string) => Promise<void>;
};

export const useOffseasonStore = create<OffseasonState>((set, get) => ({
  phase: 'OFFSEASON',
  year: 2026,
  roster: [],
  status: 'idle',
  error: null,
  async load(slotId, teamId) {
    set({ status: 'loading', error: null });
    const res = await window.vcd.offseason.preseasonState(slotId, teamId);
    if (!res.ok) {
      set({ status: 'error', error: res.error.message });
      return;
    }
    set({ phase: res.phase, year: res.year, roster: res.roster, status: 'ready' });
  },
  async toggleRedshirt(slotId, teamId, playerId, redshirtUsed) {
    const res = await window.vcd.offseason.toggleRedshirt({
      slotId,
      teamId,
      playerId,
      redshirtUsed,
    });
    if (!res.ok) {
      set({ error: res.error.message });
      return;
    }
    await get().load(slotId, teamId);
  },
  async runOffseason(slotId, teamId) {
    set({ status: 'working', error: null });
    const res = await window.vcd.offseason.run(slotId);
    if (!res.ok) {
      set({ status: 'error', error: res.error.message });
      return;
    }
    await get().load(slotId, teamId);
  },
  async startRegular(slotId, teamId) {
    set({ status: 'working', error: null });
    const res = await window.vcd.offseason.startRegular(slotId);
    if (!res.ok) {
      set({ status: 'error', error: res.error.message });
      return;
    }
    await get().load(slotId, teamId);
  },
}));
