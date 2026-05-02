import { create } from 'zustand';
import type { awardsIpc } from '@vcd/shared';

export type AwardEntry = awardsIpc.AwardEntry;
export type CareerEntry = awardsIpc.CareerEntry;
export type AaTeam = awardsIpc.AaTeam;

type AwardsState = {
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string | null;
  seasonYear: number | null;
  availableSeasons: number[];
  teams: Record<AaTeam, AwardEntry[]>;
  careerByPlayerId: Record<string, CareerEntry[]>;
  loadForSeason: (slotId: string, seasonYear: number) => Promise<void>;
  loadCareer: (slotId: string, playerId: string) => Promise<void>;
  reset: () => void;
};

const emptyTeams = (): Record<AaTeam, AwardEntry[]> => ({
  first: [],
  second: [],
  third: [],
  hm: [],
});

export const useAwardsStore = create<AwardsState>((set) => ({
  status: 'idle',
  error: null,
  seasonYear: null,
  availableSeasons: [],
  teams: emptyTeams(),
  careerByPlayerId: {},
  async loadForSeason(slotId, seasonYear) {
    set({ status: 'loading', error: null });
    const res = await window.vcd.awards.listForSeason(slotId, seasonYear);
    if (!res.ok) {
      set({ status: 'error', error: res.error.message });
      return;
    }
    set({
      status: 'ready',
      seasonYear: res.seasonYear,
      availableSeasons: res.availableSeasons,
      teams: res.teams,
    });
  },
  async loadCareer(slotId, playerId) {
    const res = await window.vcd.awards.careerForPlayer(slotId, playerId);
    if (!res.ok) {
      set({ error: res.error.message });
      return;
    }
    set((s) => ({ careerByPlayerId: { ...s.careerByPlayerId, [playerId]: res.awards } }));
  },
  reset: () =>
    set({
      status: 'idle',
      error: null,
      seasonYear: null,
      availableSeasons: [],
      teams: emptyTeams(),
      careerByPlayerId: {},
    }),
}));
