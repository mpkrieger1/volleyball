import type { coachingIpc } from '@vcd/shared';
export type StaffRow = coachingIpc.StaffRow;
export type PoolRow = coachingIpc.PoolRow;
type CoachingState = {
    staff: StaffRow[];
    pool: PoolRow[];
    budgetCents: number;
    status: 'idle' | 'loading' | 'working' | 'ready' | 'error';
    error: string | null;
    load: (slotId: string, teamId: string) => Promise<void>;
    fire: (slotId: string, teamId: string, coachId: string) => Promise<void>;
    hire: (req: {
        slotId: string;
        teamId: string;
        poolId: string;
        role: 'HC' | 'AHC' | 'AC';
        contractYears: number;
        salaryCents: number;
    }) => Promise<void>;
};
export declare const useCoachingStore: import("zustand").UseBoundStore<import("zustand").StoreApi<CoachingState>>;
export {};
//# sourceMappingURL=useCoachingStore.d.ts.map