import { create } from 'zustand';
import { analytics, type matchIpc } from '@vcd/shared';

type Matches = matchIpc.RecentMatchSummary[];
type Analytics = Extract<matchIpc.GetMatchAnalyticsResponse, { ok: true }>;

export type AnalyticsCharts = {
  rotation: analytics.RotationHittingPctData;
  scatter: analytics.KPerSetVsBlockData;
  histogram: analytics.ReceptionGradeHistogramData;
  heatmap: analytics.ServeZoneHeatmapData;
  rallyLength: analytics.RallyLengthData;
};

export type AnalyticsMode = 'match' | 'season';
type SeasonOk = Extract<matchIpc.SeasonAnalyticsResponse, { ok: true }>;

type AnalyticsState = {
  phase: 'idle' | 'loading-matches' | 'loading-analytics' | 'loading-season' | 'ready' | 'error';
  mode: AnalyticsMode;
  matches: Matches;
  selectedMatchId: string | null;
  data: Analytics | null;
  charts: AnalyticsCharts | null;
  season: SeasonOk | null;
  error: string | null;
  loadMatches: (slotId: string) => Promise<void>;
  selectMatch: (slotId: string, matchId: string) => Promise<void>;
  setMode: (mode: AnalyticsMode) => void;
  loadSeason: (slotId: string, teamId: string) => Promise<void>;
  reset: () => void;
};

function deriveCharts(payload: Analytics): AnalyticsCharts {
  return {
    rotation: analytics.computeRotationHittingPct(payload.pbp),
    scatter: analytics.computeKPerSetVsBlock({
      boxScore: payload.boxScore,
      setsPlayed: payload.setsPlayed,
      home: {
        lineupSlots: payload.home.lineupSlots,
        lineupRatingsBlock: payload.home.lineupRatingsBlock,
        lineupPositions: payload.home.lineupPositions,
        lineupPlayerIds: payload.home.lineupPlayerIds,
      },
      away: {
        lineupSlots: payload.away.lineupSlots,
        lineupRatingsBlock: payload.away.lineupRatingsBlock,
        lineupPositions: payload.away.lineupPositions,
        lineupPlayerIds: payload.away.lineupPlayerIds,
      },
    }),
    histogram: analytics.computeReceptionGradeHistogram({
      pbp: payload.pbp,
      home: {
        lineupSlots: payload.home.lineupSlots,
        lineupPlayerIds: payload.home.lineupPlayerIds,
      },
      away: {
        lineupSlots: payload.away.lineupSlots,
        lineupPlayerIds: payload.away.lineupPlayerIds,
      },
    }),
    heatmap: analytics.computeServeZoneHeatmap(payload.pbp),
    rallyLength: analytics.computeRallyLengthDistribution(payload.pbp),
  };
}

export const useAnalyticsStore = create<AnalyticsState>((set, get) => ({
  phase: 'idle',
  mode: 'match',
  matches: [],
  selectedMatchId: null,
  data: null,
  charts: null,
  season: null,
  error: null,
  async loadMatches(slotId) {
    set({ phase: 'loading-matches', error: null });
    const res = await window.vcd.match.listRecentMatches(slotId, 50);
    if (!res.ok) {
      set({ phase: 'error', error: res.error.message });
      return;
    }
    set({ matches: res.matches, phase: 'idle' });
    // Auto-select the most recent match if none chosen yet.
    const cur = get().selectedMatchId;
    if (!cur && res.matches.length > 0) {
      await get().selectMatch(slotId, res.matches[0]!.matchId);
    }
  },
  async selectMatch(slotId, matchId) {
    set({ phase: 'loading-analytics', selectedMatchId: matchId, error: null });
    const res = await window.vcd.match.getAnalytics(slotId, matchId);
    if (!res.ok) {
      set({ phase: 'error', error: res.error.message });
      return;
    }
    set({ data: res, charts: deriveCharts(res), phase: 'ready' });
  },
  setMode(mode) {
    set({ mode });
  },
  async loadSeason(slotId, teamId) {
    set({ phase: 'loading-season', error: null });
    const res = await window.vcd.match.seasonAnalytics(slotId, teamId);
    if (!res.ok) {
      set({ phase: 'error', error: res.error.message });
      return;
    }
    set({ season: res, phase: 'ready' });
  },
  reset() {
    set({
      phase: 'idle',
      mode: 'match',
      matches: [],
      selectedMatchId: null,
      data: null,
      charts: null,
      season: null,
      error: null,
    });
  },
}));
