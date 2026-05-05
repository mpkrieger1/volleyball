// Sprint 29 Task 29.6: coach action log scaffolding.

import { describe, expect, it } from 'vitest';
import { sim } from '@vcd/shared';
import {
  CoachActionLogSchema,
  serializeCoachActionLog,
  parseCoachActionLog,
  type CoachActionLog,
} from '@vcd/shared/sim/live/coachActions';
import { simulateMatchLive, type TeamMatchState } from '@vcd/workers';

const balanced = (): sim.PlayerRatings => ({
  attack: 50, block: 50, serve: 50, pass: 50, set: 50, dig: 50,
  athleticism: 50, iq: 50, stamina: 50,
});

const teamMatchState = (team: sim.TeamSide): TeamMatchState => ({
  lineup: { team, players: Array.from({ length: 6 }, () => balanced()) },
  rotation: sim.initialRotation(),
  libero: sim.liberoOff(5),
  setterIndex: 0,
  system: sim.defaultSystem51(),
});

describe('CoachAction discriminated union', () => {
  it('schema accepts a timeout entry', () => {
    const log: CoachActionLog = [
      { kind: 'timeout', team: 'home', rallyIndex: 12, skill: 'attack' },
    ];
    expect(() => CoachActionLogSchema.parse(log)).not.toThrow();
  });

  it('schema accepts a timeout entry without skill (skip)', () => {
    const log: CoachActionLog = [
      { kind: 'timeout', team: 'home', rallyIndex: 5 },
    ];
    expect(() => CoachActionLogSchema.parse(log)).not.toThrow();
  });

  it('schema accepts a substitution entry', () => {
    const log: CoachActionLog = [
      { kind: 'substitution', team: 'away', rallyIndex: 8, out: 'pid-1', in: 'pid-2' },
    ];
    expect(() => CoachActionLogSchema.parse(log)).not.toThrow();
  });

  it('schema accepts a rotation entry', () => {
    const log: CoachActionLog = [
      {
        kind: 'rotation',
        team: 'home',
        setIndex: 1,
        rotation: { slots: [0, 1, 2, 3, 4, 5] },
        system: '5-1',
        libero: 'pid-libero',
        hint: 'balanced',
      },
    ];
    expect(() => CoachActionLogSchema.parse(log)).not.toThrow();
  });

  it('schema rejects unknown kind', () => {
    const log = [{ kind: 'whatever', team: 'home' }];
    expect(() => CoachActionLogSchema.parse(log as unknown)).toThrow();
  });

  it('schema rejects mixed valid + invalid entries', () => {
    const log = [
      { kind: 'timeout', team: 'home', rallyIndex: 1 },
      { kind: 'substitution', team: 'away', rallyIndex: 'not-a-number', out: 'x', in: 'y' },
    ];
    expect(() => CoachActionLogSchema.parse(log as unknown)).toThrow();
  });
});

describe('serialize / parse round-trip', () => {
  it('null → undefined', () => {
    expect(parseCoachActionLog(null)).toBeUndefined();
    expect(serializeCoachActionLog(undefined)).toBeNull();
  });

  it('empty log → "[]" → empty log', () => {
    expect(serializeCoachActionLog([])).toBe('[]');
    expect(parseCoachActionLog('[]')).toEqual([]);
  });

  it('round-trips a mixed log', () => {
    const log: CoachActionLog = [
      { kind: 'timeout', team: 'home', rallyIndex: 12, skill: 'attack' },
      { kind: 'substitution', team: 'away', rallyIndex: 17, out: 'p1', in: 'p2' },
      {
        kind: 'rotation',
        team: 'home',
        setIndex: 2,
        rotation: { slots: [3, 4, 5, 0, 1, 2] },
        system: '6-2',
        libero: 'pl',
        hint: 'aggressive',
      },
    ];
    const json = serializeCoachActionLog(log);
    expect(json).not.toBeNull();
    expect(parseCoachActionLog(json!)).toEqual(log);
  });
});

describe('write path through simulateMatchLive', () => {
  it('a Sprint 29 live match produces an EMPTY coach action log (no actions yet)', () => {
    const live = simulateMatchLive({
      seed: 'empty-log',
      home: teamMatchState('home'),
      away: teamMatchState('away'),
      initialServer: 'home',
      useCoachAi: false,
    });
    expect(live.finalState.coachActionLog).toEqual([]);
    // Sanity: the field is in the schema-defined shape and would round-trip.
    expect(serializeCoachActionLog(live.finalState.coachActionLog)).toBe('[]');
  });
});
