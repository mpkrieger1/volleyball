import { analytics, type matchIpc } from '@vcd/shared';
type Matches = matchIpc.RecentMatchSummary[];
type Analytics = Extract<matchIpc.GetMatchAnalyticsResponse, {
    ok: true;
}>;
export type AnalyticsCharts = {
    rotation: analytics.RotationHittingPctData;
    scatter: analytics.KPerSetVsBlockData;
    histogram: analytics.ReceptionGradeHistogramData;
    heatmap: analytics.ServeZoneHeatmapData;
    rallyLength: analytics.RallyLengthData;
};
type AnalyticsState = {
    phase: 'idle' | 'loading-matches' | 'loading-analytics' | 'ready' | 'error';
    matches: Matches;
    selectedMatchId: string | null;
    data: Analytics | null;
    charts: AnalyticsCharts | null;
    error: string | null;
    loadMatches: (slotId: string) => Promise<void>;
    selectMatch: (slotId: string, matchId: string) => Promise<void>;
    reset: () => void;
};
export declare const useAnalyticsStore: import("zustand").UseBoundStore<import("zustand").StoreApi<AnalyticsState>>;
export {};
//# sourceMappingURL=useAnalyticsStore.d.ts.map