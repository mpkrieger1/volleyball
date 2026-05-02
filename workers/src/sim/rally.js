"use strict";
// Rally FSM — Sprint 3 introduced the state machine with flat round-robin
// selection. Sprint 4 adds position-aware selection when `homeRotation` /
// `awayRotation` (and optional libero state) are supplied.
//
// BACK-COMPAT: when rotation state is omitted, the original flat-slot behavior
// runs unchanged so Sprint 3 golden fixtures stay valid until Task 4.7
// deliberately regenerates them.
//
// Determinism: every random draw goes through a seeded RNG fork keyed by a
// label + tick counter, so reordering statements within a state does not alter
// results for a given seed.
Object.defineProperty(exports, "__esModule", { value: true });
exports.simulateRally = simulateRally;
exports.pureRng = pureRng;
const shared_1 = require("@vcd/shared");
const { attackOutcome, digOutcome, receptionOutcome, sample, serveOutcome, setOutcome, TUNING } = shared_1.sim;
function simulateRally(input) {
    const rootRng = (0, shared_1.createRng)(input.seed);
    const events = [];
    let tick = 0;
    const other = (t) => (t === 'home' ? 'away' : 'home');
    const ctx = {
        home: {
            lineup: input.home,
            rotation: input.homeRotation,
            libero: input.homeLibero,
            setterIndex: input.homeSetterIndex,
            system: input.homeSystem,
            roundRobin: 0,
        },
        away: {
            lineup: input.away,
            rotation: input.awayRotation,
            libero: input.awayLibero,
            setterIndex: input.awaySetterIndex,
            system: input.awaySystem,
            roundRobin: 0,
        },
    };
    const roll = (label) => rootRng.fork(`${label}:${tick}`).next();
    const pickFromList = (arr, label) => {
        if (arr.length === 0)
            throw new Error(`pickFromList: empty list for ${label}`);
        const u = roll(label);
        return arr[Math.floor(u * arr.length) % arr.length];
    };
    const nextSlot = (c) => {
        const s = c.roundRobin % 6;
        c.roundRobin = (c.roundRobin + 1) % 6;
        return s;
    };
    const pickServer = (c) => {
        if (!c.rotation)
            return nextSlot(c);
        return shared_1.sim.serverAtP1(c.libero ?? null, c.rotation);
    };
    const pickReceiver = (c) => {
        if (!c.rotation)
            return nextSlot(c);
        // Libero typically receives when they're on court; otherwise pick a back-row player.
        if (c.libero && shared_1.sim.liberoIsOnCourt(c.libero))
            return c.libero.liberoIndex;
        const backRow = [
            shared_1.sim.playerAt(c.rotation, 'P1'),
            shared_1.sim.playerAt(c.rotation, 'P5'),
            shared_1.sim.playerAt(c.rotation, 'P6'),
        ];
        return pickFromList(backRow, 'receiver');
    };
    const pickSetter = (c) => {
        if (!c.rotation)
            return nextSlot(c);
        if (c.system)
            return shared_1.sim.deriveCurrentSetter(c.system, c.rotation);
        if (c.setterIndex !== undefined)
            return c.setterIndex;
        return shared_1.sim.playerAt(c.rotation, 'P1');
    };
    const pickAttacker = (c) => {
        if (!c.rotation)
            return nextSlot(c);
        const legal = c.system
            ? shared_1.sim.eligibleFrontRowAttackers(c.system, c.rotation, c.libero ?? null)
            : (() => {
                const frontRow = [
                    shared_1.sim.playerAt(c.rotation, 'P2'),
                    shared_1.sim.playerAt(c.rotation, 'P3'),
                    shared_1.sim.playerAt(c.rotation, 'P4'),
                ];
                return c.libero
                    ? frontRow.filter((i) => !shared_1.sim.liberoBlocksAttack(c.libero, c.rotation, i))
                    : frontRow;
            })();
        return pickFromList(legal, 'attacker');
    };
    const pickBlocker = (c) => {
        if (!c.rotation)
            return nextSlot(c);
        const frontRow = [
            shared_1.sim.playerAt(c.rotation, 'P2'),
            shared_1.sim.playerAt(c.rotation, 'P3'),
            shared_1.sim.playerAt(c.rotation, 'P4'),
        ];
        return pickFromList(frontRow, 'blocker');
    };
    const pickDigger = (c) => {
        if (!c.rotation)
            return nextSlot(c);
        // Libero strongly preferred when on court.
        if (c.libero && shared_1.sim.liberoIsOnCourt(c.libero)) {
            if (roll('dig-libero') < 0.6)
                return c.libero.liberoIndex;
        }
        const backRow = [
            shared_1.sim.playerAt(c.rotation, 'P1'),
            shared_1.sim.playerAt(c.rotation, 'P5'),
            shared_1.sim.playerAt(c.rotation, 'P6'),
        ];
        return pickFromList(backRow, 'digger');
    };
    const servingTeam = input.servingTeam;
    let attackingTeam = other(servingTeam);
    // ─── SERVE ────────────────────────────────────────────────────────────
    const srv = ctx[servingTeam];
    const rec = ctx[other(servingTeam)];
    const serverSlot = pickServer(srv);
    const serverR = srv.lineup.players[serverSlot];
    const receiverSlot = pickReceiver(rec);
    const receiverR = rec.lineup.players[receiverSlot];
    const serveDist = serveOutcome(serverR, receiverR);
    const serveKind = sample(serveDist, roll('serve'));
    if (serveKind === 'ace') {
        events.push({ kind: 'serve', tick, team: servingTeam, server: serverSlot, quality: 'ace' });
        events.push({ kind: 'point', tick: tick + 1, winner: servingTeam, reason: 'service_ace' });
        return finalize(events, input, servingTeam);
    }
    if (serveKind === 'error') {
        events.push({
            kind: 'serve',
            tick,
            team: servingTeam,
            server: serverSlot,
            quality: 'error',
        });
        events.push({
            kind: 'point',
            tick: tick + 1,
            winner: other(servingTeam),
            reason: 'service_error',
        });
        return finalize(events, input, other(servingTeam));
    }
    const inPlayQuality = serveKind;
    const inPlayGrade = inPlayQuality === 'in_play_good' ? 3 : inPlayQuality === 'in_play_ok' ? 2 : 1;
    events.push({
        kind: 'serve',
        tick,
        team: servingTeam,
        server: serverSlot,
        quality: 'in_play',
        inPlayGrade: inPlayGrade,
    });
    tick += 1;
    // ─── RECEPTION ───────────────────────────────────────────────────────
    const recDist = receptionOutcome(receiverR, inPlayQuality);
    const recGrade = sample(recDist, roll('reception'));
    const recGradeNum = recGrade === 'perfect' ? 3 : recGrade === 'good' ? 2 : recGrade === 'ok' ? 1 : 0;
    events.push({
        kind: 'reception',
        tick,
        team: other(servingTeam),
        receiver: receiverSlot,
        grade: recGradeNum,
    });
    tick += 1;
    attackingTeam = other(servingTeam);
    let upcomingRecGrade = recGrade;
    // ─── MAIN LOOP (SET → ATTACK → (DIG → SET → ATTACK)*) ─────────────────
    while (events.length < 200 /* safety */) {
        if (tick >= TUNING.MAX_CONTACTS) {
            events.push({ kind: 'point', tick, winner: attackingTeam, reason: 'contact_cap' });
            return finalize(events, input, attackingTeam);
        }
        const atk = ctx[attackingTeam];
        const def = ctx[other(attackingTeam)];
        // SET
        const setterSlot = pickSetter(atk);
        const setterR = atk.lineup.players[setterSlot];
        const setDist = setOutcome(setterR, upcomingRecGrade);
        const setQ = sample(setDist, roll('set'));
        events.push({ kind: 'set', tick, team: attackingTeam, setter: setterSlot, quality: setQ });
        tick += 1;
        // ATTACK — validate front-row legality when rotation is provided.
        const attackerSlot = pickAttacker(atk);
        if (atk.rotation) {
            const pos = shared_1.sim.positionOf(atk.rotation, attackerSlot);
            if (pos && shared_1.sim.isBackRow(pos)) {
                events.push({
                    kind: 'point',
                    tick,
                    winner: other(attackingTeam),
                    reason: 'rotation_violation',
                });
                return finalize(events, input, other(attackingTeam));
            }
        }
        const attackerR = atk.lineup.players[attackerSlot];
        const blockerSlot = pickBlocker(def);
        const blockerR = def.lineup.players[blockerSlot];
        const momentumBias = input.momentum
            ? shared_1.sim.attackMomentumBonus(input.momentum, attackingTeam)
            : 0;
        const atkDist = attackOutcome(attackerR, blockerR, setQ, momentumBias);
        const outcome = sample(atkDist, roll('attack'));
        events.push({ kind: 'attack', tick, team: attackingTeam, attacker: attackerSlot, outcome });
        tick += 1;
        if (outcome === 'kill') {
            events.push({ kind: 'point', tick, winner: attackingTeam, reason: 'kill' });
            return finalize(events, input, attackingTeam);
        }
        if (outcome === 'error') {
            events.push({
                kind: 'point',
                tick,
                winner: other(attackingTeam),
                reason: 'attack_error',
            });
            return finalize(events, input, other(attackingTeam));
        }
        if (outcome === 'blocked') {
            events.push({ kind: 'point', tick, winner: other(attackingTeam), reason: 'block' });
            return finalize(events, input, other(attackingTeam));
        }
        // outcome === 'dug'
        const diggerSlot = pickDigger(def);
        const diggerR = def.lineup.players[diggerSlot];
        const digDist = digOutcome(diggerR);
        const digK = sample(digDist, roll('dig'));
        const digGrade = digK === 'kept' ? 2 : 0;
        events.push({
            kind: 'dig',
            tick,
            team: other(attackingTeam),
            digger: diggerSlot,
            grade: digGrade,
        });
        tick += 1;
        if (digK === 'dropped') {
            events.push({ kind: 'point', tick, winner: attackingTeam, reason: 'kill' });
            return finalize(events, input, attackingTeam);
        }
        attackingTeam = other(attackingTeam);
        upcomingRecGrade = digGrade === 2 ? 'good' : 'bad';
    }
    events.push({ kind: 'point', tick, winner: attackingTeam, reason: 'contact_cap' });
    return finalize(events, input, attackingTeam);
}
function finalize(events, input, winner) {
    const nonTerminal = events.filter((e) => e.kind !== 'point');
    return {
        seed: input.seed,
        servingTeam: input.servingTeam,
        winningTeam: winner,
        events,
        contacts: nonTerminal.length,
    };
}
/** Export primarily for tests. */
function pureRng(seed) {
    return (0, shared_1.createRng)(seed);
}
//# sourceMappingURL=rally.js.map