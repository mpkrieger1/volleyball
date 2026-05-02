import { create } from 'zustand';
import type { matchIpc, scheduleIpc } from '@vcd/shared';

type TeamSummary = matchIpc.TeamSummary;
type Row = scheduleIpc.TeamScheduleRow;
type ScheduleStats = {
  totalMatches: number;
  confMatches: number;
  nonConfMatches: number;
  tournamentMatches: number;
};

type ScheduleState = {
  teams: TeamSummary[];
  selectedTeamId: string | null;
  rows: Row[];
  status: 'idle' | 'loading' | 'ready' | 'generating' | 'error';
  error: string | null;
  stats: ScheduleStats | null;

  loadTeams: (slotId: string) => Promise<void>;
  selectTeam: (slotId: string, teamId: string) => Promise<void>;
  generate: (slotId: string, seed?: string) => Promise<void>;
};

export const useScheduleStore = create<ScheduleState>((set, get) => ({
  teams: [],
  selectedTeamId: null,
  rows: [],
  status: 'idle',
  error: null,
  stats: null,

  async loadTeams(slotId) {
    set({ status: 'loading', error: null });
    const res = await window.vcd.match.listTeams(slotId);
    if (!res.ok) {
      set({ status: 'error', error: res.error.message });
      return;
    }
    set({ teams: res.teams, status: 'ready' });
  },

  async selectTeam(slotId, teamId) {
    set({ selectedTeamId: teamId, status: 'loading', error: null });
    const res = await window.vcd.schedule.listForTeam(slotId, teamId);
    if (!res.ok) {
      set({ status: 'error', error: res.error.message, rows: [] });
      return;
    }
    set({ rows: res.rows, status: 'ready' });
  },

  async generate(slotId, seed) {
    set({ status: 'generating', error: null });
    const res = await window.vcd.schedule.generate({
      slotId,
      seasonYear: 2026,
      seed: seed ?? 'user-generated',
    });
    if (!res.ok) {
      set({ status: 'error', error: res.error.message });
      return;
    }
    set({ stats: res.stats, status: 'ready' });
    // Refresh the currently-selected team's rows.
    const { selectedTeamId } = get();
    if (selectedTeamId) {
      await get().selectTeam(slotId, selectedTeamId);
    }
  },
}));
