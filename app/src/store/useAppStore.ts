import { create } from 'zustand';

export type AppState = {
  userName: string;
  setUserName: (name: string) => void;
};

export const useAppStore = create<AppState>((set) => ({
  userName: 'Coach',
  setUserName: (name) => set({ userName: name }),
}));
