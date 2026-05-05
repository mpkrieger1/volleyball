// Sprint 31 Task 31.3 + Retro fix #19: 6-2 setter rotation across all 6 rotations.
// Verifies sim.deriveCurrentSetter returns the correct (back-row) setter
// for each rotation in a 6-2 system with setters at slots 0 and 3 (opposite).

import { describe, expect, it } from 'vitest';
import { sim } from '@vcd/shared';

describe('Sprint 31 Retro fix #19 — 6-2 setter rotation correctness', () => {
  it('across all 6 rotations, the back-row setter is the active setter', () => {
    const config = sim.defaultSystem62(); // setterAIndex=0, setterBIndex=3 (opposite)
    let rot = sim.initialRotation();
    // initialRotation: slots [0,1,2,3,4,5] at positions [P1,P2,P3,P4,P5,P6]
    // Setter A (slot 0) at P1 (back) → should be active.
    // Setter B (slot 3) at P4 (front) → should NOT be active.
    expect(sim.deriveCurrentSetter(config, rot)).toBe(0);

    // After 1 rotation: slot 0 → P6 (back), slot 3 → P3 (front).
    rot = sim.rotate(rot);
    expect(sim.deriveCurrentSetter(config, rot)).toBe(0);

    // After 2 rotations: slot 0 → P5 (back), slot 3 → P2 (front).
    rot = sim.rotate(rot);
    expect(sim.deriveCurrentSetter(config, rot)).toBe(0);

    // After 3 rotations: slot 0 → P4 (front), slot 3 → P1 (back).
    rot = sim.rotate(rot);
    expect(sim.deriveCurrentSetter(config, rot)).toBe(3);

    // After 4 rotations: slot 0 → P3 (front), slot 3 → P6 (back).
    rot = sim.rotate(rot);
    expect(sim.deriveCurrentSetter(config, rot)).toBe(3);

    // After 5 rotations: slot 0 → P2 (front), slot 3 → P5 (back).
    rot = sim.rotate(rot);
    expect(sim.deriveCurrentSetter(config, rot)).toBe(3);

    // After 6 rotations: back to start.
    rot = sim.rotate(rot);
    expect(sim.deriveCurrentSetter(config, rot)).toBe(0);
  });

  it('setterDumpProbability returns 0 for 6-2 in every rotation', () => {
    const config = sim.defaultSystem62();
    let rot = sim.initialRotation();
    for (let i = 0; i < 6; i++) {
      const setterIsFront = sim.isSetterFrontRow(config, rot);
      expect(sim.setterDumpProbability('defensive', '6-2', setterIsFront)).toBe(0);
      rot = sim.rotate(rot);
    }
  });
});
