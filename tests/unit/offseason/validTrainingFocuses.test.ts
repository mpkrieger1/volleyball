// Sprint 32 Task 32.5 — port of FCCD module 22567.
// Maps coach role to the list of attributes that role can train.
// VCD: HC / AHC / AC. Pools must partition the 9 trainable skills.

import { describe, it, expect } from 'vitest';
import { offseason } from '@vcd/shared';

const ALL_SKILLS: offseason.TrainableSkill[] = [
  'attack', 'block', 'serve', 'pass', 'set', 'dig',
  'athleticism', 'iq', 'stamina',
];

describe('getValidTrainingFocuses', () => {
  it('HC pool', () => {
    expect(offseason.getValidTrainingFocuses('HC')).toEqual(['athleticism', 'iq', 'stamina']);
  });

  it('AHC pool (offense analogue)', () => {
    expect(offseason.getValidTrainingFocuses('AHC')).toEqual(['attack', 'serve', 'set']);
  });

  it('AC pool (defense analogue)', () => {
    expect(offseason.getValidTrainingFocuses('AC')).toEqual(['block', 'pass', 'dig']);
  });

  it('each role pool has exactly 3 skills', () => {
    for (const role of ['HC', 'AHC', 'AC'] as const) {
      expect(offseason.getValidTrainingFocuses(role)).toHaveLength(3);
    }
  });

  it('pools partition the trainable skill set — every skill reachable, none duplicated', () => {
    const seen = new Set<offseason.TrainableSkill>();
    for (const role of ['HC', 'AHC', 'AC'] as const) {
      for (const s of offseason.getValidTrainingFocuses(role)) {
        expect(seen.has(s)).toBe(false);
        seen.add(s);
      }
    }
    expect(seen.size).toBe(ALL_SKILLS.length);
    for (const s of ALL_SKILLS) expect(seen.has(s)).toBe(true);
  });
});
