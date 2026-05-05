// Sprint 29 Task 29.4 + 29.5: live-match orchestrator.
//
// Holds in-memory `LiveMatchState` per matchId in a module-scoped Map. Wraps
// the workers `simulateRallyStep` driver with smart-pause logic and persists
// to/from `Match.liveStateJson` on pause/resume + persists `coachActionsJson`
// on completion.
//
// Lifecycle:
//   start(matchId)        — load match from DB + build initial state OR load
//                           paused state from DB. Insert into registry.
//   playRallies(n)        — advance up to n rallies; smart-pause may stop early.
//   playToSetEnd          — convenience wrapper.
//   playToMatchEnd        — convenience wrapper; honors smart-pause.
//   pause                 — persist registry → Match.liveStateJson; remove from
//                           registry.
//   resume                — load Match.liveStateJson → registry.
//   simulateRest          — drive to completion, persist final box score
//                           via the existing simulateAndPersist write path,
//                           clear liveStateJson, keep coachActionsJson.
//   dispose               — drop from registry without persisting.

import { PrismaClient } from '@prisma/client';
import { sim, perf } from '@vcd/shared';
import * as pbpCodec from '@vcd/shared/sim/pbpCodec';
import {
  simulateRallyStep,
  buildMatchTimeline,
  type MatchResult,
} from '@vcd/workers';
import { lineupFromTeam } from './lineupFromTeam';
import { pickStartersForTeam, type StarterIds } from './pickStarters';

type LiveMatchState = sim.LiveMatchState;
type TeamLiveState = sim.TeamLiveState;

export class LiveMatchError extends Error {
  constructor(
    public readonly code: 'NOT_FOUND' | 'INVALID_INPUT' | 'IO_ERROR' | 'INTERNAL' | 'CONFLICT',
    message: string,
  ) {
    super(message);
    this.name = 'LiveMatchError';
  }
}

// ─── Registry — keyed by `${slotId}:${matchId}` ────────────────────────

type RegistryEntry = {
  slotId: string;
  matchId: string;
  state: LiveMatchState;
  /** Cached starter ids per side (used to attribute box score on completion). */
  homeStarters: StarterIds;
  awayStarters: StarterIds;
  /**
   * Sprint 30 Task 30.1: cached HC.ratingStrategy per side, used for
   * skill-talk boost duration. Loaded at startLiveMatch from the Coach
   * table; defaults to 50 when no HC is on staff (shouldn't happen per
   * CLAUDE.md §Critical rules #4 invariant: every team has an HC).
   */
  homeHcStrategy: number;
  awayHcStrategy: number;
  /**
   * Retro fix #4: full roster bios (id → bio) loaded at startLiveMatch.
   * Used to look up player bios when subbing OUT (the bench player
   * record gets the real first/last name + jersey + position rather
   * than fabricated empty fields).
   */
  homeBios: Map<string, sim.BenchPlayer>;
  awayBios: Map<string, sim.BenchPlayer>;
};

const registry = new Map<string, RegistryEntry>();
const keyFor = (slotId: string, matchId: string): string => `${slotId}:${matchId}`;

export function registrySize(): number {
  return registry.size;
}

export function _resetRegistryForTests(): void {
  registry.clear();
}

/**
 * Retro fix #3: auto-save all in-registry live matches before app quit.
 * Called from main/src/index.ts on `before-quit`. Pauses each entry by
 * writing its state to Match.liveStateJson; clears the registry. Best-
 * effort — failures per-match are logged but don't block shutdown.
 */
export async function autoSaveAllOnQuit(
  resolveDbPath: (slotId: string) => Promise<string | null>,
): Promise<{ saved: number; failed: number }> {
  let saved = 0;
  let failed = 0;
  for (const entry of [...registry.values()]) {
    try {
      const dbPath = await resolveDbPath(entry.slotId);
      if (!dbPath) {
        failed += 1;
        continue;
      }
      await pauseLiveMatch(dbPath, entry.slotId, entry.matchId);
      saved += 1;
    } catch {
      failed += 1;
    }
  }
  return { saved, failed };
}

// ─── Smart-pause registry (Sprint 29 Task 29.3) ────────────────────────

export type SmartPauseReason =
  | 'set_complete'
  | 'match_complete'
  | 'set_point'
  | 'momentum_swing'
  | 'opponent_timeout'        // Sprint 30 Task 30.4
  | 'opponent_substitution'   // Sprint 30 Task 30.4
  | 'key_rally';              // Sprint 31 Task 31.4 (set point / match point)

/**
 * Decide whether to stop play AFTER applying the given step result.
 * - 'match_complete' is always returned when match ends (terminator).
 * - 'set_complete' is always returned at set boundary.
 * - 'set_point' fires when either team is one point from winning the set
 *   AND leads by at least 1 — used to give the user a chance to call
 *   timeout before the rally goes the other way.
 * - 'momentum_swing' fires when net momentum changed by ≥3 in the last
 *   5 rallies.
 */
function smartPauseReason(state: LiveMatchState): SmartPauseReason | null {
  if (state.status === 'finished') return 'match_complete';

  // Sprint 31 Task 31.4: key-rally trigger (set point / match point)
  // takes precedence over the legacy set_point heuristic. Returns
  // 'key_rally' which the renderer surfaces with a special banner
  // (Continue / Call timeout buttons).
  const kr = sim.isKeyRally(state);
  if (kr.setPoint) return 'key_rally';

  // Set point legacy fallback (kept for parity with S29 behavior at
  // edge cases where isKeyRally returns false but legacy did).
  const cs = state.currentSet;
  const target = cs.targetScore;
  const leader = cs.home > cs.away ? 'home' : cs.away > cs.home ? 'away' : null;
  if (leader) {
    const leaderScore = leader === 'home' ? cs.home : cs.away;
    if (leaderScore >= target - 1 && Math.abs(cs.home - cs.away) >= 1) {
      return 'set_point';
    }
  }

  // Momentum swing: |Δmomentum| over last 5 rallies ≥ 3 (delta in tier units).
  const recent = cs.momentumAfterRally.slice(-5);
  if (recent.length >= 5) {
    const first = recent[0]!;
    const last = recent[recent.length - 1]!;
    const dHome = Math.abs(last.home - first.home);
    const dAway = Math.abs(last.away - first.away);
    if (Math.max(dHome, dAway) >= 0.6) {
      // 0.6 corresponds to ~3 momentum points in the existing continuous
      // model (3 × MOMENTUM_PER_POINT=0.05 + a run bonus floor).
      return 'momentum_swing';
    }
  }

  return null;
}

// ─── Service input shapes ──────────────────────────────────────────────

export type StartInput = {
  dbPath: string;
  slotId: string;
  matchId: string;
  seed?: number | string;
  useCoachAi?: boolean;
  useLiveMomentum?: boolean;
  useLivePositionalRules?: boolean;
  userTeam?: 'home' | 'away' | 'none';
};

export type PlayResult = {
  state: LiveMatchState;
  ralliesPlayed: number;
  pausedFor: SmartPauseReason | null;
};

// ─── createAndStart ───────────────────────────────────────────────────
// Convenience for the renderer's "Play (Live)" button: creates a fresh
// Match row + starts a live state on it in one trip.

export type CreateAndStartInput = {
  dbPath: string;
  slotId: string;
  homeTeamId: string;
  awayTeamId: string;
  seed?: number | string;
  useCoachAi?: boolean;
  useLiveMomentum?: boolean;
  useLivePositionalRules?: boolean;
  userTeam?: 'home' | 'away' | 'none';
};

export async function createAndStartLiveMatch(input: CreateAndStartInput): Promise<{
  state: LiveMatchState;
  matchId: string;
}> {
  if (input.homeTeamId === input.awayTeamId) {
    throw new LiveMatchError('INVALID_INPUT', 'home and away teams must differ');
  }
  const client = new PrismaClient({
    datasources: { db: { url: `file:${input.dbPath}` } },
  });
  let matchId: string;
  try {
    // Sprint 37 (post-launch UAT): if a scheduled match between these
    // two teams exists and hasn't been played yet, reuse it. Prevents
    // duplicate match rows and keeps the schedule in sync — when the
    // match completes via simulateRest, the scheduled row is updated
    // with the winner.
    const scheduled = await client.match.findFirst({
      where: {
        OR: [
          { homeTeamId: input.homeTeamId, awayTeamId: input.awayTeamId },
          { homeTeamId: input.awayTeamId, awayTeamId: input.homeTeamId },
        ],
        winnerId: null,
        isTournament: false,
      },
      orderBy: { date: 'asc' },
    });
    const match =
      scheduled ??
      (await client.match.create({
        data: {
          homeTeamId: input.homeTeamId,
          awayTeamId: input.awayTeamId,
          date: new Date(),
          week: 0,
          isConference: false,
          isTournament: false,
        },
      }));
    matchId = match.id;
  } finally {
    await client.$disconnect();
  }

  const result = await startLiveMatch({
    dbPath: input.dbPath,
    slotId: input.slotId,
    matchId,
    ...(input.seed !== undefined && { seed: input.seed }),
    ...(input.useCoachAi !== undefined && { useCoachAi: input.useCoachAi }),
    ...(input.useLiveMomentum !== undefined && { useLiveMomentum: input.useLiveMomentum }),
    ...(input.useLivePositionalRules !== undefined && { useLivePositionalRules: input.useLivePositionalRules }),
    ...(input.userTeam && { userTeam: input.userTeam }),
  });
  return { state: result.state, matchId };
}

// ─── start ─────────────────────────────────────────────────────────────

/**
 * Load (or resume) a match into the registry. Returns the initial state.
 * If Match.liveStateJson is non-null in the DB, that paused state is
 * loaded; otherwise a fresh state is built from the match's teams.
 */
export async function startLiveMatch(input: StartInput): Promise<{
  state: LiveMatchState;
  resumed: boolean;
}> {
  const key = keyFor(input.slotId, input.matchId);
  const existing = registry.get(key);
  if (existing) {
    // Already started in this process — return current state.
    return { state: existing.state, resumed: false };
  }

  const client = new PrismaClient({
    datasources: { db: { url: `file:${input.dbPath}` } },
  });
  try {
    const match = await client.match.findUnique({ where: { id: input.matchId } });
    if (!match) throw new LiveMatchError('NOT_FOUND', `match ${input.matchId} not found`);

    // Resume path
    if (match.liveStateJson) {
      let parsed = sim.LiveMatchStateSchema.parse(JSON.parse(match.liveStateJson));
      const homeStarters = await pickStartersForTeam(client, match.homeTeamId);
      const awayStarters = await pickStartersForTeam(client, match.awayTeamId);
      const homeHcStrategy = await loadHcStrategy(client, match.homeTeamId);
      const awayHcStrategy = await loadHcStrategy(client, match.awayTeamId);

      // Sprint 30 backward compat: pre-S30 saves have empty playerIdsBySlot
      // + bench (defaulted by zod). Hydrate them so the sub picker UI works.
      // Always load bios (Retro fix #4) — needed for sub-out lookups.
      const [homeRoster, awayRoster] = await Promise.all([
        loadBenchForTeam(client, match.homeTeamId, homeStarters),
        loadBenchForTeam(client, match.awayTeamId, awayStarters),
      ]);
      const needsHomeHydrate = parsed.home.playerIdsBySlot.every((id) => id === '');
      const needsAwayHydrate = parsed.away.playerIdsBySlot.every((id) => id === '');
      if (needsHomeHydrate || needsAwayHydrate) {
        parsed = {
          ...parsed,
          home: needsHomeHydrate ? {
            ...parsed.home,
            playerIdsBySlot: [...homeStarters] as TeamLiveState['playerIdsBySlot'],
            bench: homeRoster.bench,
          } : parsed.home,
          away: needsAwayHydrate ? {
            ...parsed.away,
            playerIdsBySlot: [...awayStarters] as TeamLiveState['playerIdsBySlot'],
            bench: awayRoster.bench,
          } : parsed.away,
        };
      }

      registry.set(key, {
        slotId: input.slotId,
        matchId: input.matchId,
        state: parsed,
        homeStarters,
        awayStarters,
        homeHcStrategy,
        awayHcStrategy,
        homeBios: homeRoster.bios,
        awayBios: awayRoster.bios,
      });
      return { state: parsed, resumed: true };
    }

    // Fresh start path
    const [home, away, homeStarters, awayStarters, homeHcStrategy, awayHcStrategy] = await Promise.all([
      client.team.findUnique({ where: { id: match.homeTeamId } }),
      client.team.findUnique({ where: { id: match.awayTeamId } }),
      pickStartersForTeam(client, match.homeTeamId),
      pickStartersForTeam(client, match.awayTeamId),
      loadHcStrategy(client, match.homeTeamId),
      loadHcStrategy(client, match.awayTeamId),
    ]);
    if (!home || !away) throw new LiveMatchError('NOT_FOUND', 'team(s) not found');

    const seed = input.seed ?? `live:${input.matchId}`;
    const homeLineup = lineupFromTeam(home, seed, 'home');
    const awayLineup = lineupFromTeam(away, seed, 'away');

    // Sprint 30 Task 30.3 + Retro fix #4: load full team rosters (bench
    // list + bios map for sub-out lookups).
    const [homeRoster, awayRoster] = await Promise.all([
      loadBenchForTeam(client, match.homeTeamId, homeStarters),
      loadBenchForTeam(client, match.awayTeamId, awayStarters),
    ]);

    const homeLive: TeamLiveState = {
      lineup: homeLineup,
      rotation: sim.initialRotation(),
      libero: sim.liberoOff(5),
      setterIndex: 0,
      system: sim.defaultSystem51(),
      playerIdsBySlot: [...homeStarters] as TeamLiveState['playerIdsBySlot'],
      bench: homeRoster.bench,
      tacticalHint: 'balanced', // Sprint 31: editor can override
    };
    const awayLive: TeamLiveState = {
      lineup: awayLineup,
      rotation: sim.initialRotation(),
      libero: sim.liberoOff(5),
      setterIndex: 0,
      system: sim.defaultSystem51(),
      playerIdsBySlot: [...awayStarters] as TeamLiveState['playerIdsBySlot'],
      bench: awayRoster.bench,
      tacticalHint: 'balanced',
    };

    const state = sim.createLiveMatchState({
      matchId: input.matchId,
      seed,
      home: homeLive,
      away: awayLive,
      initialServer: 'home',
      useCoachAi: input.useCoachAi ?? true,
      useLiveMomentum: input.useLiveMomentum ?? true,
      // Sprint 31 Task 31.3: live-launched matches default to true; tests
      // and Sim Rest leave at false for byte-equality.
      useLivePositionalRules: input.useLivePositionalRules ?? true,
      userTeam: input.userTeam ?? 'none',
    });

    registry.set(key, {
      slotId: input.slotId,
      matchId: input.matchId,
      state,
      homeStarters,
      awayStarters,
      homeHcStrategy,
      awayHcStrategy,
      homeBios: homeRoster.bios,
      awayBios: awayRoster.bios,
    });
    return { state, resumed: false };
  } finally {
    await client.$disconnect();
  }
}

/**
 * Sprint 30 Task 30.1: load a team's HC strategy rating for skill-talk
 * boost duration. Falls back to 50 (the schema default) when no HC slot
 * is filled — this should be unreachable per CLAUDE.md §4 invariant
 * "every team has an HC slot filled at every tick" but the fallback
 * keeps live mode resilient if the invariant is violated.
 */
async function loadHcStrategy(client: PrismaClient, teamId: string): Promise<number> {
  const hc = await client.coach.findFirst({
    where: { teamId, role: 'HC' },
    select: { ratingStrategy: true },
  });
  return hc?.ratingStrategy ?? 50;
}

/**
 * Sprint 30 Task 30.3 + Retro fix #4: load the team's full roster
 * (starters + bench) keyed by player id. Returns both the bench list
 * (Sprint 30 contract — used directly by sub picker UI) AND a complete
 * id→bio map (used when subbing players OUT so the outgoing bench
 * record has a real bio instead of fabricated empty fields).
 */
async function loadBenchForTeam(
  client: PrismaClient,
  teamId: string,
  starterIds: StarterIds,
): Promise<{ bench: sim.BenchPlayer[]; bios: Map<string, sim.BenchPlayer> }> {
  const starterSet = new Set<string>(starterIds);
  const players = await client.player.findMany({
    where: { teamId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      position: true,
      jersey: true,
      isLibero: true,
      ratingAttack: true,
      ratingBlock: true,
      ratingServe: true,
      ratingPass: true,
      ratingSet: true,
      ratingDig: true,
      ratingAthleticism: true,
      ratingIq: true,
      ratingStamina: true,
    },
  });
  const bios = new Map<string, sim.BenchPlayer>();
  const bench: sim.BenchPlayer[] = [];
  for (const p of players) {
    const record: sim.BenchPlayer = {
      playerId: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      position: p.position,
      jersey: p.jersey,
      isLibero: p.isLibero,
      ratings: {
        attack: p.ratingAttack,
        block: p.ratingBlock,
        serve: p.ratingServe,
        pass: p.ratingPass,
        set: p.ratingSet,
        dig: p.ratingDig,
        athleticism: p.ratingAthleticism,
        iq: p.ratingIq,
        stamina: p.ratingStamina,
      },
    };
    bios.set(p.id, record);
    if (!starterSet.has(p.id)) bench.push(record);
  }
  return { bench, bios };
}

/**
 * Sprint 30 Task 30.1: apply a user-driven timeout to the in-registry
 * live match. Halves opponent's continuous momentum, optionally activates
 * a skill-talk boost, decrements the team's TimeoutLedger.
 */
export function callUserTimeout(
  slotId: string,
  matchId: string,
  skill?: sim.SkillKey,
): LiveMatchState {
  const entry = registry.get(keyFor(slotId, matchId));
  if (!entry) {
    throw new LiveMatchError('NOT_FOUND', `live match ${matchId} not in registry`);
  }
  const team = entry.state.userTeam;
  if (team === 'none') {
    throw new LiveMatchError('INVALID_INPUT', 'no user team set on this match');
  }
  const hcStrategy = team === 'home' ? entry.homeHcStrategy : entry.awayHcStrategy;
  const result = sim.applyUserTimeout(entry.state, {
    hcStrategy,
    ...(skill ? { skill } : {}),
  });
  if (!result.ok) {
    if (result.code === 'NO_TIMEOUTS_LEFT') {
      throw new LiveMatchError('CONFLICT', result.message);
    }
    throw new LiveMatchError('INVALID_INPUT', result.message);
  }
  entry.state = result.state;
  return result.state;
}

/**
 * Sprint 31 Task 31.1: apply a user-driven rotation change to the
 * in-registry live match. Updates rotation + libero + system + tacticalHint
 * for the user's team, and appends a `rotation` CoachAction. Validates
 * via sim.validateRotation; rejects with CONFLICT on invalid configs.
 *
 * The renderer passes a "RotationConfig" shape (slot-keyed). This converts
 * to the engine's RotationState (slot-array of player slot indices).
 */
export type SetRotationInput = {
  /** Player ids by slot label P1..P6. Must be 6 distinct ids from the team's roster (lineup OR bench). */
  slots: { P1: string; P2: string; P3: string; P4: string; P5: string; P6: string };
  system: '5-1' | '6-2';
  /** Player id of the libero. Must be back-row at start of set. */
  libero: string;
  /** 5-1: slot label of the setter. */
  setterSlot?: 'P1' | 'P2' | 'P3' | 'P4' | 'P5' | 'P6';
  /** 6-2: the two setter slots. */
  setterSlotsTwo?: { a: 'P1' | 'P2' | 'P3' | 'P4' | 'P5' | 'P6'; b: 'P1' | 'P2' | 'P3' | 'P4' | 'P5' | 'P6' };
  hint: 'aggressive' | 'balanced' | 'defensive';
};

export function applySetRotation(
  slotId: string,
  matchId: string,
  input: SetRotationInput,
): LiveMatchState {
  const entry = registry.get(keyFor(slotId, matchId));
  if (!entry) {
    throw new LiveMatchError('NOT_FOUND', `live match ${matchId} not in registry`);
  }
  const team = entry.state.userTeam;
  if (team === 'none') {
    throw new LiveMatchError('INVALID_INPUT', 'no user team set on this match');
  }

  // Validate via shared helper (defense in depth — renderer also pre-validates).
  const validateInput: sim.RotationConfig = {
    slots: input.slots,
    system: input.system,
    libero: input.libero,
    ...(input.setterSlot ? { setterSlot: input.setterSlot } : {}),
    ...(input.setterSlotsTwo ? { setterSlotsTwo: input.setterSlotsTwo } : {}),
  };
  const v = sim.validateRotation(validateInput);
  if (!v.ok) {
    throw new LiveMatchError(
      'CONFLICT',
      `invalid rotation: ${v.errors.join('; ')}`,
    );
  }

  const teamState = team === 'home' ? entry.state.home : entry.state.away;

  // Build new on-court lineup + slot mapping. Look up each player id in
  // the existing lineup OR bench to fetch ratings.
  const SLOTS = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'] as const;
  const newPlayerIds: [string, string, string, string, string, string] = [
    input.slots.P1, input.slots.P2, input.slots.P3,
    input.slots.P4, input.slots.P5, input.slots.P6,
  ];

  const onCourtNow = teamState.playerIdsBySlot;
  const benchNow = teamState.bench;
  const newPlayers = SLOTS.map((_label, i) => {
    const targetId = newPlayerIds[i]!;
    const onCourtIdx = onCourtNow.findIndex((id) => id === targetId);
    if (onCourtIdx !== -1) return teamState.lineup.players[onCourtIdx]!;
    const benchPlayer = benchNow.find((b) => b.playerId === targetId);
    if (!benchPlayer) {
      throw new LiveMatchError(
        'INVALID_INPUT',
        `player ${targetId} not found on roster`,
      );
    }
    return benchPlayer.ratings;
  });

  // New bench: everyone NOT in the new lineup. Move displaced on-court
  // players + the previously-benched players who weren't moved on.
  const newOnCourtSet = new Set(newPlayerIds);
  const displacedFromCourt = onCourtNow
    .map((id, i) => ({ id, ratings: teamState.lineup.players[i]! }))
    .filter((p) => !newOnCourtSet.has(p.id))
    .map((p) => {
      // Try to look up bio in existing bench (won't be there if they were
      // a starter); otherwise fabricate minimal bio.
      const prior = benchNow.find((b) => b.playerId === p.id);
      return prior ?? {
        playerId: p.id,
        firstName: '',
        lastName: '',
        position: 'OH',
        jersey: 0,
        isLibero: false,
        ratings: p.ratings,
      };
    });
  const stillOnBench = benchNow.filter((b) => !newOnCourtSet.has(b.playerId));
  const newBench = [...stillOnBench, ...displacedFromCourt];

  // Build the engine's RotationState. We're using the canonical
  // initialRotation [0,1,2,3,4,5] since players are indexed by their
  // slot position. The mapping P1=0, P2=1, ... P6=5 is implicit.
  const newRotation = sim.initialRotation();

  const liberoIdx = newPlayerIds.findIndex((id) => id === input.libero);
  const newLibero = liberoIdx >= 0 ? sim.liberoOff(liberoIdx) : null;

  // System config: pull from setter slot (5-1) or two setter slots (6-2).
  let newSystem: sim.SystemConfig;
  if (input.system === '5-1') {
    if (!input.setterSlot) {
      throw new LiveMatchError('INVALID_INPUT', '5-1 requires setterSlot');
    }
    const setterIdx = SLOTS.indexOf(input.setterSlot);
    newSystem = { system: '5-1', setterIndex: setterIdx };
  } else {
    if (!input.setterSlotsTwo) {
      throw new LiveMatchError('INVALID_INPUT', '6-2 requires setterSlotsTwo');
    }
    const aIdx = SLOTS.indexOf(input.setterSlotsTwo.a);
    const bIdx = SLOTS.indexOf(input.setterSlotsTwo.b);
    newSystem = { system: '6-2', setterAIndex: aIdx, setterBIndex: bIdx };
  }

  const newTeamState: TeamLiveState = {
    ...teamState,
    lineup: { ...teamState.lineup, players: newPlayers as TeamLiveState['lineup']['players'] },
    rotation: newRotation,
    libero: newLibero,
    system: newSystem,
    setterIndex: input.system === '5-1' ? SLOTS.indexOf(input.setterSlot!) : 0,
    playerIdsBySlot: newPlayerIds,
    bench: newBench,
    tacticalHint: input.hint,
  };

  const action: sim.CoachAction = {
    kind: 'rotation',
    team,
    setIndex: entry.state.currentSet.index,
    rotation: newRotation,
    system: input.system,
    libero: input.libero,
    hint: input.hint,
  };

  const newState: LiveMatchState = {
    ...entry.state,
    home: team === 'home' ? newTeamState : entry.state.home,
    away: team === 'away' ? newTeamState : entry.state.away,
    coachActionLog: [...entry.state.coachActionLog, action],
  };
  entry.state = newState;
  return newState;
}

/**
 * Sprint 30 Task 30.3: apply a user-driven substitution to the in-registry
 * live match. Atomically swaps lineup ratings + playerIdsBySlot + bench;
 * decrements the team's per-set sub counter.
 */
export function callUserSubstitution(
  slotId: string,
  matchId: string,
  outIdx: number,
  inPlayerId: string,
): LiveMatchState {
  const entry = registry.get(keyFor(slotId, matchId));
  if (!entry) {
    throw new LiveMatchError('NOT_FOUND', `live match ${matchId} not in registry`);
  }
  const result = sim.applyUserSubstitution(entry.state, { outIdx, inPlayerId });
  if (!result.ok) {
    const code = result.code === 'SUBS_EXHAUSTED' ? 'CONFLICT' : 'INVALID_INPUT';
    throw new LiveMatchError(code as 'CONFLICT' | 'INVALID_INPUT', result.message);
  }
  // Retro fix #4: enrich the just-pushed bench entry with the real bio
  // (applyUserSubstitution fabricates empty bio fields for the outgoing
  // player; we know the truth from the registry's bios map).
  entry.state = enrichOutgoingBenchBio(result.state, entry);
  return entry.state;
}

/**
 * Retro fix #4: replace the LAST bench entry's fabricated bio (added by
 * applyUserSubstitution for the outgoing player) with the real bio from
 * the registry's bios map. Idempotent — bench entries that already have
 * non-empty firstName/lastName/jersey/position are left alone.
 */
function enrichOutgoingBenchBio(state: LiveMatchState, entry: RegistryEntry): LiveMatchState {
  const team = state.userTeam;
  if (team === 'none') return state;
  const teamState = team === 'home' ? state.home : state.away;
  if (teamState.bench.length === 0) return state;
  const last = teamState.bench[teamState.bench.length - 1]!;
  if (last.firstName !== '' || last.lastName !== '' || last.jersey !== 0) return state;
  const bios = team === 'home' ? entry.homeBios : entry.awayBios;
  const realBio = bios.get(last.playerId);
  if (!realBio) return state;
  // Preserve the outgoing ratings (those are the player's CURRENT ratings,
  // possibly already adjusted) — only swap in bio fields.
  const enriched: sim.BenchPlayer = {
    ...realBio,
    ratings: last.ratings,
  };
  const newBench = [...teamState.bench.slice(0, -1), enriched];
  return {
    ...state,
    home: team === 'home' ? { ...teamState, bench: newBench } : state.home,
    away: team === 'away' ? { ...teamState, bench: newBench } : state.away,
  };
}

// ─── getState ──────────────────────────────────────────────────────────

export function getLiveState(slotId: string, matchId: string): LiveMatchState {
  const entry = registry.get(keyFor(slotId, matchId));
  if (!entry) {
    throw new LiveMatchError('NOT_FOUND', `live match ${matchId} not in registry`);
  }
  return entry.state;
}

// ─── playRallies / boundary helpers ────────────────────────────────────

type PlayUntil = { kind: 'count'; n: number } | { kind: 'set' } | { kind: 'match' };

function playLoop(slotId: string, matchId: string, until: PlayUntil): PlayResult {
  const entry = registry.get(keyFor(slotId, matchId));
  if (!entry) {
    throw new LiveMatchError('NOT_FOUND', `live match ${matchId} not in registry`);
  }

  let state = entry.state;
  let played = 0;
  let pausedFor: SmartPauseReason | null = null;

  while (state.status !== 'finished') {
    if (until.kind === 'count' && played >= until.n) break;
    const r = simulateRallyStep(state);
    state = r.newState;
    played += 1;

    // Set boundary: stop unconditionally. Match boundary: stop unconditionally.
    if (r.event === 'match_complete') {
      pausedFor = 'match_complete';
      break;
    }
    if (r.event === 'set_complete') {
      pausedFor = 'set_complete';
      // Always stop at set boundary in any mode (gives user a chance to
      // edit rotation in Sprint 31).
      break;
    }

    // Sprint 30 Task 30.4: opponent action smart-pause. Stops bulk-play
    // loops in EVERY mode (even count-based playRallies) so the user can
    // see + react to opponent timeouts and subs.
    if (r.opponentAction === 'timeout') {
      pausedFor = 'opponent_timeout';
      break;
    }
    if (r.opponentAction === 'substitution') {
      pausedFor = 'opponent_substitution';
      break;
    }

    // For set/match modes, also honor smart-pause triggers mid-set.
    if (until.kind !== 'count') {
      const reason = smartPauseReason(state);
      if (reason && reason !== 'set_complete' && reason !== 'match_complete') {
        pausedFor = reason;
        break;
      }
    }
  }

  entry.state = state;
  return { state, ralliesPlayed: played, pausedFor };
}

export function playRallies(slotId: string, matchId: string, n: number): PlayResult {
  return playLoop(slotId, matchId, { kind: 'count', n });
}
export function playToSetEnd(slotId: string, matchId: string): PlayResult {
  return playLoop(slotId, matchId, { kind: 'set' });
}
export function playToMatchEnd(slotId: string, matchId: string): PlayResult {
  return playLoop(slotId, matchId, { kind: 'match' });
}

// ─── pause / resume / dispose ──────────────────────────────────────────

export async function pauseLiveMatch(
  dbPath: string,
  slotId: string,
  matchId: string,
): Promise<void> {
  const entry = registry.get(keyFor(slotId, matchId));
  if (!entry) {
    throw new LiveMatchError('NOT_FOUND', `live match ${matchId} not in registry`);
  }
  const client = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });
  try {
    await client.match.update({
      where: { id: matchId },
      data: {
        liveStateJson: JSON.stringify(entry.state),
        coachActionsJson: sim.serializeCoachActionLog(entry.state.coachActionLog),
      },
    });
  } finally {
    await client.$disconnect();
  }
  registry.delete(keyFor(slotId, matchId));
}

export function disposeLiveMatch(slotId: string, matchId: string): void {
  registry.delete(keyFor(slotId, matchId));
}

export async function hasPausedLiveMatch(
  dbPath: string,
  matchId: string,
): Promise<boolean> {
  const client = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });
  try {
    const m = await client.match.findUnique({
      where: { id: matchId },
      select: { liveStateJson: true },
    });
    return m?.liveStateJson != null;
  } finally {
    await client.$disconnect();
  }
}

/**
 * Retro fix #2: list all matches with non-null liveStateJson, so the
 * renderer can show a "Resume Live" CTA. Returns one summary per paused
 * match.
 */
export async function listPausedLiveMatches(
  dbPath: string,
): Promise<Array<{
  matchId: string;
  homeTeamId: string;
  awayTeamId: string;
  homeTeamName: string;
  awayTeamName: string;
  date: string;
  setIndex: number;
  homeScore: number;
  awayScore: number;
  setsHome: number;
  setsAway: number;
}>> {
  const client = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });
  try {
    const matches = await client.match.findMany({
      where: { liveStateJson: { not: null } },
      include: { homeTeam: true, awayTeam: true },
      orderBy: { date: 'desc' },
    });
    return matches.map((m) => {
      let setIndex = 0;
      let homeScore = 0;
      let awayScore = 0;
      let setsHome = 0;
      let setsAway = 0;
      try {
        const parsed = sim.LiveMatchStateSchema.parse(JSON.parse(m.liveStateJson!));
        setIndex = parsed.currentSet.index;
        homeScore = parsed.currentSet.home;
        awayScore = parsed.currentSet.away;
        setsHome = parsed.setsWon.home;
        setsAway = parsed.setsWon.away;
      } catch {
        /* ignore malformed live state — surface as zero score */
      }
      return {
        matchId: m.id,
        homeTeamId: m.homeTeamId,
        awayTeamId: m.awayTeamId,
        homeTeamName: m.homeTeam.schoolName,
        awayTeamName: m.awayTeam.schoolName,
        date: m.date.toISOString(),
        setIndex,
        homeScore,
        awayScore,
        setsHome,
        setsAway,
      };
    });
  } finally {
    await client.$disconnect();
  }
}

export function hasActiveLiveMatch(slotId: string): { hasActive: boolean; matchIds: string[] } {
  const matchIds: string[] = [];
  for (const [, entry] of registry) {
    if (entry.slotId === slotId) matchIds.push(entry.matchId);
  }
  return { hasActive: matchIds.length > 0, matchIds };
}

// ─── simulateRest ──────────────────────────────────────────────────────

/**
 * Drive an in-progress live match to completion (no further coach inputs)
 * and persist the final box score + PBP via the same write path used by
 * the one-shot `simulateAndPersist`. Clears `liveStateJson`, preserves
 * `coachActionsJson`.
 */
export async function simulateRestOfLiveMatch(
  dbPath: string,
  slotId: string,
  matchId: string,
): Promise<{ matchId: string; winner: 'home' | 'away' }> {
  const entry = registry.get(keyFor(slotId, matchId));
  if (!entry) {
    throw new LiveMatchError('NOT_FOUND', `live match ${matchId} not in registry`);
  }

  // Drive to completion using the live engine (so any user actions already
  // applied are honored, but no new ones are added).
  let state = entry.state;
  while (state.status !== 'finished') {
    state = simulateRallyStep(state).newState;
  }
  entry.state = state;

  // Build a workers MatchResult for box-score computation. The `system`
  // field is conditionally spread because exactOptionalPropertyTypes
  // distinguishes `{ x: undefined }` from `{}` (CLAUDE.md "From Sprint 5").
  const liveToMatchTeam = (t: TeamLiveState) => ({
    lineup: t.lineup,
    rotation: t.rotation,
    libero: t.libero,
    setterIndex: t.setterIndex,
    ...(t.system && { system: t.system }),
  });
  const finalHome = liveToMatchTeam(entry.state.home);
  const finalAway = liveToMatchTeam(entry.state.away);
  const matchResult: MatchResult = {
    winner: state.winner!,
    homeSetsWon: state.setsWon.home,
    awaySetsWon: state.setsWon.away,
    sets: state.completedSets.map((cs) => ({
      homeScore: cs.homeScore,
      awayScore: cs.awayScore,
      rallies: cs.rallies,
      momentumAfterRally: cs.momentumAfterRally,
      finalHome,
      finalAway,
      servingTeamEnd: cs.servingTeamEnd,
      finalMomentum: cs.finalMomentum,
      finalTimeoutsHome: cs.finalTimeoutsHome,
      finalTimeoutsAway: cs.finalTimeoutsAway,
      timeouts: cs.timeouts,
    })),
  };

  const boxScore = sim.computeBoxScore(matchResult);
  const pbp = sim.matchToPbp(matchResult);
  const { payload: pbpJson, encoding: pbpEncoding } = pbpCodec.encodePbp(pbp);
  const timeline = buildMatchTimeline(matchResult);
  const coachActionsJson = sim.serializeCoachActionLog(state.coachActionLog);

  const client = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });
  try {
    await perf.recordPerfAsync('liveMatch:simulateRest', () =>
      client.$transaction(async (tx) => {
        const match = await tx.match.findUnique({ where: { id: matchId } });
        if (!match) throw new LiveMatchError('NOT_FOUND', `match ${matchId} disappeared`);
        const winnerId = state.winner === 'home' ? match.homeTeamId : match.awayTeamId;

        await tx.match.update({
          where: { id: matchId },
          data: {
            winnerId,
            pbpJson,
            pbpEncoding,
            boxScoreJson: JSON.stringify(boxScore),
            timelineJson: JSON.stringify(timeline),
            liveStateJson: null,
            coachActionsJson,
          },
        });

        // Set rows.
        for (let i = 0; i < matchResult.sets.length; i++) {
          const s = matchResult.sets[i]!;
          await tx.set.create({
            data: {
              matchId,
              index: i,
              home: s.homeScore,
              away: s.awayScore,
              durationSec: s.rallies.length * 20,
            },
          });
        }

        // PlayerMatchStat rows (Sprint 18 pattern).
        await tx.playerMatchStat.createMany({
          data: sim.buildPlayerMatchStatRows({
            matchId,
            homePlayerIds: entry.homeStarters,
            awayPlayerIds: entry.awayStarters,
            boxScore,
          }),
        });
      }),
    );
  } finally {
    await client.$disconnect();
  }

  registry.delete(keyFor(slotId, matchId));
  return { matchId, winner: state.winner! };
}
