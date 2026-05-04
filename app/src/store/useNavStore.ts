import { create } from 'zustand';

export type ActiveScreen =
  | 'season-hub'
  | 'match-hub'
  | 'schedule'
  | 'roster'
  | 'season' // Sprint 28: parent for poll/bracket/standings/awards
  | 'poll'
  | 'bracket'
  | 'recruiting'
  | 'portal'
  | 'nil'
  | 'offseason'
  | 'staff'
  | 'awards'
  | 'analytics'
  | 'standings'
  | 'depth-chart'
  | 'settings';

type NavState = {
  screen: ActiveScreen;
  setScreen: (s: ActiveScreen) => void;
};

// Sprint 26 (Task 26.5): default landing post-pick is the Season Hub
// dashboard, not the Match Hub. Replaces the audit-flagged "you land in
// a debug screen" gap. Match Hub remains accessible via the nav.
export const useNavStore = create<NavState>((set) => ({
  screen: 'season-hub',
  setScreen: (s) => set({ screen: s }),
}));
