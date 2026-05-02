import type { offseasonIpc } from '@vcd/shared';
export type RosterRow = offseasonIpc.PreseasonRosterRow;
type OffseasonState = {
    phase: string;
    year: number;
    roster: RosterRow[];
    status: 'idle' | 'loading' | 'working' | 'ready' | 'error';
    error: string | null;
    load: (slotId: string, teamId: string) => Promise<void>;
    toggleRedshirt: (slotId: string, teamId: string, playerId: string, redshirtUsed: boolean) => Promise<void>;
    runOffseason: (slotId: string, teamId: string) => Promise<void>;
    startRegular: (slotId: string, teamId: string) => Promise<void>;
};
export declare const useOffseasonStore: import("zustand").UseBoundStore<import("zustand").StoreApi<OffseasonState>>;
export {};
//# sourceMappingURL=useOffseasonStore.d.ts.map