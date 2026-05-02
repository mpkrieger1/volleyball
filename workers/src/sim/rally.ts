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

import { createRng, sim, type Rng } from '@vcd/shared';

type PlayerLineup = sim.PlayerLineup;
type RallyEvent = sim.RallyEvent;
type RallyResult = sim.RallyResult;
type TeamSide = sim.TeamSide;
type InPlayServeQuality = sim.InPlayServeQuality;
type ReceptionGrade = sim.ReceptionGrade;
type SetQuality = sim.SetQuality;
type RotationState = sim.RotationState;
type LiberoState = sim.LiberoState;
type Position = sim.Position;
type SystemConfig = sim.SystemConfig;
type MomentumState = sim.MomentumState;

const { attackOutcome, digOutcome, receptionOutcome, sample, serveOutcome, setOutcome, TUNING } =
  sim;

export type SimulateRallyInput = {
  seed: number | string;
  home: PlayerLineup;
  away: PlayerLineup;
  servingTeam: TeamSide;
  /**
   * Optional rotation state per team. When present for either team, selection
   * for that team is position-aware. When omitted, Sprint 3 flat round-robin
   * behavior applies for back-compat.
   */
  homeRotation?: RotationState;
  awayRotation?: RotationState;
  /** Optional libero state per team. Ignored if the team has no rotation state. */
  homeLibero?: LiberoState | null;
  awayLibero?: LiberoState | null;
  /**
   * Lineup index of the designated setter for each team. Sprint 4 uses a single
   * setter regardless of position (5-1 baseline); Sprint 5's system toggle will
   * replace this with rotation-derived selection.
   */
  homeSetterIndex?: number;
  awaySetterIndex?: number;
  /**
   * Offensive system per team (Sprint 5). When omitted, falls back to the
   * setterIndex/round-robin path. When provided, drives setter + attacker
   * selection via `deriveCurrentSetter` and `eligibleFrontRowAttackers`.
   */
  homeSystem?: SystemConfig;
  awaySystem?: SystemConfig;
  /** Momentum state at start of rally (Sprint 5). Biases attack kill rate. */
  momentum?: MomentumState;
};

type TeamContext = {
  lineup: PlayerLineup;
  rotation: RotationState | undefined;
  libero: LiberoState | null | undefined;
  setterIndex: number | undefined;
  system: SystemConfig | undefined;
  /** Round-robin counter (Sprint 3 fallback path). */
  roundRobin: number;
};

export function simulateRally(input: SimulateRallyInput): RallyResult {
  const rootRng = createRng(input.seed);
  const events: RallyEvent[] = [];
  let tick = 0;

  const other = (t: TeamSide): TeamSide => (t === 'home' ? 'away' : 'home');

  const ctx: Record<TeamSide, TeamContext> = {
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

  const roll = (label: string): number => rootRng.fork(`${label}:${tick}`).next();
  const pickFromList = (arr: readonly number[], label: string): number => {
    if (arr.length === 0) throw new Error(`pickFromList: empty list for ${label}`);
    const u = roll(label);
    return arr[Math.floor(u * arr.length) % arr.length]!;
  };

  const nextSlot = (c: TeamContext): number => {
    const s = c.roundRobin % 6;
    c.roundRobin = (c.roundRobin + 1) % 6;
    return s;
  };

  const pickServer = (c: TeamContext): number => {
    if (!c.rotation) return nextSlot(c);
    return sim.serverAtP1(c.libero ?? null, c.rotation);
  };

  const pickReceiver = (c: TeamContext): number => {
    if (!c.rotation) return nextSlot(c);
    // Libero typically receives when they're on court; otherwise pick a back-row player.
    if (c.libero && sim.liberoIsOnCourt(c.libero)) return c.libero.liberoIndex;
    const backRow = [
      sim.playerAt(c.rotation, 'P1'),
      sim.playerAt(c.rotation, 'P5'),
      sim.playerAt(c.rotation, 'P6'),
    ];
    return pickFromList(backRow, 'receiver');
  };

  const pickSetter = (c: TeamContext): number => {
    if (!c.rotation) return nextSlot(c);
    if (c.system) return sim.deriveCurrentSetter(c.system, c.rotation);
    if (c.setterIndex !== undefined) return c.setterIndex;
    return sim.playerAt(c.rotation, 'P1');
  };

  const pickAttacker = (c: TeamContext): number => {
    if (!c.rotation) return nextSlot(c);
    const legal = c.system
      ? sim.eligibleFrontRowAttackers(c.system, c.rotation, c.libero ?? null)
      : (() => {
          const frontRow = [
            sim.playerAt(c.rotation!, 'P2'),
            sim.playerAt(c.rotation!, 'P3'),
            sim.playerAt(c.rotation!, 'P4'),
          ];
          return c.libero
            ? frontRow.filter((i) => !sim.liberoBlocksAttack(c.libero!, c.rotation!, i))
            : frontRow;
        })();
    return pickFromList(legal, 'attacker');
  };

  const pickBlocker = (c: TeamContext): number => {
    if (!c.rotation) return nextSlot(c);
    const frontRow = [
      sim.playerAt(c.rotation, 'P2'),
      sim.playerAt(c.rotation, 'P3'),
      sim.playerAt(c.rotation, 'P4'),
    ];
    return pickFromList(frontRow, 'blocker');
  };

  const pickDigger = (c: TeamContext): number => {
    if (!c.rotation) return nextSlot(c);
    // Libero strongly preferred when on court.
    if (c.libero && sim.liberoIsOnCourt(c.libero)) {
      if (roll('dig-libero') < 0.6) return c.libero.liberoIndex;
    }
    const backRow = [
      sim.playerAt(c.rotation, 'P1'),
      sim.playerAt(c.rotation, 'P5'),
      sim.playerAt(c.rotation, 'P6'),
    ];
    return pickFromList(backRow, 'digger');
  };

  const servingTeam = input.servingTeam;
  let attackingTeam: TeamSide = other(servingTeam);

  // ─── SERVE ────────────────────────────────────────────────────────────
  const srv = ctx[servingTeam];
  const rec = ctx[other(servingTeam)];
  const serverSlot = pickServer(srv);
  const serverR = srv.lineup.players[serverSlot]!;
  const receiverSlot = pickReceiver(rec);
  const receiverR = rec.lineup.players[receiverSlot]!;
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

  const inPlayQuality: InPlayServeQuality = serveKind;
  const inPlayGrade = inPlayQuality === 'in_play_good' ? 3 : inPlayQuality === 'in_play_ok' ? 2 : 1;
  events.push({
    kind: 'serve',
    tick,
    team: servingTeam,
    server: serverSlot,
    quality: 'in_play',
    inPlayGrade: inPlayGrade as 1 | 2 | 3,
  });
  tick += 1;

  // ─── RECEPTION ───────────────────────────────────────────────────────
  const recDist = receptionOutcome(receiverR, inPlayQuality);
  const recGrade = sample(recDist, roll('reception')) as ReceptionGrade;
  const recGradeNum: 0 | 1 | 2 | 3 =
    recGrade === 'perfect' ? 3 : recGrade === 'good' ? 2 : recGrade === 'ok' ? 1 : 0;
  events.push({
    kind: 'reception',
    tick,
    team: other(servingTeam),
    receiver: receiverSlot,
    grade: recGradeNum,
  });
  tick += 1;
  attackingTeam = other(servingTeam);

  let upcomingRecGrade: ReceptionGrade = recGrade;

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
    const setterR = atk.lineup.players[setterSlot]!;
    const setDist = setOutcome(setterR, upcomingRecGrade);
    const setQ = sample(setDist, roll('set')) as SetQuality;
    events.push({ kind: 'set', tick, team: attackingTeam, setter: setterSlot, quality: setQ });
    tick += 1;

    // ATTACK — validate front-row legality when rotation is provided.
    const attackerSlot = pickAttacker(atk);
    if (atk.rotation) {
      const pos = sim.positionOf(atk.rotation, attackerSlot) as Position | null;
      if (pos && sim.isBackRow(pos)) {
        events.push({
          kind: 'point',
          tick,
          winner: other(attackingTeam),
          reason: 'rotation_violation',
        });
        return finalize(events, input, other(attackingTeam));
      }
    }
    const attackerR = atk.lineup.players[attackerSlot]!;
    const blockerSlot = pickBlocker(def);
    const blockerR = def.lineup.players[blockerSlot]!;
    const momentumBias = input.momentum
      ? sim.attackMomentumBonus(input.momentum, attackingTeam)
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
    const diggerR = def.lineup.players[diggerSlot]!;
    const digDist = digOutcome(diggerR);
    const digK = sample(digDist, roll('dig'));
    const digGrade: 0 | 1 | 2 = digK === 'kept' ? 2 : 0;
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

function finalize(
  events: RallyEvent[],
  input: SimulateRallyInput,
  winner: TeamSide,
): RallyResult {
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
export function pureRng(seed: number | string): Rng {
  return createRng(seed);
}
