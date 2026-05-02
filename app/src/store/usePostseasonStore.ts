import { create } from 'zustand';
import type { postseasonIpc } from '@vcd/shared';

export type TourneyMatch = postseasonIpc.TourneyMatchView;

/** Which view the BracketView screen is showing. Sprint 11. */
export type View = 'conf' | 'ncaa' | 'champion';
export type Region = 'REGION_1' | 'REGION_2' | 'REGION_3' | 'REGION_4' | 'FINAL_FOUR';

type PostseasonState = {
  phase: string;
  seasonYear: number;
  championTeamId: string | null;
  championTeamSchool: string | null;
  matches: TourneyMatch[];
  status: 'idle' | 'loading' | 'advancing' | 'ready' | 'error';
  error: string | null;
  /** Which view is visible — persists across nav switches (exit test 3). */
  view: View;
  /** Selected region tab on the NCAA screen — persists across nav switches. */
  selectedRegion: Region;
  /** Selected conference id on the CT screen (null = show all). */
  selectedConferenceId: string | null;
  load: (slotId: string) => Promise<void>;
  setView: (v: View) => void;
  setRegion: (r: Region) => void;
  setConferenceId: (id: string | null) => void;
  startCt: (slotId: string) => Promise<void>;
  startNcaa: (slotId: string, seasonYear: number) => Promise<void>;
  advanceRound: (slotId: string, round: postseasonIpc.TournamentRound) => Promise<void>;
};

export const usePostseasonStore = create<PostseasonState>((set, get) => ({
  phase: 'REGULAR',
  seasonYear: 2026,
  championTeamId: null,
  championTeamSchool: null,
  matches: [],
  status: 'idle',
  error: null,
  view: 'conf',
  selectedRegion: 'REGION_1',
  selectedConferenceId: null,
  async load(slotId) {
    set({ status: 'loading', error: null });
    const res = await window.vcd.postseason.getState(slotId);
    if (!res.ok) {
      set({ status: 'error', error: res.error.message });
      return;
    }
    // Auto-select view based on phase (only on first load — preserve user
    // navigation on subsequent loads).
    const current = get();
    const autoView: View =
      res.championTeamId != null
        ? 'champion'
        : res.phase === 'NCAA'
          ? 'ncaa'
          : 'conf';
    const view = current.status === 'idle' ? autoView : current.view;
    set({
      phase: res.phase,
      seasonYear: res.seasonYear,
      championTeamId: res.championTeamId,
      championTeamSchool: res.championTeamSchool,
      matches: res.matches,
      status: 'ready',
      view,
    });
  },
  setView(v) {
    set({ view: v });
  },
  setRegion(r) {
    set({ selectedRegion: r });
  },
  setConferenceId(id) {
    set({ selectedConferenceId: id });
  },
  async startCt(slotId) {
    set({ status: 'advancing', error: null });
    const res = await window.vcd.postseason.startCt(slotId);
    if (!res.ok) {
      set({ status: 'error', error: res.error.message });
      return;
    }
    await get().load(slotId);
  },
  async startNcaa(slotId, seasonYear) {
    set({ status: 'advancing', error: null });
    const res = await window.vcd.postseason.startNcaa(slotId, seasonYear);
    if (!res.ok) {
      set({ status: 'error', error: res.error.message });
      return;
    }
    await get().load(slotId);
  },
  async advanceRound(slotId, round) {
    set({ status: 'advancing', error: null });
    const res = await window.vcd.postseason.advanceRound(slotId, round);
    if (!res.ok) {
      set({ status: 'error', error: res.error.message });
      return;
    }
    await get().load(slotId);
  },
}));
