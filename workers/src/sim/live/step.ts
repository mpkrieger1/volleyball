// Sprint 29 Task 29.1: incremental rally driver.
//
// `simulateRallyStep(state)` advances exactly one rally and returns the
// updated LiveMatchState. The seed derivation MUST mirror simulateMatch +
// simulateSet exactly so byte-equality holds with the one-shot path:
//
//   match.ts:  seed = `${rootSeed}:s${setIdx}`         → simulateSet
//   set.ts:    seed = `${input.seed}:r${rallyIdx}`     → simulateRally
//   ⇒ rally seed = `${rootSeed}:s${setIdx}:r${rallyInSetIdx}`
//
// Coach AI parity: when state.useCoachAi is true, mirror the per-rally
// coach AI loop from simulateSet (both teams check shouldCallTimeout
// before the rally, attempt timeout, update momentum) so that every
// random draw and every state mutation matches the one-shot path.
//
// Sprint 29 scope: coachInputs parameter exists but is reserved for
// Sprint 30 (user-driven timeouts/subs). This sprint always drives via
// AI parity only.

import { sim } from '@vcd/shared';
import { simulateRally } from '../rally';

type LiveMatchState = sim.LiveMatchState;
type CompletedSet = sim.CompletedSet;
type TeamLiveState = sim.TeamLiveState;
type TimeoutInvocation = sim.TimeoutInvocation;
type SkillKey = sim.SkillKey;
type PlayerLineup = sim.PlayerLineup;
type TeamSkillMultipliers = sim.TeamSkillMultipliers;
const {
  currentSetComplete, matchComplete, targetScoreForSet,
  computeLiveMomentum, buildSkillMultipliers, isUnitMultiplier, decrementBoost,
  applyPositionalToLineup, setterDumpProbability, isSetterFrontRow,
} = sim;

/**
 * Sprint 30 Task 30.2: pre-multiply lineup ratings by the team's per-skill
 * multiplier matrix (combines live-momentum tier bonus + skill-talk +5%
 * boost from createBoost). When all multipliers are 1.0 (no momentum,
 * no active boost), the original lineup is returned by reference
 * (zero-cost no-op + preserves byte-equality with sim-only path).
 *
 * athleticism / iq / stamina are NOT scaled — physical attributes, not
 * skills affected by momentum / talks.
 */
function withSkillMultipliers(lineup: PlayerLineup, mults: TeamSkillMultipliers): PlayerLineup {
  if (isUnitMultiplier(mults)) return lineup;
  // Cap at 100 to keep ratings in valid range (CLAUDE.md: 0-100 integers,
  // though the rally FSM tolerates floats from probability functions).
  const scale = (v: number, m: number): number => Math.min(100, v * m);
  return {
    ...lineup,
    players: lineup.players.map((p) => ({
      ...p,
      attack: scale(p.attack, mults.attack),
      block: scale(p.block, mults.block),
      serve: scale(p.serve, mults.serve),
      pass: scale(p.pass, mults.pass),
      set: scale(p.set, mults.set),
      dig: scale(p.dig, mults.dig),
    })),
  };
}

const other = (t: sim.TeamSide): sim.TeamSide => (t === 'home' ? 'away' : 'home');

/**
 * Sprint 30 — coach inputs for this rally. Applied BEFORE the rally
 * plays. AI fills in the rest (state.useCoachAi controls whether AI
 * runs at all). User actions take precedence over AI on the user's
 * own side.
 */
export type CoachInputs = {
  /** User initiated a timeout for this dead ball (their team only). */
  timeout?: { skill?: SkillKey };
  /** User-initiated substitution (their team only). */
  substitution?: { outIdx: number; inPlayerId: string };
};

export type StepEvent = 'rally' | 'set_complete' | 'match_complete';

export type StepResult = {
  newState: LiveMatchState;
  rally: sim.RallyResult;
  /** What kind of state transition occurred. 'set_complete' implies a rally was played and the set ended on it. */
  event: StepEvent;
  /**
   * Sprint 30 Task 30.4: opponent action taken in this rally's pre-rally
   * pass (used by smart-pause registry to stop bulk-play loops).
   * 'none' when the AI took no action OR userTeam='none'.
   */
  opponentAction: 'none' | 'timeout' | 'substitution';
};

/**
 * Advance the live match by exactly one rally. Throws if the match is already
 * finished. Pure function — `state` is not mutated; a new state is returned.
 */
export function simulateRallyStep(
  state: LiveMatchState,
  coachInputs?: CoachInputs,
): StepResult {
  if (state.status === 'finished') {
    throw new Error('simulateRallyStep: match is already finished');
  }

  // Working state — mutated as we apply inputs / AI / rally.
  let s: LiveMatchState = state;
  let opponentAction: 'none' | 'timeout' | 'substitution' = 'none';

  // ── Sprint 30: apply user inputs FIRST (highest priority) ────────────
  // Inputs are scoped to the user's team; calls for the opposite team are
  // ignored (the user can't act for the AI). userTeam='none' rejects all.
  if (coachInputs?.timeout && s.userTeam !== 'none') {
    const r = sim.applyUserTimeout(s, {
      hcStrategy: 50, // step has no DB context; service supplies real value via callUserTimeout pre-step
      ...(coachInputs.timeout.skill ? { skill: coachInputs.timeout.skill } : {}),
    });
    if (r.ok) s = r.state;
    // Failed user input is silently ignored at the engine layer; the IPC
    // path (callUserTimeout) surfaces the error to the renderer instead.
  }
  if (coachInputs?.substitution && s.userTeam !== 'none') {
    const r = sim.applyUserSubstitution(s, coachInputs.substitution);
    if (r.ok) s = r.state;
  }

  // Working copies for inline mutation below.
  let homeT: TeamLiveState = s.home;
  let awayT: TeamLiveState = s.away;
  let serving: sim.TeamSide = s.server;
  let momentum: sim.MomentumState = s.momentum;
  let timeoutsHome: sim.TimeoutLedger = s.timeoutsHome;
  let timeoutsAway: sim.TimeoutLedger = s.timeoutsAway;
  let subsHome: number = s.subsHome;
  let subsAway: number = s.subsAway;
  let coachActionLog = s.coachActionLog;
  const activeBoost = s.activeBoost;
  const newTimeouts: TimeoutInvocation[] = [];

  // ── Coach AI: mirror simulateSet's pre-rally timeout pass exactly ─────
  if (s.useCoachAi) {
    const homeScore = s.currentSet.home;
    const awayScore = s.currentSet.away;
    for (const side of ['home', 'away'] as sim.TeamSide[]) {
      const opponent = other(side);
      const opponentRun = momentum.lastWinner === opponent ? momentum.runLength : 0;
      const myTimeouts = side === 'home' ? timeoutsHome : timeoutsAway;
      const decision = sim.shouldCallTimeout({
        myScore: side === 'home' ? homeScore : awayScore,
        theirScore: side === 'home' ? awayScore : homeScore,
        opponentRunLength: opponentRun,
        timeoutsRemaining: myTimeouts.remaining,
      });
      if (decision.kind === 'timeout') {
        const res = sim.attemptTimeout(myTimeouts, s.currentSet.rallyIdxInSet);
        if (res.ok) {
          const before = momentum;
          momentum = sim.resetOnTimeout(momentum, side);
          newTimeouts.push({
            atRallyIdx: s.currentSet.rallyIdxInSet,
            by: side,
            opponentRunLength: opponentRun,
            momentumBefore: before,
            momentumAfter: momentum,
          });
          if (side === 'home') timeoutsHome = res.ledger;
          else timeoutsAway = res.ledger;
          // Sprint 30 Task 30.4: track opponent TO for smart-pause.
          if (s.userTeam !== 'none' && side !== s.userTeam) {
            opponentAction = 'timeout';
          }
        }
      }
    }

    // Sprint 30 Task 30.3 + Retro fix #6: AI sub for the OPPONENT side
    // only (user controls their team). Skip when userTeam='none'.
    // Enforces 5-rally cooldown via state.aiSubCooldown. -1 sentinel
    // means "no prior AI sub" (cooldown N/A — first sub always allowed).
    if (s.userTeam !== 'none') {
      const opp: sim.TeamSide = s.userTeam === 'home' ? 'away' : 'home';
      const lastAiSub = opp === 'home' ? s.aiSubCooldown.home : s.aiSubCooldown.away;
      const cooldownExpired = lastAiSub < 0 || s.rallyCursor - lastAiSub >= sim.AI_SUB_COOLDOWN_RALLIES;
      if (cooldownExpired) {
        const stateForAi: LiveMatchState = {
          ...s, home: homeT, away: awayT, momentum,
          timeoutsHome, timeoutsAway, subsHome, subsAway,
          coachActionLog, activeBoost,
        };
        const decision = sim.aiPickSubstitution(stateForAi, opp);
        if (decision.kind === 'sub') {
          const subRes = sim.applyUserSubstitution(
            { ...stateForAi, userTeam: opp },
            { outIdx: decision.outIdx, inPlayerId: decision.inPlayerId },
          );
          if (subRes.ok) {
            const after = subRes.state;
            homeT = after.home;
            awayT = after.away;
            subsHome = after.subsHome;
            subsAway = after.subsAway;
            coachActionLog = after.coachActionLog;
            // Retro fix #6: stamp cooldown so AI doesn't sub again for 5 rallies.
            s = {
              ...s,
              aiSubCooldown: {
                ...s.aiSubCooldown,
                [opp]: s.rallyCursor,
              },
            };
            if (opponentAction === 'none') opponentAction = 'substitution';
          }
        }
      }
    }
  }

  // Snapshot the working state used by the rally below (used by the
  // skill-multiplier builder, which reads liveMomentum + activeBoost).
  const stateForMults: LiveMatchState = {
    ...s,
    home: homeT, away: awayT,
    momentum, timeoutsHome, timeoutsAway,
    subsHome, subsAway, coachActionLog, activeBoost,
  };

  // ── Apply per-skill multiplier matrix (momentum × skill-talk boost) ──
  // When useLiveMomentum is false AND no activeBoost, both matrices are
  // unit (all 1.0) and withSkillMultipliers returns the original lineup
  // by reference — byte-equality with simulateMatch is preserved.
  const homeMults = buildSkillMultipliers(stateForMults, 'home');
  const awayMults = buildSkillMultipliers(stateForMults, 'away');
  let homeLineupForRally = withSkillMultipliers(homeT.lineup, homeMults);
  let awayLineupForRally = withSkillMultipliers(awayT.lineup, awayMults);

  // Sprint 31 Task 31.3: layer positional rules on top (front-row attack
  // ×1.10, back-row pass × hint-dependent). Gated by useLivePositionalRules
  // so byte-equality holds for sim-only path.
  let homeSetterDumpProb = 0;
  let awaySetterDumpProb = 0;
  if (s.useLivePositionalRules) {
    homeLineupForRally = applyPositionalToLineup(
      homeLineupForRally, homeT.rotation, homeT.libero, homeT.tacticalHint,
    );
    awayLineupForRally = applyPositionalToLineup(
      awayLineupForRally, awayT.rotation, awayT.libero, awayT.tacticalHint,
    );
    if (homeT.system) {
      homeSetterDumpProb = setterDumpProbability(
        homeT.tacticalHint,
        homeT.system.system,
        isSetterFrontRow(homeT.system, homeT.rotation),
      );
    }
    if (awayT.system) {
      awaySetterDumpProb = setterDumpProbability(
        awayT.tacticalHint,
        awayT.system.system,
        isSetterFrontRow(awayT.system, awayT.rotation),
      );
    }
  }

  // ── Run the rally ─────────────────────────────────────────────────────
  const rallySeed = `${s.seed}:s${s.currentSet.index}:r${s.currentSet.rallyIdxInSet}`;
  const rallyResult = simulateRally({
    seed: rallySeed,
    home: homeLineupForRally,
    away: awayLineupForRally,
    servingTeam: serving,
    homeRotation: homeT.rotation,
    awayRotation: awayT.rotation,
    homeLibero: homeT.libero,
    awayLibero: awayT.libero,
    homeSetterIndex: homeT.setterIndex,
    awaySetterIndex: awayT.setterIndex,
    ...(homeT.system && { homeSystem: homeT.system }),
    ...(awayT.system && { awaySystem: awayT.system }),
    momentum,
    // Sprint 31 Task 31.3: setter-dump probability per team. Both default
    // to 0 unless useLivePositionalRules + defensive 5-1 + setter front-row.
    ...((homeSetterDumpProb > 0 || awaySetterDumpProb > 0) && {
      setterDumpProb: { home: homeSetterDumpProb, away: awaySetterDumpProb },
    }),
  });

  // ── Update post-rally state ───────────────────────────────────────────
  const winner = rallyResult.winningTeam;
  const newSetHome = s.currentSet.home + (winner === 'home' ? 1 : 0);
  const newSetAway = s.currentSet.away + (winner === 'away' ? 1 : 0);
  const newMomentum = sim.updateOnPoint(momentum, winner);

  // Side-out → opposite team rotates and serves next.
  const sideOut = winner !== serving;
  if (sideOut) {
    if (serving === 'home') {
      awayT = { ...awayT, rotation: sim.rotate(awayT.rotation) };
      serving = 'away';
    } else {
      homeT = { ...homeT, rotation: sim.rotate(homeT.rotation) };
      serving = 'home';
    }
  }

  // Append rally + momentum + timeouts to current-set ledger.
  const updatedCurrentSet = {
    ...s.currentSet,
    home: newSetHome,
    away: newSetAway,
    rallyIdxInSet: s.currentSet.rallyIdxInSet + 1,
    rallies: [...s.currentSet.rallies, rallyResult],
    momentumAfterRally: [...s.currentSet.momentumAfterRally, newMomentum],
    timeouts: newTimeouts.length > 0
      ? [...s.currentSet.timeouts, ...newTimeouts]
      : s.currentSet.timeouts,
  };

  const setCompleteNow =
    (newSetHome >= updatedCurrentSet.targetScore && newSetHome - newSetAway >= 2) ||
    (newSetAway >= updatedCurrentSet.targetScore && newSetAway - newSetHome >= 2);

  const newLiveMomentum = computeLiveMomentum(newSetHome, newSetAway);

  let baseState: LiveMatchState = {
    ...s,
    home: homeT,
    away: awayT,
    server: serving,
    momentum: newMomentum,
    liveMomentum: newLiveMomentum,
    timeoutsHome,
    timeoutsAway,
    subsHome,
    subsAway,
    activeBoost,
    coachActionLog,
    currentSet: updatedCurrentSet,
    rallyCursor: s.rallyCursor + 1,
  };

  // Sprint 30 Task 30.2: decrement active skill-talk boost by 1 point per
  // rally. Clears boost when pointsRemaining reaches 0.
  baseState = decrementBoost(baseState);

  if (!setCompleteNow) {
    return { newState: baseState, rally: rallyResult, event: 'rally', opponentAction };
  }

  // ── Set complete ──────────────────────────────────────────────────────
  const completed: CompletedSet = {
    index: updatedCurrentSet.index,
    homeScore: newSetHome,
    awayScore: newSetAway,
    rallies: updatedCurrentSet.rallies,
    momentumAfterRally: updatedCurrentSet.momentumAfterRally,
    timeouts: updatedCurrentSet.timeouts,
    servingTeamEnd: serving,
    finalMomentum: newMomentum,
    finalTimeoutsHome: timeoutsHome,
    finalTimeoutsAway: timeoutsAway,
  };

  const newSetsWon = {
    home: s.setsWon.home + (newSetHome > newSetAway ? 1 : 0),
    away: s.setsWon.away + (newSetAway > newSetHome ? 1 : 0),
  };

  const matchOver = newSetsWon.home >= 3 || newSetsWon.away >= 3;

  if (matchOver) {
    const finishedState: LiveMatchState = {
      ...baseState,
      setsWon: newSetsWon,
      completedSets: [...s.completedSets, completed],
      status: 'finished',
      winner: newSetsWon.home > newSetsWon.away ? 'home' : 'away',
    };
    return { newState: finishedState, rally: rallyResult, event: 'match_complete', opponentAction };
  }

  // ── Set complete but match continues — initialize next set ────────────
  // Mirrors simulateMatch lines 56-61: carry rotation forward, flip server.
  const nextSetIndex = (updatedCurrentSet.index + 1) as 0 | 1 | 2 | 3 | 4;
  const nextInitialServer =
    updatedCurrentSet.initialServer === 'home' ? 'away' : 'home';
  const nextStartState: LiveMatchState = {
    ...baseState,
    setsWon: newSetsWon,
    completedSets: [...s.completedSets, completed],
    server: nextInitialServer,
    momentum: sim.initialMomentum(),
    liveMomentum: { home: 0, away: 0 },
    timeoutsHome: sim.emptyTimeoutLedger(),
    timeoutsAway: sim.emptyTimeoutLedger(),
    subsHome: 0,
    subsAway: 0,
    activeBoost: null,
    currentSet: {
      index: nextSetIndex,
      home: 0,
      away: 0,
      targetScore: targetScoreForSet(nextSetIndex),
      initialServer: nextInitialServer,
      rallyIdxInSet: 0,
      rallies: [],
      momentumAfterRally: [],
      timeouts: [],
    },
  };
  return { newState: nextStartState, rally: rallyResult, event: 'set_complete', opponentAction };
}

// Re-export the helpers from shared for callers' convenience.
export { currentSetComplete, matchComplete };
