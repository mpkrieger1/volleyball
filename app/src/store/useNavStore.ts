import { create } from 'zustand';

export type ActiveScreen = 'match-hub' | 'schedule' | 'poll' | 'bracket' | 'recruiting' | 'portal' | 'nil' | 'offseason' | 'staff' | 'awards' | 'analytics';

type NavState = {
  screen: ActiveScreen;
  setScreen: (s: ActiveScreen) => void;
};

export const useNavStore = create<NavState>((set) => ({
  screen: 'match-hub',
  setScreen: (s) => set({ screen: s }),
}));
