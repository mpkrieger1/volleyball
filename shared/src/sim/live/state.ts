// Sprint 29 Task 29.1: serializable state for live, pausable match play.
//
// LiveMatchState is the single source of truth for an in-progress live match.
// Held in main-process memory during play; serialized to Match.liveStateJson
// on pause / app-quit (Sprint 29 Task 29.5). Everything needed to resume
// mid-match must round-trip through JSON.
//
// Architecture:
//   - This file is renderer-safe (no Node-only imports). The renderer
//     deserializes live state for display via IPC.
//   - The step engine lives in `workers/src/sim/live/step.ts` because it
//     depends on `simulateRally` (workers).
//   - Sub-path export at `@vcd/shared/sim/live`. NOT re-exported from the
//     top-level shared barrel (CLAUDE.md "From Sprint 19/25" rule).
//
// Sprint 29 fields:
//   - kind: 'live' discriminator (load-bearing for Sprint 31's positional-
//     rules gate to keep simulateMatch / calibration untouched).
//   - liveMomentum: parallel to existing continuous momentum. Tier-based
//     (Task 29.2). Default {home:0, away:0} until Task 29.2 lands.
//   - coachActionLog: append-only audit trail. Default [] (Task 29.6).
//   - activeBoost: Sprint 30 field, default null this sprint.

import { z } from 'zod';
import { TeamSideSchema, PlayerLineupSchema, type TeamSide } from '../lineup';
import { RotationStateSchema, type RotationState } from '../rotation';
import { LiberoStateSchema, type LiberoState } from '../libero';
import { SystemConfigSchema, type SystemConfig } from '../system';
import { MomentumStateSchema, type MomentumState, initialMomentum } from '../momentum';
import { TimeoutLedgerSchema, type TimeoutLedger, emptyTimeoutLedger } from '../timeout';
import { RallyResultSchema, type RallyResult } from '../rallyResult';
import { PlayerRatingsSchema } from '../ratings';
import { SkillKeySchema, type SkillKey } from './skills';

// ─── Per-team state ────────────────────────────────────────────────────

/**
 * Sprint 30 Task 30.3: bench player record. One per off-court roster
 * member — used by the sub picker UI and the AI sub decision. Subs
 * move players between `lineup`/`playerIdsBySlot` and this array
 * atomically.
 */
export const BenchPlayerSchema = z.object({
  playerId: z.string().min(1),
  firstName: z.string(),
  lastName: z.string(),
  position: z.string(), // 'OH' | 'MB' | 'OPP' | 'S' | 'L' | 'DS'
  jersey: z.number().int().nonnegative(),
  isLibero: z.boolean(),
  ratings: PlayerRatingsSchema,
});
export type BenchPlayer = z.infer<typeof BenchPlayerSchema>;

/**
 * Sprint 31 Task 31.3: tactical hint preset chosen in the rotation editor.
 * Drives positional-rules multipliers (front-row attack ×, back-row pass ×,
 * setter-dump rate). Default 'balanced' for backward compat with Sprint
 * 29-30 saves that don't carry the field.
 */
export const TacticalHintSchema = z.enum(['aggressive', 'balanced', 'defensive']);
export type TacticalHint = z.infer<typeof TacticalHintSchema>;

export const TeamLiveStateSchema = z.object({
  lineup: PlayerLineupSchema,
  rotation: RotationStateSchema,
  libero: LiberoStateSchema.nullable(),
  setterIndex: z.number().int().min(0).max(5),
  system: SystemConfigSchema.optional(),
  /**
   * Sprint 30 Task 30.3: current 6 player ids on court, one per slot.
   * Mutated atomically with `lineup.players` on substitution. PlayerMatchStat
   * persistence reads from this (not the old StarterIds cache).
   * Defaults to `['', '', '', '', '', '']` for backward compat with
   * Sprint 29 paused state — service hydrates from pickStartersForTeam
   * on resume when empty.
   */
  playerIdsBySlot: z.tuple([
    z.string(), z.string(), z.string(), z.string(), z.string(), z.string(),
  ]).default(['', '', '', '', '', '']),
  /**
   * Sprint 37 (post-launch UAT): on-court player display names indexed
   * by slot. Renderer uses this for the live box-score table + rotation
   * tracker without needing a separate bios lookup. Maintained alongside
   * `playerIdsBySlot` on subs. Defaults to empty for backward compat
   * with Sprint 29-30 paused saves; service hydrates on resume.
   */
  lineupNamesBySlot: z.tuple([
    z.string(), z.string(), z.string(), z.string(), z.string(), z.string(),
  ]).default(['', '', '', '', '', '']),
  /**
   * Sprint 30 Task 30.3: bench (off-court roster). Subs swap a player
   * between bench and lineup atomically. Defaults to `[]` for Sprint
   * 29 paused state; hydrated by service.
   */
  bench: z.array(BenchPlayerSchema).default([]),
  /** Sprint 31 Task 31.3: tactical preset; drives positional-rules behavior. */
  tacticalHint: TacticalHintSchema.default('balanced'),
});
export type TeamLiveState = z.infer<typeof TeamLiveStateSchema>;

// ─── Active boost (Sprint 30 — placeholder this sprint) ────────────────

// SkillKeySchema/SkillKey are now defined in ./skills.ts to break a
// circular import (state.ts ↔ coachActions.ts via SkillKeySchema VALUE).
// Re-export for backward compat with consumers that import from state.
export { SkillKeySchema, type SkillKey };

export const ActiveBoostSchema = z.object({
  team: TeamSideSchema,
  skill: SkillKeySchema,
  pointsRemaining: z.number().int().nonnegative(),
});
export type ActiveBoost = z.infer<typeof ActiveBoostSchema>;

// ─── Live momentum (Sprint 29 Task 29.2 — placeholder this sprint) ─────

export const LiveMomentumSchema = z.object({
  home: z.number().int().nonnegative(),
  away: z.number().int().nonnegative(),
});
export type LiveMomentum = z.infer<typeof LiveMomentumSchema>;

// ─── Coach action log (Sprint 29 Task 29.6 — empty this sprint) ────────

export const CoachActionSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('timeout'),
    team: TeamSideSchema,
    rallyIndex: z.number().int().nonnegative(),
    skill: SkillKeySchema.optional(),
  }),
  z.object({
    kind: z.literal('substitution'),
    team: TeamSideSchema,
    rallyIndex: z.number().int().nonnegative(),
    out: z.string(),
    in: z.string(),
  }),
  z.object({
    kind: z.literal('rotation'),
    team: TeamSideSchema,
    setIndex: z.number().int().min(0).max(4),
    rotation: RotationStateSchema,
    system: z.enum(['5-1', '6-2']),
    libero: z.string(),
    hint: z.enum(['aggressive', 'balanced', 'defensive']),
  }),
]);
export type CoachAction = z.infer<typeof CoachActionSchema>;

// ─── Current-set state ─────────────────────────────────────────────────

export const TimeoutInvocationSchema = z.object({
  atRallyIdx: z.number().int().nonnegative(),
  by: TeamSideSchema,
  opponentRunLength: z.number().int().nonnegative(),
  momentumBefore: MomentumStateSchema,
  momentumAfter: MomentumStateSchema,
});
export type TimeoutInvocation = z.infer<typeof TimeoutInvocationSchema>;

export const CurrentSetSchema = z.object({
  index: z.number().int().min(0).max(4),
  home: z.number().int().nonnegative(),
  away: z.number().int().nonnegative(),
  targetScore: z.number().int().min(15).max(25),
  initialServer: TeamSideSchema,
  rallyIdxInSet: z.number().int().nonnegative(),
  rallies: z.array(RallyResultSchema),
  momentumAfterRally: z.array(MomentumStateSchema),
  timeouts: z.array(TimeoutInvocationSchema),
});
export type CurrentSet = z.infer<typeof CurrentSetSchema>;

// ─── Completed-set summary ─────────────────────────────────────────────
// Subset of workers/SetResult: just the data needed to recompute the box
// score and reconstruct match-level history. Ratings/lineup carryover is
// captured in the teams' final state (`home`/`away` at set end).

export const CompletedSetSchema = z.object({
  index: z.number().int().min(0).max(4),
  homeScore: z.number().int().nonnegative(),
  awayScore: z.number().int().nonnegative(),
  rallies: z.array(RallyResultSchema),
  momentumAfterRally: z.array(MomentumStateSchema),
  timeouts: z.array(TimeoutInvocationSchema),
  servingTeamEnd: TeamSideSchema,
  finalMomentum: MomentumStateSchema,
  finalTimeoutsHome: TimeoutLedgerSchema,
  finalTimeoutsAway: TimeoutLedgerSchema,
});
export type CompletedSet = z.infer<typeof CompletedSetSchema>;

// ─── Top-level live match state ────────────────────────────────────────

export const LiveMatchStateSchema = z.object({
  kind: z.literal('live'),
  matchId: z.string().min(1),
  seed: z.union([z.number(), z.string()]),
  useCoachAi: z.boolean(),
  /**
   * Sprint 29 Task 29.2: when true, the live-momentum skill multiplier
   * (computeLiveMomentum + liveSkillMultiplier) is applied to rally-engine
   * ratings. When false, the engine behaves identically to the sim-only
   * path. Live matches launched from Match Hub set this true; tests +
   * the byte-equality `simulateMatchLive` helper default it to false.
   */
  useLiveMomentum: z.boolean(),
  /**
   * Sprint 31 Task 31.3: when true, positional rules are applied:
   * front-row attack ×1.10, back-row pass ×1.05/1.10/1.15 by tacticalHint,
   * 5-1 setter dump under defensive hint. Default false → byte-equality
   * with sim-only path holds. IPC live-launch sets to true.
   */
  useLivePositionalRules: z.boolean().default(false),
  /** Which side is the user controlling? 'none' = both sides are AI (e.g., Sim Rest). */
  userTeam: z.enum(['home', 'away', 'none']),

  // Team state — evolves across sets
  home: TeamLiveStateSchema,
  away: TeamLiveStateSchema,

  // Match progress
  setsWon: z.object({
    home: z.number().int().min(0).max(3),
    away: z.number().int().min(0).max(3),
  }),
  currentSet: CurrentSetSchema,
  server: TeamSideSchema,

  // Per-set live state
  momentum: MomentumStateSchema, // existing continuous momentum (Sprint 5)
  liveMomentum: LiveMomentumSchema, // tier-based (Sprint 29 Task 29.2)
  timeoutsHome: TimeoutLedgerSchema,
  timeoutsAway: TimeoutLedgerSchema,
  subsHome: z.number().int().nonnegative(),
  subsAway: z.number().int().nonnegative(),
  activeBoost: ActiveBoostSchema.nullable(),

  // History
  completedSets: z.array(CompletedSetSchema),
  coachActionLog: z.array(CoachActionSchema),
  /**
   * Retro fix #6: rallyCursor of the last AI-driven substitution per team.
   * Used to enforce a 5-rally cooldown (AI_SUB_COOLDOWN_RALLIES) so the
   * AI doesn't sub every dead ball when fatigue stays above threshold.
   * Defaults to -1 (no prior AI sub; cooldown trivially satisfied since
   * any rallyCursor >= 0 - (-1) = 1 < 5 the first time, but -1 + 5 = 4
   * means rally 4 onwards lets AI sub. Use -1 not Infinity for JSON.)
   * Stored in state so it survives pause/resume cycles.
   */
  aiSubCooldown: z.object({
    home: z.number().int(),
    away: z.number().int(),
  }).default({ home: -1, away: -1 }),

  // Status
  status: z.enum(['in_progress', 'finished']),
  winner: TeamSideSchema.nullable(),
  rallyCursor: z.number().int().nonnegative(), // total rallies played across all sets
});
export type LiveMatchState = z.infer<typeof LiveMatchStateSchema>;

// ─── Factory ───────────────────────────────────────────────────────────

export type CreateLiveMatchInput = {
  matchId: string;
  seed: number | string;
  home: TeamLiveState;
  away: TeamLiveState;
  initialServer: TeamSide;
  useCoachAi?: boolean;
  useLiveMomentum?: boolean;
  useLivePositionalRules?: boolean;
  userTeam?: 'home' | 'away' | 'none';
};

/**
 * Sprint 30 Task 30.3: ensure a TeamLiveState has playerIdsBySlot + bench
 * defaulted (zod's `.default()` only applies during parse, not during
 * factory construction). Used by createLiveMatchState so test helpers
 * and toLive callers don't need to repeat the defaults.
 */
function withTeamDefaults(t: TeamLiveState): TeamLiveState {
  return {
    ...t,
    playerIdsBySlot: t.playerIdsBySlot ?? (['', '', '', '', '', ''] as TeamLiveState['playerIdsBySlot']),
    bench: t.bench ?? [],
    tacticalHint: t.tacticalHint ?? 'balanced',
  };
}

/** Build the initial state for a fresh live match (set 0, score 0-0). */
export function createLiveMatchState(input: CreateLiveMatchInput): LiveMatchState {
  return {
    kind: 'live',
    matchId: input.matchId,
    seed: input.seed,
    useCoachAi: input.useCoachAi ?? false,
    useLiveMomentum: input.useLiveMomentum ?? false,
    useLivePositionalRules: input.useLivePositionalRules ?? false,
    userTeam: input.userTeam ?? 'none',
    home: withTeamDefaults(input.home),
    away: withTeamDefaults(input.away),
    setsWon: { home: 0, away: 0 },
    currentSet: {
      index: 0,
      home: 0,
      away: 0,
      targetScore: 25,
      initialServer: input.initialServer,
      rallyIdxInSet: 0,
      rallies: [],
      momentumAfterRally: [],
      timeouts: [],
    },
    server: input.initialServer,
    momentum: initialMomentum(),
    liveMomentum: { home: 0, away: 0 },
    timeoutsHome: emptyTimeoutLedger(),
    timeoutsAway: emptyTimeoutLedger(),
    subsHome: 0,
    subsAway: 0,
    activeBoost: null,
    completedSets: [],
    coachActionLog: [],
    aiSubCooldown: { home: -1, away: -1 },
    status: 'in_progress',
    winner: null,
    rallyCursor: 0,
  };
}

// ─── Helpers ───────────────────────────────────────────────────────────

/** Target score for the given 0-indexed set (sets 0-3 → 25, decider → 15). */
export function targetScoreForSet(setIndex: number): number {
  return setIndex === 4 ? 15 : 25;
}

/** True iff the current set is over (>= target with win-by-2). */
export function currentSetComplete(state: LiveMatchState): boolean {
  const { home, away, targetScore } = state.currentSet;
  if (home >= targetScore && home - away >= 2) return true;
  if (away >= targetScore && away - home >= 2) return true;
  return false;
}

/** True iff one team has won 3 sets. */
export function matchComplete(state: LiveMatchState): boolean {
  return state.setsWon.home >= 3 || state.setsWon.away >= 3;
}

/** Re-export raw helpers for callers that need them. */
export { initialMomentum, emptyTimeoutLedger };
export type { TeamSide, RotationState, LiberoState, SystemConfig, MomentumState, TimeoutLedger, RallyResult };

// Sprint 29 Task 29.2: live-mode momentum helpers (parallel to existing).
export {
  computeLiveMomentum,
  tierFor,
  liveSkillMultiplier,
  LIVE_MOMENTUM_TIER_MULT,
  LIVE_MOMENTUM_MAX_TIER,
  LIVE_MOMENTUM_POINTS_PER_TIER,
} from './momentum';

// Sprint 29 Task 29.6: coach action log helpers.
export {
  serializeCoachActionLog,
  parseCoachActionLog,
  CoachActionLogSchema,
  type CoachActionLog,
} from './coachActions';

// Sprint 30 Task 30.2: skill-talk boost helpers.
export {
  boostDurationFor,
  createBoost,
  effectiveSkillMultiplier,
  buildSkillMultipliers,
  decrementBoost,
  isUnitMultiplier,
  SKILL_BOOST_MULT,
  SKILL_BOOST_DURATION_FLOOR,
  type TeamSkillMultipliers,
} from './skillBoost';

// Sprint 30 Task 30.1: user-driven timeout helpers.
export {
  applyUserTimeout,
  type ApplyUserTimeoutInput,
  type ApplyUserTimeoutResult,
  type ApplyUserTimeoutOk,
  type ApplyUserTimeoutErr,
} from './userTimeout';

// Sprint 30 Task 30.3: substitution helpers.
export {
  applyUserSubstitution,
  SUBS_PER_SET,
  type ApplyUserSubstitutionInput,
  type ApplyUserSubstitutionResult,
} from './userSubstitution';

// Sprint 31 Task 31.3: positional rules helpers.
export {
  HINT_TABLE,
  applyPositionalToLineup,
  setterDumpProbability,
  isSetterFrontRow,
} from './positionalRules';

// Sprint 31 Task 31.1: rotation editor validation.
export {
  validateRotation,
  OPPOSITE_SLOT,
  type Slot,
  type RotationConfig,
  type ValidateResult,
} from './rotationValidation';

// Sprint 31 Task 31.4: key-rally detector.
export { isKeyRally, type KeyRallyResult } from './keyRally';
export {
  aiPickSubstitution,
  AI_SUB_COOLDOWN_RALLIES,
  type AiSubDecision,
} from './aiSubstitution';
export {
  computeFatigue,
  fatigueForOnCourt,
  teamShouldConsiderSub,
  pickFreshestBenchAtPosition,
  FATIGUE_PER_SET,
  FATIGUE_PER_RALLY,
  AI_SUB_FATIGUE_THRESHOLD,
  type FatigueInput,
} from './fatigue';
