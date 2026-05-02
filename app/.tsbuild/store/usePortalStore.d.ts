import type { portalIpc } from '@vcd/shared';
export type PortalEntry = portalIpc.PortalEntryView;
type PortalFilter = {
    position?: string;
};
type PortalState = {
    phase: string;
    week: number;
    budgetRemaining: number;
    incoming: PortalEntry[];
    outgoing: PortalEntry[];
    status: 'idle' | 'loading' | 'advancing' | 'ready' | 'error';
    error: string | null;
    tab: 'incoming' | 'outgoing';
    filter: PortalFilter;
    load: (slotId: string, teamId: string) => Promise<void>;
    setTab: (t: 'incoming' | 'outgoing') => void;
    setFilter: (f: PortalFilter) => void;
    openPortal: (slotId: string) => Promise<void>;
    performAction: (slotId: string, teamId: string, transferPortalId: string, action: portalIpc.PortalActionType, nilAmountCents?: number) => Promise<void>;
    advance: (slotId: string, userTeamId: string | null) => Promise<void>;
    close: (slotId: string) => Promise<void>;
};
export declare const usePortalStore: import("zustand").UseBoundStore<import("zustand").StoreApi<PortalState>>;
export {};
//# sourceMappingURL=usePortalStore.d.ts.map