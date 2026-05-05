// Sprint 32 Task 32.6 — per-skill headroom indicator on PlayerProfileModal.
// Headroom is computed live from `lineFunc(40,1.5,100,0.25)(rating)` clamped
// to [0, 2]:
//   curve > 1.0  → "Wide open" (rating < ~70)
//   0.5 < curve ≤ 1.0 → "Some room" (rating ~70..~90)
//   curve ≤ 0.5 → "Capped" (rating ≥ ~90)

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { axe } from 'jest-axe';
import type { rosterIpc } from '@vcd/shared';
import { PlayerProfileModal } from '../../app/src/components/PlayerProfileModal';

afterEach(() => cleanup());

const baseStats: rosterIpc.PlayerSeasonStats = {
  setsPlayed: 0,
  matchesPlayed: 0,
  kills: 0,
  errors: 0,
  totalAttacks: 0,
  hittingPctMilli: 0,
  digs: 0,
  blocks: 0,
  aces: 0,
  assists: 0,
};

function buildProfile(over: Partial<rosterIpc.PlayerRatings> = {}): rosterIpc.PlayerProfile {
  return {
    id: 'p1',
    firstName: 'Test',
    lastName: 'Player',
    jersey: 7,
    position: 'OH',
    classYear: 'JR',
    height: 185,
    hometownCity: 'Lincoln',
    hometownState: 'NE',
    isLibero: false,
    isCaptain: false,
    redshirtUsed: false,
    overall: 75,
    potential: 88,
    ratings: {
      attack: 75, block: 70, serve: 65, pass: 70, set: 60,
      dig: 70, athleticism: 75, iq: 70, stamina: 75,
      ...over,
    },
    teamAbbr: 'NEB',
    teamSchool: 'Nebraska',
    currentSeasonStats: baseStats,
    careerStats: baseStats,
    nilCents: 0,
  };
}

describe('PlayerProfileModal — Sprint 32 headroom indicator', () => {
  it('renders a headroom indicator on every one of the 9 skill rows', () => {
    render(
      <PlayerProfileModal
        profile={buildProfile()}
        loading={false}
        error={null}
        onClose={() => undefined}
      />,
    );
    for (const skill of [
      'attack', 'block', 'serve', 'pass', 'set', 'dig',
      'athleticism', 'iq', 'stamina',
    ]) {
      expect(screen.getByTestId(`headroom-${skill}`)).toBeTruthy();
    }
  });

  it('rating 50 → "Wide open"', () => {
    render(
      <PlayerProfileModal
        profile={buildProfile({ attack: 50 })}
        loading={false}
        error={null}
        onClose={() => undefined}
      />,
    );
    const cell = screen.getByTestId('headroom-attack');
    expect(within(cell).getByText('Wide open')).toBeTruthy();
  });

  it('rating 80 → "Some room"', () => {
    render(
      <PlayerProfileModal
        profile={buildProfile({ attack: 80 })}
        loading={false}
        error={null}
        onClose={() => undefined}
      />,
    );
    const cell = screen.getByTestId('headroom-attack');
    expect(within(cell).getByText('Some room')).toBeTruthy();
  });

  it('rating 95 → "Capped"', () => {
    render(
      <PlayerProfileModal
        profile={buildProfile({ attack: 95 })}
        loading={false}
        error={null}
        onClose={() => undefined}
      />,
    );
    const cell = screen.getByTestId('headroom-attack');
    expect(within(cell).getByText('Capped')).toBeTruthy();
  });

  it('color-blind safe: indicator contains a TEXT label, not just an icon', () => {
    render(
      <PlayerProfileModal
        profile={buildProfile({ attack: 50 })}
        loading={false}
        error={null}
        onClose={() => undefined}
      />,
    );
    const cell = screen.getByTestId('headroom-attack');
    // The label text must be present (not solely conveyed via color/icon).
    expect(cell.textContent ?? '').toMatch(/Wide open|Some room|Capped/);
  });

  it('axe-core: zero violations', async () => {
    const { container } = render(
      <PlayerProfileModal
        profile={buildProfile()}
        loading={false}
        error={null}
        onClose={() => undefined}
      />,
    );
    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });
});
