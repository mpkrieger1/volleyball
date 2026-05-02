import { describe, expect, it } from 'vitest';
import { pickStartersFromRoster } from '../../../main/src/match/pickStarters';

type Roster = Parameters<typeof pickStartersFromRoster>[1];

const RATINGS_HIGH = {
  ratingAttack: 90,
  ratingBlock: 80,
  ratingServe: 80,
  ratingPass: 75,
  ratingSet: 60,
  ratingDig: 70,
  ratingAthleticism: 80,
  ratingIq: 70,
  ratingStamina: 80,
};
const RATINGS_LOW = {
  ratingAttack: 50,
  ratingBlock: 50,
  ratingServe: 50,
  ratingPass: 50,
  ratingSet: 50,
  ratingDig: 50,
  ratingAthleticism: 50,
  ratingIq: 50,
  ratingStamina: 50,
};

function balancedRoster(): Roster {
  // 1 S, 3 OH, 3 MB, 2 OPP, 2 L, 1 DS — well above 6, position-balanced.
  return [
    { id: 'S1', position: 'S', isLibero: false, ...RATINGS_HIGH },
    { id: 'OH1', position: 'OH', isLibero: false, ...RATINGS_HIGH },
    { id: 'OH2', position: 'OH', isLibero: false, ...RATINGS_HIGH },
    { id: 'OH3', position: 'OH', isLibero: false, ...RATINGS_LOW },
    { id: 'MB1', position: 'MB', isLibero: false, ...RATINGS_HIGH },
    { id: 'MB2', position: 'MB', isLibero: false, ...RATINGS_HIGH },
    { id: 'MB3', position: 'MB', isLibero: false, ...RATINGS_LOW },
    { id: 'OPP1', position: 'OPP', isLibero: false, ...RATINGS_HIGH },
    { id: 'OPP2', position: 'OPP', isLibero: false, ...RATINGS_LOW },
    { id: 'L1', position: 'L', isLibero: true, ...RATINGS_HIGH },
    { id: 'L2', position: 'L', isLibero: true, ...RATINGS_LOW },
    { id: 'DS1', position: 'DS', isLibero: false, ...RATINGS_LOW },
  ];
}

describe('pickStartersFromRoster', () => {
  it('returns exactly 6 ids in slot order', () => {
    const ids = pickStartersFromRoster('TEAM_A', balancedRoster());
    expect(ids).toHaveLength(6);
    expect(new Set(ids).size).toBe(6); // no duplicates
  });

  it('slot 0 = best S, slot 5 = best L', () => {
    const ids = pickStartersFromRoster('TEAM_A', balancedRoster());
    expect(ids[0]).toBe('S1');
    expect(ids[5]).toBe('L1');
  });

  it('slots 1-4 cover OH/MB/OPP/MB by best-rating', () => {
    const ids = pickStartersFromRoster('TEAM_A', balancedRoster());
    expect(ids[1]).toBe('OH1'); // best OH
    expect(ids[2]).toBe('MB1'); // best MB
    expect(ids[3]).toBe('OPP1'); // best OPP
    expect(ids[4]).toBe('MB2'); // 2nd MB
  });

  it('falls back to alternate positions when one is missing', () => {
    // Roster with no L: slot 5 should fall back to DS or OH.
    const noL = balancedRoster().filter((p) => p.position !== 'L');
    const ids = pickStartersFromRoster('TEAM_NO_L', noL);
    expect(ids).toHaveLength(6);
    expect(new Set(ids).size).toBe(6);
    // L slot was filled with someone (OH, DS, or other).
    expect(ids[5]).toBeTruthy();
  });

  it('throws if fewer than 6 active players', () => {
    expect(() =>
      pickStartersFromRoster('TINY', balancedRoster().slice(0, 4)),
    ).toThrow(/at least 6/);
  });

  it('is deterministic for the same roster input', () => {
    const a = pickStartersFromRoster('T', balancedRoster());
    const b = pickStartersFromRoster('T', balancedRoster());
    expect(a).toEqual(b);
  });
});
