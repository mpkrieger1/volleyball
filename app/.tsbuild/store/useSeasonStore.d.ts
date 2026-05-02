type Progress = {
    totalMatches: number;
    completedMatches: number;
    phase: 'sim' | 'persist' | 'done';
};
type SeasonState = {
    currentWeek: number;
    phase: string;
    status: 'idle' | 'loading' | 'advancing' | 'error';
    error: string | null;
    progress: Progress | null;
    cancellationId: string | null;
    lastAdvanceElapsedMs: number | null;
    loadCurrentWeek: (slotId: string) => Promise<void>;
    advance: (slotId: string) => Promise<void>;
    cancel: () => Promise<void>;
};
export declare const useSeasonStore: import("zustand").UseBoundStore<import("zustand").StoreApi<SeasonState>>;
export {};
//# sourceMappingURL=useSeasonStore.d.ts.map