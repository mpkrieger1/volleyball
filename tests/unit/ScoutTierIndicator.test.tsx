// Sprint 36 Task 36.5 — ScoutTierIndicator tests.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { ScoutTierIndicator } from '../../app/src/components/ScoutTierIndicator';

afterEach(() => cleanup());

describe('ScoutTierIndicator', () => {
  it('Tier 0 (scoutLevel=0): only first dot filled, button enabled', () => {
    const onScout = vi.fn();
    render(<ScoutTierIndicator scoutLevel={0} budgetRemaining={5} onScout={onScout} />);
    const d0 = screen.getByTestId('scout-dot-0');
    expect(d0.className).toContain('filled');
    const cta = screen.getByTestId('scout-tier-run') as HTMLButtonElement;
    expect(cta.disabled).toBe(false);
    expect(cta.textContent).toContain('Run Scout');
  });

  it('Tier 1 (scoutLevel=1): two dots filled, button enabled', () => {
    render(<ScoutTierIndicator scoutLevel={1} budgetRemaining={5} onScout={() => undefined} />);
    expect(screen.getByTestId('scout-dot-0').className).toContain('filled');
    expect(screen.getByTestId('scout-dot-1').className).toContain('filled');
  });

  it('Tier 2 (scoutLevel=2): all 3 dots filled, button DISABLED + label updated', () => {
    render(<ScoutTierIndicator scoutLevel={2} budgetRemaining={5} onScout={() => undefined} />);
    for (const i of [0, 1, 2]) {
      expect(screen.getByTestId(`scout-dot-${i}`).className).toContain('filled');
    }
    const cta = screen.getByTestId('scout-tier-run') as HTMLButtonElement;
    expect(cta.disabled).toBe(true);
    expect(cta.textContent).toBe('Fully Scouted');
  });

  it('Tier 2 from scoutLevel=3 (legacy ceiling): same Full state', () => {
    render(<ScoutTierIndicator scoutLevel={3} budgetRemaining={5} onScout={() => undefined} />);
    expect(screen.getByTestId('scout-dot-2').className).toContain('filled');
    expect((screen.getByTestId('scout-tier-run') as HTMLButtonElement).disabled).toBe(true);
  });

  it('button disabled when budget < cost (3 pts)', () => {
    render(<ScoutTierIndicator scoutLevel={0} budgetRemaining={2} onScout={() => undefined} />);
    expect((screen.getByTestId('scout-tier-run') as HTMLButtonElement).disabled).toBe(true);
  });

  it('clicking button fires onScout', () => {
    const onScout = vi.fn();
    render(<ScoutTierIndicator scoutLevel={0} budgetRemaining={5} onScout={onScout} />);
    fireEvent.click(screen.getByTestId('scout-tier-run'));
    expect(onScout).toHaveBeenCalledOnce();
  });

  it('axe-core: zero violations', async () => {
    const { container } = render(
      <ScoutTierIndicator scoutLevel={1} budgetRemaining={5} onScout={() => undefined} />,
    );
    expect((await axe(container)).violations).toEqual([]);
  });
});
