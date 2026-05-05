// Sprint 5 set loop — threads momentum + timeouts + coach AI across rallies.
//
//   - Play rallies until one team reaches targetScore with win-by-2.
//   - Advance the receiving team's rotation on side-out.
//   - Update momentum after every point; reset opposing momentum on timeout.
//   - When useCoachAi is set, each team's coach AI may call a timeout between
//     rallies based on the opponent's current run length.
//
// Sprint 34: passes optional homeModifier/awayModifier through to simulateRally.

import { sim, season } from '@vcd/shared';
import { simulateRally } from './rally';

export type TeamMatchState = {
  lineup: sim.PlayerLineup;
  rotation: sim.RotationState;
  libero: sim.LiberoState | null;
  setterIndex: number;
  /** Offensive system config (Sprint 5). Defaults to a plain 5-1 when omitted. */
  system?: sim.SystemConfig;
};

export type TimeoutInvocation = {
  atRallyIdx: number;
  by: sim.TeamSide;
  opponentRunLength: number;
  momentumBefore: sim.MomentumState;
  momentumAfter: sim.MomentumState;
};

export type SetResult = {
  homeScore: number;
  awayScore: number;
  rallies: sim.RallyResult[];
  /** Momentum snapshot AFTER each rally's point is applied. */
  momentumAfterRally: sim.MomentumState[];
  finalHome: TeamMatchState;
  finalAway: TeamMatchState;
  servingTeamEnd: sim.TeamSide;
  finalMomentum: sim.MomentumState;
  finalTimeoutsHome: sim.TimeoutLedger;
  finalTimeoutsAway: sim.TimeoutLedger;
  timeouts: TimeoutInvocation[];
};

export type SimulateSetInput = {
  seed: number | string;
  home: TeamMatchState;
  away: TeamMatchState;
  initialServer: sim.TeamSide;
  targetScore?: number;
  useCoachAi?: boolean;
  initialMomentum?: sim.MomentumState;
  /** Sprint 34: per-side practice-focus modifier. Pass-through to rally. */
  homeModifier?: season.PracticeFocusModifier;
  awayModifier?: season.PracticeFocusModifier;
};

const other = (t: sim.TeamSide): sim.TeamSide => (t === 'home' ? 'away' : 'home');

export function simulateSet(input: SimulateSetInput): SetResult {
  const target = input.targetScore ?? 25;
  let home = input.home;
  let away = input.away;
  let serving: sim.TeamSide = input.initialServer;
  let homeScore = 0;
  let awayScore = 0;
  let momentum: sim.MomentumState = input.initialMomentum ?? sim.initialMomentum();
  let timeoutsHome = sim.emptyTimeoutLedger();
  let timeoutsAway = sim.emptyTimeoutLedger();
  const rallies: sim.RallyResult[] = [];
  const momentumAfterRally: sim.MomentumState[] = [];
  const timeouts: TimeoutInvocation[] = [];

  let rallyIdx = 0;
  while (!setComplete(homeScore, awayScore, target)) {
    if (input.useCoachAi) {
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
          const res = sim.attemptTimeout(myTimeouts, rallyIdx);
          if (res.ok) {
            const before = momentum;
            momentum = sim.resetOnTimeout(momentum, side);
            timeouts.push({
              atRallyIdx: rallyIdx,
              by: side,
              opponentRunLength: opponentRun,
              momentumBefore: before,
              momentumAfter: momentum,
            });
            if (side === 'home') timeoutsHome = res.ledger;
            else timeoutsAway = res.ledger;
          }
        }
      }
    }

    const rallyResult = simulateRally({
      seed: `${input.seed}:r${rallyIdx}`,
      home: home.lineup,
      away: away.lineup,
      servingTeam: serving,
      homeRotation: home.rotation,
      awayRotation: away.rotation,
      homeLibero: home.libero,
      awayLibero: away.libero,
      homeSetterIndex: home.setterIndex,
      awaySetterIndex: away.setterIndex,
      ...(home.system && { homeSystem: home.system }),
      ...(away.system && { awaySystem: away.system }),
      momentum,
      ...(input.homeModifier && { homeModifier: input.homeModifier }),
      ...(input.awayModifier && { awayModifier: input.awayModifier }),
    });
    rallies.push(rallyResult);
    rallyIdx += 1;

    if (rallyResult.winningTeam === 'home') homeScore += 1;
    else awayScore += 1;
    momentum = sim.updateOnPoint(momentum, rallyResult.winningTeam);
    momentumAfterRally.push(momentum);

    const sideOut = rallyResult.winningTeam !== serving;
    if (sideOut) {
      if (serving === 'home') {
        away = { ...away, rotation: sim.rotate(away.rotation) };
        serving = 'away';
      } else {
        home = { ...home, rotation: sim.rotate(home.rotation) };
        serving = 'home';
      }
    }

    if (rallies.length > 200) {
      throw new Error(
        `simulateSet: exceeded 200 rallies at ${homeScore}-${awayScore}; engine bug.`,
      );
    }
  }

  return {
    homeScore,
    awayScore,
    rallies,
    momentumAfterRally,
    finalHome: home,
    finalAway: away,
    servingTeamEnd: serving,
    finalMomentum: momentum,
    finalTimeoutsHome: timeoutsHome,
    finalTimeoutsAway: timeoutsAway,
    timeouts,
  };
}

function setComplete(home: number, away: number, target: number): boolean {
  if (home >= target && home - away >= 2) return true;
  if (away >= target && away - home >= 2) return true;
  return false;
}
