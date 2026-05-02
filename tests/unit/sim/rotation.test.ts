import { describe, expect, it } from 'vitest';
import { sim } from '@vcd/shared';

describe('rotation', () => {
  it('initialRotation places lineup indices 0..5 at P1..P6', () => {
    const r = sim.initialRotation();
    for (let i = 0; i < 6; i++) {
      expect(sim.playerAt(r, (['P1', 'P2', 'P3', 'P4', 'P5', 'P6'] as const)[i]!)).toBe(i);
    }
  });

  it('rotate shifts clockwise — the P2 player becomes the new server', () => {
    const r0 = sim.initialRotation(); // server=0, P2=1
    const r1 = sim.rotate(r0);
    expect(sim.playerAt(r1, 'P1')).toBe(1);
    expect(sim.playerAt(r1, 'P6')).toBe(0);
  });

  it('six rotations return to the initial state', () => {
    const r = sim.initialRotation();
    expect(sim.rotateBy(r, 6)).toEqual(r);
  });

  it('rotateBy handles negative and large N via modular arithmetic', () => {
    const r = sim.initialRotation();
    expect(sim.rotateBy(r, -1)).toEqual(sim.rotateBy(r, 5));
    expect(sim.rotateBy(r, 13)).toEqual(sim.rotateBy(r, 1));
  });

  it('isFrontRow / isBackRow partition the 6 positions', () => {
    expect(sim.FRONT_ROW_POSITIONS).toEqual(['P2', 'P3', 'P4']);
    expect(sim.BACK_ROW_POSITIONS).toEqual(['P1', 'P5', 'P6']);
    for (const p of ['P2', 'P3', 'P4'] as const) {
      expect(sim.isFrontRow(p)).toBe(true);
      expect(sim.isBackRow(p)).toBe(false);
    }
    for (const p of ['P1', 'P5', 'P6'] as const) {
      expect(sim.isFrontRow(p)).toBe(false);
      expect(sim.isBackRow(p)).toBe(true);
    }
  });

  it('positionOf inverts playerAt', () => {
    const r = sim.rotate(sim.initialRotation()); // slots = [1,2,3,4,5,0]
    expect(sim.positionOf(r, 1)).toBe('P1');
    expect(sim.positionOf(r, 0)).toBe('P6');
    expect(sim.positionOf(r, 99)).toBeNull();
  });

  it('checkOverlap flags duplicate or out-of-range slots', () => {
    expect(sim.checkOverlap(sim.initialRotation())).toEqual({ ok: true });
    expect(
      sim.checkOverlap({ slots: [0, 0, 1, 2, 3, 4] as unknown as sim.RotationState['slots'] })
        .code,
    ).toBe('DUPLICATE_SLOT');
    expect(
      sim.checkOverlap({ slots: [9, 1, 2, 3, 4, 5] as unknown as sim.RotationState['slots'] })
        .code,
    ).toBe('INVALID_PLAYER_INDEX');
  });

  it('RotationStateSchema rejects malformed tuples', () => {
    expect(() => sim.RotationStateSchema.parse({ slots: [0, 1, 2] })).toThrow();
    expect(() => sim.RotationStateSchema.parse({ slots: [0, 1, 2, 3, 4, 6] })).toThrow();
  });
});
