// Sprint 36 Task 36.5 — PrioritiesReadout tests.

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { PrioritiesReadout } from '../../app/src/components/PrioritiesReadout';

afterEach(() => cleanup());

const basePriorities = {
  playingTime: 7,
  proximityToHome: 4,
  prestige: 9,
  facilities: 3,
  nilDeal: 5,
};

describe('PrioritiesReadout', () => {
  it('renders 5 priority rows with labels + values', () => {
    render(<PrioritiesReadout priorities={basePriorities} wantsToLeaveHome={false} />);
    for (const k of ['playingTime', 'proximityToHome', 'prestige', 'facilities', 'nilDeal']) {
      expect(screen.getByTestId(`priority-${k}`)).toBeTruthy();
    }
  });

  it('shows "wants to leave home" indicator when wantsToLeaveHome=true', () => {
    render(<PrioritiesReadout priorities={basePriorities} wantsToLeaveHome={true} />);
    const proximityRow = screen.getByTestId('priority-proximityToHome');
    expect(proximityRow.textContent).toContain('wants to leave');
  });

  it('omits the wants-to-leave indicator when false', () => {
    render(<PrioritiesReadout priorities={basePriorities} wantsToLeaveHome={false} />);
    const proximityRow = screen.getByTestId('priority-proximityToHome');
    expect(proximityRow.textContent).not.toContain('wants to leave');
  });

  it('axe-core: zero violations', async () => {
    const { container } = render(
      <PrioritiesReadout priorities={basePriorities} wantsToLeaveHome={false} />,
    );
    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });
});
