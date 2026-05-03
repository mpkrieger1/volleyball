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
  /**
   * Sprint 26 (Task 26.2): per-team timeouts remaining, visible in the
   * paused-replay timeout button. Decremented on every `timeout` entry
   * (AI-driven OR user-injected). Initialized when a match loads to
   * `TIMEOUTS_PER_SET` (= 2) but in v1.0 we track total-remaining-across-
   * sets rather than per-set; the AI sim already enforces per-set caps.
   */
  homeTimeoutsRemaining: number;
  awayTimeoutsRemaining: number;
  /**
   * Sprint 26 (Task 26.6): replay-only sub injections (slot, incoming
   * player id, event index). Not persisted to Match.timelineJson.
   */
  userSubs: Array<{ side: 'home' | 'away'; slotIndex: number; incomingPlayerId: string; injectedAtEventIdx: number }>;

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
  /**
   * Sprint 26 (Task 26.2): inject a cosmetic user-called timeout. Returns
   * true if the timeout was applied (paused + remaining > 0); false
   * otherwise. Match outcomes are unchanged — this is replay-only UI.
   */
  injectUserTimeout: (side: 'home' | 'away') => boolean;
  /**
   * Sprint 26 (Task 26.6): inject a cosmetic user-called substitution.
   * Returns true if applied (paused + slot is not the libero); false
   * otherwise. Replay-only; not persisted.
   */
  injectUserSub: (side: 'home' | 'away', slotIndex: number, incomingPlayerId: string) => boolean;
  /**
   * Sprint 27 (Task 27.2): load an existing match's PBP/box-score/timeline
   * for replay without re-simulating. Used by the user-team-match-list
   * UI when the user clicks a previously-played match.
   */
  loadMatchForReplay: (slotId: string, matchId: string) => Promise<void>;
  reset: () => void;
};

const TICKER_VISIBLE_LIMIT = 20;
const BANNER_DURATION_MS = 2500;
// Sprint 26 (Task 26.2): default total timeouts per team for a 5-set match.
// AI sim enforces per-set caps; the renderer's counter tracks remaining
// across the full match for the UI affordance.
const DEFAULT_TIMEOUTS_PER_TEAM = 2 * 5;
// NCAA libero is conventionally slot index 5 in this codebase (Sprint 4
// rotation/libero model). Subs on this slot follow special rules and
// are out of v1 scope per the Sprint 26 spec.
const LIBERO_SLOT_INDEX = 5;

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
  homeTimeoutsRemaining: DEFAULT_TIMEOUTS_PER_TEAM,
  awayTimeoutsRemaining: DEFAULT_TIMEOUTS_PER_TEAM,
  userSubs: [],

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
      homeTimeoutsRemaining: DEFAULT_TIMEOUTS_PER_TEAM,
      awayTimeoutsRemaining: DEFAULT_TIMEOUTS_PER_TEAM,
      userSubs: [],
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

  async loadMatchForReplay(slotId, matchId) {
    set({ phase: 'loading-replay', error: null });
    const full = await window.vcd.match.getById(slotId, matchId);
    if (!full.ok) {
      set({ phase: 'error', error: full.error.message });
      return;
    }
    const ticker = mergeTimeline(full.pbp, full.timeline);
    set({
      phase: 'replay-ready',
      match: full,
      selectedHomeId: full.home.teamId,
      selectedAwayId: full.away.teamId,
      ticker,
      visibleTicker: [],
      currentEventIdx: 0,
      scoreHome: 0,
      scoreAway: 0,
      setIndex: 0,
      setHomeScores: [],
      setAwayScores: [],
      banner: null,
      homeTimeoutsRemaining: DEFAULT_TIMEOUTS_PER_TEAM,
      awayTimeoutsRemaining: DEFAULT_TIMEOUTS_PER_TEAM,
      userSubs: [],
    });
  },

  injectUserTimeout(side) {
    const cur = get();
    if (cur.phase !== 'paused') return false;
    const remaining = side === 'home' ? cur.homeTimeoutsRemaining : cur.awayTimeoutsRemaining;
    if (remaining <= 0) return false;
    const teamAbbr =
      side === 'home' ? cur.match?.home.teamAbbr ?? 'Home' : cur.match?.away.teamAbbr ?? 'Away';
    const next: Partial<MatchHubState> = {
      banner: {
        kind: 'timeout',
        text: `${teamAbbr} TIMEOUT (coach) — ${cur.scoreHome}–${cur.scoreAway}`,
      },
    };
    if (side === 'home') next.homeTimeoutsRemaining = cur.homeTimeoutsRemaining - 1;
    else next.awayTimeoutsRemaining = cur.awayTimeoutsRemaining - 1;
    set(next);
    if (bannerTimer) clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => {
      useMatchHubStore.setState({ banner: null });
      bannerTimer = null;
    }, BANNER_DURATION_MS);
    return true;
  },

  injectUserSub(side, slotIndex, incomingPlayerId) {
    const cur = get();
    if (cur.phase !== 'paused') return false;
    if (slotIndex === LIBERO_SLOT_INDEX) return false;
    if (slotIndex < 0 || slotIndex > 5) return false;
    if (!cur.match) return false;
    const teamAbbr =
      side === 'home' ? cur.match.home.teamAbbr ?? 'Home' : cur.match.away.teamAbbr ?? 'Away';
    set({
      banner: {
        kind: 'substitution',
        text: `${teamAbbr} SUB (coach) — slot ${slotIndex + 1}`,
      },
      userSubs: [
        ...cur.userSubs,
        { side, slotIndex, incomingPlayerId, injectedAtEventIdx: cur.currentEventIdx },
      ],
    });
    if (bannerTimer) clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => {
      useMatchHubStore.setState({ banner: null });
      bannerTimer = null;
    }, BANNER_DURATION_MS);
    return true;
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
      homeTimeoutsRemaining: DEFAULT_TIMEOUTS_PER_TEAM,
      awayTimeoutsRemaining: DEFAULT_TIMEOUTS_PER_TEAM,
      userSubs: [],
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
    // Sprint 26 (Task 26.2): decrement remaining counter for the calling
    // side so the UI button stays accurate even when AI calls timeouts.
    if (entry.by === 'home') next.homeTimeoutsRemaining = Math.max(0, cur.homeTimeoutsRemaining - 1);
    else next.awayTimeoutsRemaining = Math.max(0, cur.awayTimeoutsRemaining - 1);
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
