import { create } from 'zustand';
import type { matchIpc, scoutIpc } from '@vcd/shared';
import {
  createReplayScheduler,
  type ReplayController,
  type ReplaySpeed,
} from '../match/replayScheduler';
import { mergeTimeline, type TickerEntry } from '../match/mergeTimeline';

type TeamSummary = matchIpc.TeamSummary;
type MatchPayload = Extract<matchIpc.GetMatchByIdResponse, { ok: true }>;
type ScoutPayload = Extract<scoutIpc.ScoutReportResponse, { ok: true }>;

export type MatchHubPhase =
  | 'select'
  | 'loading-teams'
  | 'loading-scout'
  | 'ready-to-play'
  | 'simulating'
  | 'loading-replay'
  | 'replay-ready'
  | 'playing'
  | 'paused'
  | 'done'
  | 'error';

export type MatchHubState = {
  phase: MatchHubPhase;
  teams: TeamSummary[];
  selectedHomeId: string | null;
  selectedAwayId: string | null;
  scout: ScoutPayload | null;
  match: MatchPayload | null;
  ticker: TickerEntry[];
  /** Recent N events visible in the ticker scroll area (capped). */
  visibleTicker: TickerEntry[];
  currentEventIdx: number;
  speed: ReplaySpeed;
  scoreHome: number;
  scoreAway: number;
  setIndex: number;
  setHomeScores: number[];
  setAwayScores: number[];
  /** Active timeout/sub banner; null when none. */
  banner: { kind: 'timeout' | 'substitution'; text: string } | null;
  error: string | null;

  // Actions
  loadTeams: (slotId: string) => Promise<void>;
  setHome: (id: string) => void;
  setAway: (id: string) => void;
  loadScout: (slotId: string, opponentTeamId: string) => Promise<void>;
  simulateAndLoad: (slotId: string, seed?: string) => Promise<void>;
  play: () => void;
  pause: () => void;
  setSpeed: (s: ReplaySpeed) => void;
  finishInstantly: () => void;
  reset: () => void;
};

const TICKER_VISIBLE_LIMIT = 20;
const BANNER_DURATION_MS = 2500;

let controller: ReplayController | null = null;
let bannerTimer: ReturnType<typeof setTimeout> | null = null;

export const useMatchHubStore = create<MatchHubState>((set, get) => ({
  phase: 'select',
  teams: [],
  selectedHomeId: null,
  selectedAwayId: null,
  scout: null,
  match: null,
  ticker: [],
  visibleTicker: [],
  currentEventIdx: 0,
  speed: '1x',
  scoreHome: 0,
  scoreAway: 0,
  setIndex: 0,
  setHomeScores: [],
  setAwayScores: [],
  banner: null,
  error: null,

  async loadTeams(slotId) {
    set({ phase: 'loading-teams', error: null });
    const res = await window.vcd.match.listTeams(slotId);
    if (!res.ok) {
      set({ phase: 'error', error: res.error.message });
      return;
    }
    set({ phase: 'select', teams: res.teams });
  },

  setHome(id) {
    set({ selectedHomeId: id, scout: null });
  },
  setAway(id) {
    set({ selectedAwayId: id, scout: null });
  },

  async loadScout(slotId, opponentTeamId) {
    set({ phase: 'loading-scout', error: null });
    const res = await window.vcd.scout.report(slotId, opponentTeamId);
    if (!res.ok) {
      set({ phase: 'error', error: res.error.message });
      return;
    }
    set({ phase: 'ready-to-play', scout: res });
  },

  async simulateAndLoad(slotId, seed) {
    const { selectedHomeId, selectedAwayId } = get();
    if (!selectedHomeId || !selectedAwayId) return;
    set({ phase: 'simulating', error: null });
    const sim = await window.vcd.match.simulate({
      slotId,
      homeTeamId: selectedHomeId,
      awayTeamId: selectedAwayId,
      seed: seed ?? `match-${Date.now()}`,
    });
    if (!sim.ok) {
      set({ phase: 'error', error: sim.error.message });
      return;
    }
    set({ phase: 'loading-replay' });
    const full = await window.vcd.match.getById(slotId, sim.matchId);
    if (!full.ok) {
      set({ phase: 'error', error: full.error.message });
      return;
    }
    const ticker = mergeTimeline(full.pbp, full.timeline);
    set({
      phase: 'replay-ready',
      match: full,
      ticker,
      visibleTicker: [],
      currentEventIdx: 0,
      scoreHome: 0,
      scoreAway: 0,
      setIndex: 0,
      setHomeScores: [],
      setAwayScores: [],
      banner: null,
    });
  },

  play() {
    const state = get();
    if (state.ticker.length === 0) return;
    if (state.phase === 'replay-ready' || state.phase === 'paused') {
      // Build a fresh scheduler if not yet running, or resume existing one.
      if (controller === null) {
        controller = createReplayScheduler<TickerEntry>({
          events: state.ticker,
          initialSpeed: state.speed,
          onEvent: (entry, idx) => {
            applyEntry(entry, idx, set, get);
          },
          onComplete: () => {
            set({ phase: 'done' });
          },
        });
      }
      set({ phase: 'playing' });
      controller.play();
    }
  },

  pause() {
    if (controller) controller.pause();
    set({ phase: 'paused' });
  },

  setSpeed(s) {
    set({ speed: s });
    if (controller) controller.setSpeed(s);
  },

  finishInstantly() {
    const state = get();
    if (state.ticker.length === 0) return;
    // Lazy-init controller so "Skip to end" works even if user hasn't pressed Play first.
    if (controller === null) {
      controller = createReplayScheduler<TickerEntry>({
        events: state.ticker,
        initialSpeed: state.speed,
        onEvent: (entry, idx) => {
          applyEntry(entry, idx, set, get);
        },
        onComplete: () => {
          set({ phase: 'done' });
        },
      });
    }
    set({ phase: 'playing' });
    controller.finishInstantly();
    // applyEntry will fire for each remaining event; phase → 'done' via onComplete.
  },

  reset() {
    if (controller) {
      controller.stop();
      controller = null;
    }
    if (bannerTimer) {
      clearTimeout(bannerTimer);
      bannerTimer = null;
    }
    set({
      phase: 'select',
      selectedHomeId: null,
      selectedAwayId: null,
      scout: null,
      match: null,
      ticker: [],
      visibleTicker: [],
      currentEventIdx: 0,
      speed: '1x',
      scoreHome: 0,
      scoreAway: 0,
      setIndex: 0,
      setHomeScores: [],
      setAwayScores: [],
      banner: null,
      error: null,
    });
  },
}));

function applyEntry(
  entry: TickerEntry,
  idx: number,
  setState: (partial: Partial<MatchHubState>) => void,
  getState: () => MatchHubState,
): void {
  const cur = getState();
  const visibleTicker = [...cur.visibleTicker, entry].slice(-TICKER_VISIBLE_LIMIT);
  const next: Partial<MatchHubState> = { currentEventIdx: idx + 1, visibleTicker };

  if (entry.kind === 'event' && entry.event.kind === 'point') {
    if (entry.event.winner === 'home') next.scoreHome = cur.scoreHome + 1;
    else next.scoreAway = cur.scoreAway + 1;
  } else if (entry.kind === 'timeout') {
    next.banner = {
      kind: 'timeout',
      text: `${entry.by === 'home' ? cur.match?.home.teamAbbr ?? 'Home' : cur.match?.away.teamAbbr ?? 'Away'} TIMEOUT — ${entry.scoreHome}–${entry.scoreAway}`,
    };
    if (bannerTimer) clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => {
      useMatchHubStore.setState({ banner: null });
      bannerTimer = null;
    }, BANNER_DURATION_MS);
  } else if (entry.kind === 'substitution') {
    next.banner = {
      kind: 'substitution',
      text: `${entry.team === 'home' ? cur.match?.home.teamAbbr ?? 'Home' : cur.match?.away.teamAbbr ?? 'Away'} ${labelForSub(entry.subKind)} — slot ${entry.slotIndex}`,
    };
    if (bannerTimer) clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => {
      useMatchHubStore.setState({ banner: null });
      bannerTimer = null;
    }, BANNER_DURATION_MS);
  } else if (entry.kind === 'set_break') {
    next.setHomeScores = [...cur.setHomeScores, entry.finalHome];
    next.setAwayScores = [...cur.setAwayScores, entry.finalAway];
    next.scoreHome = 0;
    next.scoreAway = 0;
    next.setIndex = entry.setIndex + 1;
  }
  setState(next);
}

function labelForSub(kind: 'libero_in' | 'libero_out' | 'sub_in' | 'sub_out'): string {
  switch (kind) {
    case 'libero_in': return 'LIBERO IN';
    case 'libero_out': return 'LIBERO OUT';
    case 'sub_in': return 'SUB IN';
    case 'sub_out': return 'SUB OUT';
  }
}
