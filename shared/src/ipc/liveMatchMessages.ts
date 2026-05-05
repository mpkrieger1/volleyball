// Sprint 29 Task 29.4: live-match IPC message schemas.
//
// All channels are namespaced `match:live:*`. The renderer interacts via
// window.vcd.match.live.{start, getState, playRallies, ...}.
//
// State is shipped as a JSON-stringified `LiveMatchState` (validated by
// `LiveMatchStateSchema` at both ends) so the wire shape is stable even
// when the underlying schema gains optional fields.

import { z } from 'zod';
import { LiveMatchStateSchema } from '../sim/live/state';

// ─── Common ────────────────────────────────────────────────────────────

const SlotMatchRequest = z.object({
  slotId: z.string().min(1),
  matchId: z.string().min(1),
});

const ErrCode = z.enum(['NOT_FOUND', 'INVALID_INPUT', 'IO_ERROR', 'INTERNAL', 'CONFLICT']);

const ErrResponse = z.object({
  ok: z.literal(false),
  error: z.object({ code: ErrCode, message: z.string() }),
});

// ─── start ─────────────────────────────────────────────────────────────

export const LiveStartRequest = z.object({
  slotId: z.string().min(1),
  matchId: z.string().min(1),
  /** Defaults to a deterministic seed derived from matchId. */
  seed: z.union([z.number().int(), z.string().min(1)]).optional(),
  useCoachAi: z.boolean().optional(),
  useLiveMomentum: z.boolean().optional(),
  userTeam: z.enum(['home', 'away', 'none']).optional(),
});
export type LiveStartRequest = z.infer<typeof LiveStartRequest>;

export const LiveStateOk = z.object({
  ok: z.literal(true),
  state: LiveMatchStateSchema,
  /** True if this start call resumed a previously-paused match. */
  resumed: z.boolean().optional(),
});
export const LiveStateResponse = z.discriminatedUnion('ok', [LiveStateOk, ErrResponse]);
export type LiveStateResponse = z.infer<typeof LiveStateResponse>;

// ─── getState ──────────────────────────────────────────────────────────

export const LiveGetStateRequest = SlotMatchRequest;
export type LiveGetStateRequest = z.infer<typeof LiveGetStateRequest>;

// ─── playRallies / playToSetEnd / playToMatchEnd ───────────────────────

export const LivePlayRalliesRequest = SlotMatchRequest.extend({
  n: z.number().int().positive().max(500),
});
export type LivePlayRalliesRequest = z.infer<typeof LivePlayRalliesRequest>;

export const LivePlayToBoundaryRequest = SlotMatchRequest;
export type LivePlayToBoundaryRequest = z.infer<typeof LivePlayToBoundaryRequest>;

export const LivePlayResultOk = z.object({
  ok: z.literal(true),
  state: LiveMatchStateSchema,
  ralliesPlayed: z.number().int().nonnegative(),
  /** Reason play stopped early (smart-pause). null means we hit the requested target. */
  pausedFor: z
    .enum([
      'set_complete', 'match_complete', 'set_point', 'momentum_swing',
      'opponent_timeout', 'opponent_substitution', // Sprint 30 Task 30.4
      'key_rally', // Sprint 31 Task 31.4
    ])
    .nullable(),
});
export const LivePlayResponse = z.discriminatedUnion('ok', [LivePlayResultOk, ErrResponse]);
export type LivePlayResponse = z.infer<typeof LivePlayResponse>;

// ─── callTimeout (Sprint 30 Task 30.1) ────────────────────────────────

export const SkillKeyEnum = z.enum(['serve', 'pass', 'attack', 'block', 'dig', 'set']);
export type SkillKey = z.infer<typeof SkillKeyEnum>;

export const LiveCallTimeoutRequest = z.object({
  slotId: z.string().min(1),
  matchId: z.string().min(1),
  /** Optional: skill to talk about for the +5% boost. Omit to skip the talk. */
  skill: SkillKeyEnum.optional(),
});
export type LiveCallTimeoutRequest = z.infer<typeof LiveCallTimeoutRequest>;

// Reuses LiveStateOk + LiveStateResponse from the start handlers.

// ─── substitute (Sprint 30 Task 30.3) ─────────────────────────────────

export const LiveSubstituteRequest = z.object({
  slotId: z.string().min(1),
  matchId: z.string().min(1),
  outIdx: z.number().int().min(0).max(5),
  inPlayerId: z.string().min(1),
});
export type LiveSubstituteRequest = z.infer<typeof LiveSubstituteRequest>;

// ─── setRotation (Sprint 31 Task 31.1) ────────────────────────────────

const SlotEnum = z.enum(['P1', 'P2', 'P3', 'P4', 'P5', 'P6']);
export type SlotLabel = z.infer<typeof SlotEnum>;

export const LiveSetRotationRequest = z.object({
  slotId: z.string().min(1),
  matchId: z.string().min(1),
  slots: z.object({
    P1: z.string(), P2: z.string(), P3: z.string(),
    P4: z.string(), P5: z.string(), P6: z.string(),
  }),
  system: z.enum(['5-1', '6-2']),
  libero: z.string(),
  setterSlot: SlotEnum.optional(),
  setterSlotsTwo: z.object({ a: SlotEnum, b: SlotEnum }).optional(),
  hint: z.enum(['aggressive', 'balanced', 'defensive']),
});
export type LiveSetRotationRequest = z.infer<typeof LiveSetRotationRequest>;

// ─── pause / resume / simulateRest / dispose / hasPaused / hasActive ──

export const LivePauseRequest = SlotMatchRequest;
export const LivePauseResponse = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true) }),
  ErrResponse,
]);
export type LivePauseResponse = z.infer<typeof LivePauseResponse>;

export const LiveResumeRequest = SlotMatchRequest;
export const LiveSimulateRestRequest = SlotMatchRequest;
export const LiveDisposeRequest = SlotMatchRequest;
export const LiveHasPausedRequest = SlotMatchRequest;
export const LiveHasPausedOk = z.object({ ok: z.literal(true), hasPaused: z.boolean() });
export const LiveHasPausedResponse = z.discriminatedUnion('ok', [LiveHasPausedOk, ErrResponse]);
export type LiveHasPausedResponse = z.infer<typeof LiveHasPausedResponse>;

export const LiveHasActiveRequest = z.object({ slotId: z.string().min(1) });
export const LiveHasActiveOk = z.object({
  ok: z.literal(true),
  hasActive: z.boolean(),
  matchIds: z.array(z.string()),
});
export const LiveHasActiveResponse = z.discriminatedUnion('ok', [LiveHasActiveOk, ErrResponse]);
export type LiveHasActiveResponse = z.infer<typeof LiveHasActiveResponse>;

// Retro fix #2: list paused matches for "Resume Live" CTA on Match Hub.

export const LiveListPausedRequest = z.object({ slotId: z.string().min(1) });
export const LivePausedMatchSummary = z.object({
  matchId: z.string(),
  homeTeamId: z.string(),
  awayTeamId: z.string(),
  homeTeamName: z.string(),
  awayTeamName: z.string(),
  date: z.string(),
  setIndex: z.number().int(),
  homeScore: z.number().int(),
  awayScore: z.number().int(),
  setsHome: z.number().int(),
  setsAway: z.number().int(),
});
export type LivePausedMatchSummary = z.infer<typeof LivePausedMatchSummary>;
export const LiveListPausedOk = z.object({
  ok: z.literal(true),
  matches: z.array(LivePausedMatchSummary),
});
export const LiveListPausedResponse = z.discriminatedUnion('ok', [LiveListPausedOk, ErrResponse]);
export type LiveListPausedResponse = z.infer<typeof LiveListPausedResponse>;

// ─── Channel names ─────────────────────────────────────────────────────

// ─── createAndStart ────────────────────────────────────────────────────
// Convenience: creates a fresh Match row + starts a live state on it.

export const LiveCreateAndStartRequest = z.object({
  slotId: z.string().min(1),
  homeTeamId: z.string().min(1),
  awayTeamId: z.string().min(1),
  seed: z.union([z.number().int(), z.string().min(1)]).optional(),
  useCoachAi: z.boolean().optional(),
  useLiveMomentum: z.boolean().optional(),
  userTeam: z.enum(['home', 'away', 'none']).optional(),
});
export type LiveCreateAndStartRequest = z.infer<typeof LiveCreateAndStartRequest>;

export const LiveCreateAndStartOk = z.object({
  ok: z.literal(true),
  state: LiveMatchStateSchema,
  matchId: z.string(),
});
export const LiveCreateAndStartResponse = z.discriminatedUnion('ok', [
  LiveCreateAndStartOk,
  ErrResponse,
]);
export type LiveCreateAndStartResponse = z.infer<typeof LiveCreateAndStartResponse>;

export const LIVE_MATCH_IPC_CHANNELS = {
  start: 'match:live:start',
  createAndStart: 'match:live:createAndStart',
  getState: 'match:live:getState',
  playRallies: 'match:live:playRallies',
  playToSetEnd: 'match:live:playToSetEnd',
  playToMatchEnd: 'match:live:playToMatchEnd',
  pause: 'match:live:pause',
  resume: 'match:live:resume',
  simulateRest: 'match:live:simulateRest',
  dispose: 'match:live:dispose',
  hasPaused: 'match:live:hasPaused',
  hasActive: 'match:live:hasActive',
  callTimeout: 'match:live:callTimeout',
  substitute: 'match:live:substitute',
  setRotation: 'match:live:setRotation',
  listPaused: 'match:live:listPaused',
} as const;
