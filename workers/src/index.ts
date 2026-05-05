export { handlePing } from './noopWorker';
export { simulateRally, type SimulateRallyInput } from './sim/rally';
export { simulateSet, type SimulateSetInput, type SetResult, type TeamMatchState } from './sim/set';
export { simulateMatch, type SimulateMatchInput, type MatchResult } from './sim/match';
export { buildMatchTimeline } from './sim/buildTimeline';
export { runRally } from './simWorker';
// Sprint 29: live-mode driver. Pausable per-rally engine that shares the
// rally FSM with simulateMatch; byte-equal output for the same seed +
// state when no coach inputs are supplied.
export {
  simulateRallyStep,
  simulateMatchLive,
  type CoachInputs,
  type StepEvent,
  type StepResult,
  type SimulateMatchLiveInput,
} from './sim/live';
