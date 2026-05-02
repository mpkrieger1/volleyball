type Status = 'idle' | 'loading' | 'ready' | 'error';
type UserTeamState = {
    userTeamId: string | null;
    status: Status;
    error: string | null;
    load: (slotId: string) => Promise<void>;
    set: (slotId: string, teamId: string) => Promise<void>;
    reset: () => void;
};
export declare const useUserTeamStore: import("zustand").UseBoundStore<import("zustand").StoreApi<UserTeamState>>;
export {};
//# sourceMappingURL=useUserTeamStore.d.ts.map