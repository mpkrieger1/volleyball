"use strict";
// Sprint 5 set loop — threads momentum + timeouts + coach AI across rallies.
//
//   - Play rallies until one team reaches targetScore with win-by-2.
//   - Advance the receiving team's rotation on side-out.
//   - Update momentum after every point; reset opposing momentum on timeout.
//   - When useCoachAi is set, each team's coach AI may call a timeout between
//     rallies based on the opponent's current run length.
Object.defineProperty(exports, "__esModule", { value: true });
exports.simulateSet = simulateSet;
const shared_1 = require("@vcd/shared");
const rally_1 = require("./rally");
const other = (t) => (t === 'home' ? 'away' : 'home');
function simulateSet(input) {
    const target = input.targetScore ?? 25;
    let home = input.home;
    let away = input.away;
    let serving = input.initialServer;
    let homeScore = 0;
    let awayScore = 0;
    let momentum = input.initialMomentum ?? shared_1.sim.initialMomentum();
    let timeoutsHome = shared_1.sim.emptyTimeoutLedger();
    let timeoutsAway = shared_1.sim.emptyTimeoutLedger();
    const rallies = [];
    const momentumAfterRally = [];
    const timeouts = [];
    let rallyIdx = 0;
    while (!setComplete(homeScore, awayScore, target)) {
        if (input.useCoachAi) {
            for (const side of ['home', 'away']) {
                const opponent = other(side);
                const opponentRun = momentum.lastWinner === opponent ? momentum.runLength : 0;
                const myTimeouts = side === 'home' ? timeoutsHome : timeoutsAway;
                const decision = shared_1.sim.shouldCallTimeout({
                    myScore: side === 'home' ? homeScore : awayScore,
                    theirScore: side === 'home' ? awayScore : homeScore,
                    opponentRunLength: opponentRun,
                    timeoutsRemaining: myTimeouts.remaining,
                });
                if (decision.kind === 'timeout') {
                    const res = shared_1.sim.attemptTimeout(myTimeouts, rallyIdx);
                    if (res.ok) {
                        const before = momentum;
                        momentum = shared_1.sim.resetOnTimeout(momentum, side);
                        timeouts.push({
                            atRallyIdx: rallyIdx,
                            by: side,
                            opponentRunLength: opponentRun,
                            momentumBefore: before,
                            momentumAfter: momentum,
                        });
                        if (side === 'home')
                            timeoutsHome = res.ledger;
                        else
                            timeoutsAway = res.ledger;
                    }
                }
            }
        }
        const rallyResult = (0, rally_1.simulateRally)({
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
        });
        rallies.push(rallyResult);
        rallyIdx += 1;
        if (rallyResult.winningTeam === 'home')
            homeScore += 1;
        else
            awayScore += 1;
        momentum = shared_1.sim.updateOnPoint(momentum, rallyResult.winningTeam);
        momentumAfterRally.push(momentum);
        const sideOut = rallyResult.winningTeam !== serving;
        if (sideOut) {
            if (serving === 'home') {
                away = { ...away, rotation: shared_1.sim.rotate(away.rotation) };
                serving = 'away';
            }
            else {
                home = { ...home, rotation: shared_1.sim.rotate(home.rotation) };
                serving = 'home';
            }
        }
        if (rallies.length > 200) {
            throw new Error(`simulateSet: exceeded 200 rallies at ${homeScore}-${awayScore}; engine bug.`);
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
function setComplete(home, away, target) {
    if (home >= target && home - away >= 2)
        return true;
    if (away >= target && away - home >= 2)
        return true;
    return false;
}
//# sourceMappingURL=set.js.map