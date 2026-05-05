// Sprint 36 Task 36.5 — PitchReasonsCard tests.

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { PitchReasonsCard } from '../../app/src/components/PitchReasonsCard';

afterEach(() => cleanup());

const activeReason = {
  type: 'COACH_PEDIGREE' as const,
  active: true,
  points: 30,
  flavorText: 'Coach has won 3 national championships.',
};
const inactiveReason = {
  type: 'COACH_CONNECTION' as const,
  active: false,
  points: 0,
  flavorText: "None of the staff has a connection to the recruit's home state of NE.",
};

describe('PitchReasonsCard', () => {
  it('active reason shows ACTIVE badge + point value', () => {
    render(<PitchReasonsCard reason={activeReason} />);
    expect(screen.getByTestId('pitch-reason-status-COACH_PEDIGREE').textContent).toBe('ACTIVE');
    expect(screen.getByTestId('pitch-reason-points-COACH_PEDIGREE').textContent).toBe('+30');
  });

  it('inactive reason shows INACTIVE badge + flavor; no point value displayed', () => {
    render(<PitchReasonsCard reason={inactiveReason} />);
    expect(screen.getByTestId('pitch-reason-status-COACH_CONNECTION').textContent).toBe('INACTIVE');
    // Points span is omitted on inactive cards.
    const pointsSpan = screen.queryByTestId('pitch-reason-points-COACH_CONNECTION');
    expect(pointsSpan).toBeNull();
  });

  it('flavor text always visible (active or inactive)', () => {
    render(<PitchReasonsCard reason={activeReason} />);
    expect(screen.getByText(/national championships/)).toBeTruthy();
    cleanup();
    render(<PitchReasonsCard reason={inactiveReason} />);
    expect(screen.getByText(/connection to the recruit/)).toBeTruthy();
  });

  it('axe-core: zero violations (active)', async () => {
    const { container } = render(<PitchReasonsCard reason={activeReason} />);
    expect((await axe(container)).violations).toEqual([]);
  });

  it('axe-core: zero violations (inactive)', async () => {
    const { container } = render(<PitchReasonsCard reason={inactiveReason} />);
    expect((await axe(container)).violations).toEqual([]);
  });
});
