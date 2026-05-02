import { describe, expect, it } from 'vitest';
import { sim } from '@vcd/shared';

describe('libero rules', () => {
  const rotation: sim.RotationState = sim.initialRotation();
  // By convention, lineup index 0 is at P1 (back-row server slot). We'll make
  // index 5 the libero — they sit at P6 in the default rotation (back-row).
  const L = 5;

  it('liberoReplace allows swap with a back-row player', () => {
    const s = sim.liberoReplace(sim.liberoOff(L), rotation, sim.playerAt(rotation, 'P5'));
    expect(s.pairedBackRowIndex).toBe(sim.playerAt(rotation, 'P5'));
  });

  it('liberoReplace rejects a swap with a front-row player', () => {
    expect(() =>
      sim.liberoReplace(sim.liberoOff(L), rotation, sim.playerAt(rotation, 'P3')),
    ).toThrow(sim.LiberoRuleError);
  });

  it('liberoReplace rejects re-pairing with a different back-row player', () => {
    const s1 = sim.liberoReplace(sim.liberoOff(L), rotation, sim.playerAt(rotation, 'P5'));
    expect(() => sim.liberoReplace(s1, rotation, sim.playerAt(rotation, 'P6'))).toThrow();
  });

  it('liberoReturn clears the pairing', () => {
    const s = sim.liberoReplace(sim.liberoOff(L), rotation, sim.playerAt(rotation, 'P5'));
    expect(sim.liberoReturn(s).pairedBackRowIndex).toBeNull();
  });

  it('canServe is false for the libero by default, true with the exception flag', () => {
    const base = sim.liberoOff(L);
    expect(sim.canServe(base, L)).toBe(false);
    expect(sim.canServe({ ...base, exceptionUsed: true }, L)).toBe(true);
    expect(sim.canServe(base, 0)).toBe(true); // non-libero always allowed
  });

  it('liberoBlocksAttack is true only when the libero ends up in a front-row slot', () => {
    const s = sim.liberoOff(L);
    // Default rotation: libero (index 5) sits at P6 — back-row. Attack allowed.
    expect(sim.liberoBlocksAttack(s, rotation, L)).toBe(false);
    // Rotate 2 steps: slot 5 moves from P6 → P5 → P4 (front-row).
    const rotated = sim.rotateBy(rotation, 2);
    expect(sim.positionOf(rotated, L)).toBe('P4');
    expect(sim.liberoBlocksAttack(s, rotated, L)).toBe(true);
    // A non-libero attacker is never blocked by this guard.
    expect(sim.liberoBlocksAttack(s, rotated, 2)).toBe(false);
  });

  it('serverAtP1 substitutes the paired player when the libero lands at P1', () => {
    // Rotate until libero (slot 5) is at P1.
    const rotated = sim.rotateBy(rotation, 5); // after 5 rotations, slot 5 is at P1
    expect(sim.playerAt(rotated, 'P1')).toBe(L);
    const state = sim.liberoReplace(sim.liberoOff(L), rotated, sim.playerAt(rotated, 'P5'));
    // Server should be the paired player, NOT the libero.
    expect(sim.serverAtP1(state, rotated)).toBe(sim.playerAt(rotated, 'P5'));
    // With exception, libero serves.
    expect(sim.serverAtP1({ ...state, exceptionUsed: true }, rotated)).toBe(L);
  });
});
