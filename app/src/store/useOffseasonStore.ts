import { create } from 'zustand';
import type { offseasonIpc } from '@vcd/shared';

export type RosterRow = offseasonIpc.PreseasonRosterRow;

type OffseasonState = {
  // Sprint 28 fields (kept for back-compat with existing callers).
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

  // Sprint 33: event-aware fields.
  phaseWeek: number;
  event: string | null;
  trainingFocus: { coaches: offseasonIpc.CoachSlotInfo[]; facilitiesLevel: number } | null;
  trainingResults: offseasonIpc.TrainingResultRow[];
  loadEventState: (slotId: string, teamId: string) => Promise<void>;
  setTrainingFocusPick: (
    slotId: string,
    teamId: string,
    coachId: string,
    slotIndex: number,
    attribute: string,
  ) => Promise<void>;
  advanceEvent: (slotId: string, teamId: string) => Promise<void>;
  loadTrainingResults: (slotId: string, teamId: string, seasonYear: number) => Promise<void>;
};

export const useOffseasonStore = create<OffseasonState>((set, get) => ({
  phase: 'OFFSEASON',
  year: 2026,
  roster: [],
  status: 'idle',
  error: null,
  phaseWeek: 0,
  event: null,
  trainingFocus: null,
  trainingResults: [],
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
  async loadEventState(slotId, teamId) {
    const res = await window.vcd.offseason.getEventState(slotId, teamId);
    if (!res.ok) {
      set({ error: res.error.message });
      return;
    }
    set({
      phase: res.phase,
      year: res.year,
      phaseWeek: res.phaseWeek,
      event: res.event,
      trainingFocus: res.trainingFocus,
      status: 'ready',
    });
  },
  async setTrainingFocusPick(slotId, teamId, coachId, slotIndex, attribute) {
    const res = await window.vcd.offseason.setTrainingFocusPick({
      slotId,
      teamId,
      coachId,
      slotIndex,
      attribute,
    });
    if (!res.ok) {
      set({ error: res.error.message });
      return;
    }
    await get().loadEventState(slotId, teamId);
  },
  async advanceEvent(slotId, teamId) {
    set({ status: 'working', error: null });
    const res = await window.vcd.offseason.advanceEvent({ slotId, teamId });
    if (!res.ok) {
      set({ status: 'error', error: res.error.message });
      return;
    }
    await get().loadEventState(slotId, teamId);
  },
  async loadTrainingResults(slotId, teamId, seasonYear) {
    const res = await window.vcd.offseason.listTrainingResults({
      slotId,
      teamId,
      seasonYear,
    });
    if (!res.ok) {
      set({ error: res.error.message });
      return;
    }
    set({ trainingResults: res.rows });
  },
}));
