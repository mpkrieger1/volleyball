// Sprint 33 Task 33.4 — AI focus heuristic determinism + ranking.

import { describe, it, expect } from 'vitest';
import { pickAiFocusesForCoach } from '../../../main/src/offseason/aiFocusHeuristic';

const baseRoster = [
  { potential: 90, ratingAttack: 50, ratingBlock: 80, ratingServe: 80, ratingPass: 80, ratingSet: 80, ratingDig: 80, ratingAthleticism: 80, ratingIq: 80, ratingStamina: 80 },
  { potential: 90, ratingAttack: 55, ratingBlock: 80, ratingServe: 80, ratingPass: 80, ratingSet: 80, ratingDig: 80, ratingAthleticism: 80, ratingIq: 80, ratingStamina: 80 },
  { potential: 90, ratingAttack: 60, ratingBlock: 80, ratingServe: 80, ratingPass: 80, ratingSet: 80, ratingDig: 80, ratingAthleticism: 80, ratingIq: 80, ratingStamina: 80 },
];

describe('pickAiFocusesForCoach', () => {
  it('returns exactly 3 attributes from the role pool', () => {
    const out = pickAiFocusesForCoach({ role: 'AHC', roster: baseRoster, facilitiesLevel: 5 });
    expect(out).toHaveLength(3);
    expect(out.sort()).toEqual(['attack', 'serve', 'set']);
  });

  it('AHC pool ranks "attack" first when attack ratings are lowest (most headroom)', () => {
    const roster = baseRoster.map((p) => ({ ...p, ratingServe: 90, ratingSet: 90 }));
    const out = pickAiFocusesForCoach({ role: 'AHC', roster, facilitiesLevel: 5 });
    expect(out[0]).toBe('attack');
  });

  it('determinism: same input → same output', () => {
    const a = pickAiFocusesForCoach({ role: 'HC', roster: baseRoster, facilitiesLevel: 5 });
    const b = pickAiFocusesForCoach({ role: 'HC', roster: baseRoster, facilitiesLevel: 5 });
    expect(a).toEqual(b);
  });

  it('alphabetical tie-break when scores match', () => {
    // All ratings identical → all attributes have identical headroom score.
    const flatRoster = [
      { potential: 80, ratingAttack: 50, ratingBlock: 50, ratingServe: 50, ratingPass: 50, ratingSet: 50, ratingDig: 50, ratingAthleticism: 50, ratingIq: 50, ratingStamina: 50 },
    ];
    const out = pickAiFocusesForCoach({ role: 'HC', roster: flatRoster, facilitiesLevel: 5 });
    // HC pool: athleticism, iq, stamina — alphabetical = athleticism, iq, stamina.
    expect(out).toEqual(['athleticism', 'iq', 'stamina']);
  });

  it('empty roster → returns canonical role pool order (no crash)', () => {
    const out = pickAiFocusesForCoach({ role: 'AC', roster: [], facilitiesLevel: 5 });
    expect(out.sort()).toEqual(['block', 'dig', 'pass']);
  });
});
