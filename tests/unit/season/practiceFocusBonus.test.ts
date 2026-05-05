// Sprint 34 Task 34.3 — bonus modifier per (offense, defense) combo.

import { describe, it, expect } from 'vitest';
import { season } from '@vcd/shared';

describe('IDENTITY_PRACTICE_FOCUS_MODIFIER', () => {
  it('all bonuses === 1.0', () => {
    const m = season.IDENTITY_PRACTICE_FOCUS_MODIFIER;
    expect(m.attackBonus).toBe(1);
    expect(m.serveBonus).toBe(1);
    expect(m.passBonus).toBe(1);
    expect(m.blockBonus).toBe(1);
    expect(m.digBonus).toBe(1);
  });
});

describe('applyPracticeFocusBonus', () => {
  it('every (offense, defense) combo returns finite bonuses ∈ [0.95, 1.10]', () => {
    for (const off of season.getValidOffenseFocuses()) {
      for (const def of season.getValidDefenseFocuses()) {
        const m = season.applyPracticeFocusBonus(off, def);
        for (const k of ['attackBonus', 'serveBonus', 'passBonus', 'blockBonus', 'digBonus'] as const) {
          expect(Number.isFinite(m[k])).toBe(true);
          expect(m[k]).toBeGreaterThanOrEqual(0.95);
          expect(m[k]).toBeLessThanOrEqual(1.10);
        }
      }
    }
  });

  it('POWER_HITTING boosts attackBonus ≥ 1.03 across all defenses', () => {
    for (const def of season.getValidDefenseFocuses()) {
      expect(season.applyPracticeFocusBonus('POWER_HITTING', def).attackBonus).toBeGreaterThanOrEqual(1.03);
    }
  });

  it('SERVE_AGGRESSION boosts serveBonus ≥ 1.03 across all defenses', () => {
    for (const def of season.getValidDefenseFocuses()) {
      expect(season.applyPracticeFocusBonus('SERVE_AGGRESSION', def).serveBonus).toBeGreaterThanOrEqual(1.03);
    }
  });

  it('BLOCK_HEAVY defense boosts blockBonus ≥ 1.03 across all offenses', () => {
    for (const off of season.getValidOffenseFocuses()) {
      expect(season.applyPracticeFocusBonus(off, 'BLOCK_HEAVY').blockBonus).toBeGreaterThanOrEqual(1.03);
    }
  });

  it('SERVE_RECEIVE_FOCUS defense boosts passBonus ≥ 1.03 across all offenses', () => {
    for (const off of season.getValidOffenseFocuses()) {
      expect(season.applyPracticeFocusBonus(off, 'SERVE_RECEIVE_FOCUS').passBonus).toBeGreaterThanOrEqual(1.03);
    }
  });
});
