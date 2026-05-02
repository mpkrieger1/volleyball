export type ActiveScreen = 'match-hub' | 'schedule' | 'poll' | 'bracket' | 'recruiting' | 'portal' | 'nil' | 'offseason' | 'staff' | 'awards' | 'analytics';
type NavState = {
    screen: ActiveScreen;
    setScreen: (s: ActiveScreen) => void;
};
export declare const useNavStore: import("zustand").UseBoundStore<import("zustand").StoreApi<NavState>>;
export {};
//# sourceMappingURL=useNavStore.d.ts.map