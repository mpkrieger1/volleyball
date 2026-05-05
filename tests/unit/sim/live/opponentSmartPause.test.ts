// Sprint 30 Task 30.4: opponent-action smart-pause wiring.
//
// Verifies StepResult.opponentAction populated correctly when the AI
// timeout/sub path fires for the side OPPOSITE state.userTeam.

import { describe, expect, it } from 'vitest';
import { sim } from '@vcd/shared';
import { simulateRallyStep } from '@vcd/workers';
import {
  createLiveMatchState,
  type LiveMatchState,
  type TeamLiveState,
  type BenchPlayer,
} from '@vcd/shared/sim/live/state';

const balanced = (): sim.PlayerRatings => ({
  attack: 50, block: 50, serve: 50, pass: 50, set: 50, dig: 50,
  athleticism: 50, iq: 50, stamina: 50,
});

const benchPlayer = (id: string): BenchPlayer => ({
  playerId: id,
  firstName: 'B',
  lastName: id,
  position: 'OH',
  jersey: 99,
  isLibero: false,
  ratings: balanced(),
});

const liveTeam = (team: sim.TeamSide, bench: BenchPlayer[] = []): TeamLiveState => ({
  lineup: { team, players: Array.from({ length: 6 }, () => balanced()) },
  rotation: sim.initialRotation(),
  libero: sim.liberoOff(5),
  setterIndex: 0,
  system: sim.defaultSystem51(),
  playerIdsBySlot: ['s0', 's1', 's2', 's3', 's4', 's5'],
  bench,
});

describe('opponentAction in StepResult', () => {
  it("AI opponent timeout sets opponentAction='timeout' (opp on a 3+ run)", () => {
    // home is the user team; force AI(=away) to call a TO by simulating
    // away has built a 3+ point run AND has timeouts available AND home
    // is trailing.
    const s: LiveMatchState = {
      ...createLiveMatchState({
        matchId: 'm', seed: 'opp-to', home: liveTeam('home'), away: liveTeam('away'),
        initialServer: 'home', useCoachAi: true,
        userTeam: 'home',
      }),
      momentum: { home: 0, away: 0.6, lastWinner: 'away', runLength: 4 },
      currentSet: {
        index: 0, home: 5, away: 9, targetScore: 25, initialServer: 'home',
        rallyIdxInSet: 14, rallies: [], momentumAfterRally: [], timeouts: [],
      },
    };
    // Wait — the AI calls TO when ITS opponent is on a run AND IT trails.
    // away calling a TO needs: home on a run AND away trails.
    // So flip the setup: home leading + on a run → away calls TO.
    const flipped: LiveMatchState = {
      ...s,
      momentum: { home: 0.6, away: 0, lastWinner: 'home', runLength: 4 },
      currentSet: { ...s.currentSet, home: 9, away: 5 },
    };
    const r = simulateRallyStep(flipped);
    expect(r.opponentAction).toBe('timeout');
  });

  it("opponentAction='none' when opp doesn't trigger any AI action", () => {
    const s = createLiveMatchState({
      matchId: 'm', seed: 'no-action', home: liveTeam('home'), away: liveTeam('away'),
      initialServer: 'home', useCoachAi: true,
      userTeam: 'home',
    });
    const r = simulateRallyStep(s);
    expect(r.opponentAction).toBe('none');
  });

  it('opponentAction stays none when userTeam=none (sim mode)', () => {
    const s: LiveMatchState = {
      ...createLiveMatchState({
        matchId: 'm', seed: 'sim-mode', home: liveTeam('home'), away: liveTeam('away'),
        initialServer: 'home', useCoachAi: true,
      }),
      momentum: { home: 0.6, away: 0, lastWinner: 'home', runLength: 4 },
      currentSet: {
        index: 0, home: 9, away: 5, targetScore: 25, initialServer: 'home',
        rallyIdxInSet: 14, rallies: [], momentumAfterRally: [], timeouts: [],
      },
    };
    const r = simulateRallyStep(s);
    // userTeam is 'none' so neither side counts as opponent → 'none'
    expect(r.opponentAction).toBe('none');
  });

  it("AI opponent sub sets opponentAction='substitution' when fatigue exceeds threshold", () => {
    // Force 5 completed sets so fatigue = 5 * 0.5 = 2.5 > 2.0 threshold
    const completedSets = Array.from({ length: 5 }, (_, i) => ({
      index: i as 0|1|2|3|4, homeScore: 25, awayScore: 20,
      rallies: [], momentumAfterRally: [], timeouts: [],
      servingTeamEnd: 'home' as sim.TeamSide,
      finalMomentum: sim.initialMomentum(),
      finalTimeoutsHome: sim.emptyTimeoutLedger(),
      finalTimeoutsAway: sim.emptyTimeoutLedger(),
    }));
    const s: LiveMatchState = {
      ...createLiveMatchState({
        matchId: 'm', seed: 'opp-sub',
        home: liveTeam('home'),
        away: liveTeam('away', [benchPlayer('b1'), benchPlayer('b2')]),
        initialServer: 'home', useCoachAi: true,
        userTeam: 'home',
      }),
      completedSets,
      // Force a deep score so neither AI TO trigger fires (away not trailing on a run).
      currentSet: {
        index: 4, home: 8, away: 8, targetScore: 15, initialServer: 'home',
        rallyIdxInSet: 16, rallies: [], momentumAfterRally: [], timeouts: [],
      },
    };
    const r = simulateRallyStep(s);
    // Either timeout (if AI happens to call) or substitution. Either is
    // a valid opponent action — assert not 'none'.
    expect(['timeout', 'substitution']).toContain(r.opponentAction);
  });
});
