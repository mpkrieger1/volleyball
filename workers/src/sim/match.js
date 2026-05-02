"use strict";
// Sprint 4 best-of-5 match loop. Minimal — no system toggles, no timeouts,
// no momentum. Drives the rotation regression test.
Object.defineProperty(exports, "__esModule", { value: true });
exports.simulateMatch = simulateMatch;
const set_1 = require("./set");
function simulateMatch(input) {
    let home = { ...input.home, rotation: input.home.rotation };
    let away = { ...input.away, rotation: input.away.rotation };
    let initialServer = input.initialServer;
    let homeSetsWon = 0;
    let awaySetsWon = 0;
    const sets = [];
    for (let setIdx = 0; setIdx < 5; setIdx++) {
        const isDecider = setIdx === 4;
        const target = isDecider ? 15 : 25;
        const result = (0, set_1.simulateSet)({
            seed: `${input.seed}:s${setIdx}`,
            home,
            away,
            initialServer,
            targetScore: target,
        });
        sets.push(result);
        if (result.homeScore > result.awayScore)
            homeSetsWon += 1;
        else
            awaySetsWon += 1;
        if (homeSetsWon >= 3 || awaySetsWon >= 3)
            break;
        // Carry rotation state forward into the next set (real rule is: fresh
        // starting lineup per set; Sprint 4 simplifies by carrying current state).
        // Sprint 5 will reset to the coach-set starting lineup.
        home = result.finalHome;
        away = result.finalAway;
        initialServer = initialServer === 'home' ? 'away' : 'home';
    }
    return {
        winner: homeSetsWon > awaySetsWon ? 'home' : 'away',
        homeSetsWon,
        awaySetsWon,
        sets,
    };
}
//# sourceMappingURL=match.js.map