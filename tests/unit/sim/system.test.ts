import { describe, expect, it } from 'vitest';
import { sim } from '@vcd/shared';

describe('offensive system', () => {
  it('5-1 keeps the same setter across all rotations', () => {
    const config = sim.defaultSystem51(); // setter = index 0
    for (let i = 0; i < 6; i++) {
      const rot = sim.rotateBy(sim.initialRotation(), i);
      expect(sim.deriveCurrentSetter(config, rot)).toBe(0);
    }
  });

  it('6-2 selects whichever setter is in the back row', () => {
    const config = sim.defaultSystem62(); // A=0, B=3 (opposite each other)
    // initialRotation: 0@P1, 3@P4 → A in back (P1), B in front (P4)
    expect(sim.deriveCurrentSetter(config, sim.initialRotation())).toBe(0);
    // After 3 rotations: 0 moves P1→P6→P5→P4, 3 moves P4→P3→P2→P1 → A front, B back
    const rot3 = sim.rotateBy(sim.initialRotation(), 3);
    expect(sim.positionOf(rot3, 0)).toBe('P4');
    expect(sim.positionOf(rot3, 3)).toBe('P1');
    expect(sim.deriveCurrentSetter(config, rot3)).toBe(3);
  });

  it('5-1 includes the setter in front-row attacker pool when they are front-row', () => {
    const config = sim.defaultSystem51();
    // After 3 rotations, setter (index 0) is at P4 — front-row.
    const rot = sim.rotateBy(sim.initialRotation(), 3);
    const attackers = sim.eligibleFrontRowAttackers(config, rot);
    expect(attackers).toContain(0);
    expect(attackers.length).toBe(3);
  });

  it('6-2 excludes BOTH setter indices from the attacker pool', () => {
    const config = sim.defaultSystem62();
    for (let i = 0; i < 6; i++) {
      const rot = sim.rotateBy(sim.initialRotation(), i);
      const attackers = sim.eligibleFrontRowAttackers(config, rot);
      expect(attackers).not.toContain(config.setterAIndex);
      expect(attackers).not.toContain(config.setterBIndex);
      // Pool is always 2 in 6-2 (one setter is always front-row, one back-row).
      expect(attackers.length).toBe(2);
    }
  });

  it('libero is filtered from attacker pool even if somehow in front-row', () => {
    const config = sim.defaultSystem51();
    const L = 5;
    const libero = sim.liberoOff(L);
    // Rotate so the libero is at P4.
    const rot = sim.rotateBy(sim.initialRotation(), 2);
    expect(sim.positionOf(rot, L)).toBe('P4');
    const attackers = sim.eligibleFrontRowAttackers(config, rot, libero);
    expect(attackers).not.toContain(L);
  });

  it('SystemConfigSchema rejects unknown system names', () => {
    expect(() => sim.SystemConfigSchema.parse({ system: '4-2', setterIndex: 0 })).toThrow();
    expect(() => sim.SystemConfigSchema.parse({ system: '6-2', setterAIndex: 0 })).toThrow(); // missing B
  });
});
