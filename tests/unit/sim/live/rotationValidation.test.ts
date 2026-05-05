// Sprint 31 Task 31.1: rotation validator tests.

import { describe, expect, it } from 'vitest';
import { sim } from '@vcd/shared';

const slots = (P1='a', P2='b', P3='c', P4='d', P5='e', P6='f') => ({ P1, P2, P3, P4, P5, P6 });

describe('validateRotation — all six slots filled, distinct', () => {
  it('passes for a fully filled, distinct lineup (5-1, libero at P5)', () => {
    const r = sim.validateRotation({
      slots: slots(),
      system: '5-1',
      libero: 'e',
      setterSlot: 'P1',
    });
    expect(r.ok).toBe(true);
  });

  it('rejects empty slot', () => {
    const r = sim.validateRotation({
      slots: slots('a','b','c','','e','f'),
      system: '5-1',
      libero: 'e',
      setterSlot: 'P1',
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some(e => e.includes('P4'))).toBe(true);
  });

  it('rejects duplicate player', () => {
    const r = sim.validateRotation({
      slots: slots('a','b','c','d','e','a'),
      system: '5-1',
      libero: 'e',
      setterSlot: 'P1',
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some(e => e.includes('multiple'))).toBe(true);
  });
});

describe('validateRotation — 5-1 setter overlap', () => {
  it.each([
    ['P1', 'P4'],
    ['P2', 'P5'],
    ['P3', 'P6'],
    ['P4', 'P1'],
    ['P5', 'P2'],
    ['P6', 'P3'],
  ] as const)('setter at %s requires opposite at %s filled', (setterSlot, opp) => {
    expect(sim.OPPOSITE_SLOT[setterSlot]).toBe(opp);
  });

  it('passes when setter has filled opposite', () => {
    const r = sim.validateRotation({
      slots: slots(),
      system: '5-1',
      libero: 'e',
      setterSlot: 'P1', // opposite is P4 (filled with 'd')
    });
    expect(r.ok).toBe(true);
  });
});

describe('validateRotation — 6-2 setter pair', () => {
  it('passes when two setters opposite each other', () => {
    const r = sim.validateRotation({
      slots: slots(),
      system: '6-2',
      libero: 'e',
      setterSlotsTwo: { a: 'P1', b: 'P4' },
    });
    expect(r.ok).toBe(true);
  });

  it('rejects same slot for both setters', () => {
    const r = sim.validateRotation({
      slots: slots(),
      system: '6-2',
      libero: 'e',
      setterSlotsTwo: { a: 'P1', b: 'P1' },
    });
    expect(r.ok).toBe(false);
  });

  it('rejects non-opposite setter pair', () => {
    const r = sim.validateRotation({
      slots: slots(),
      system: '6-2',
      libero: 'e',
      setterSlotsTwo: { a: 'P1', b: 'P5' }, // P1's opposite is P4, not P5
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some(e => e.includes('not opposite'))).toBe(true);
  });
});

describe('validateRotation — libero rules', () => {
  it('rejects libero in front row', () => {
    const r = sim.validateRotation({
      slots: slots(),
      system: '5-1',
      libero: 'b', // P2 = front-row
      setterSlot: 'P1',
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some(e => e.includes('back-row'))).toBe(true);
  });

  it('rejects libero not assigned to any slot', () => {
    const r = sim.validateRotation({
      slots: slots(),
      system: '5-1',
      libero: 'z', // not in any slot
      setterSlot: 'P1',
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some(e => e.includes('not assigned'))).toBe(true);
  });

  it('accepts libero at P1, P5, or P6', () => {
    for (const liberoSlot of ['P1', 'P5', 'P6'] as const) {
      const slotsMap = slots();
      const liberoId = slotsMap[liberoSlot];
      const r = sim.validateRotation({
        slots: slotsMap,
        system: '5-1',
        libero: liberoId,
        setterSlot: 'P3',
      });
      expect(r.ok).toBe(true);
    }
  });
});
