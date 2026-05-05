// Sprint 34 Task 34.6 — PracticeFocusPicker.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { PracticeFocusPicker } from '../../app/src/components/PracticeFocusPicker';

afterEach(() => cleanup());

function buildState(over: Partial<{
  offenseFocus: string;
  defenseFocus: string;
  autoOffenseSuggestion: string;
  autoDefenseSuggestion: string;
}> = {}) {
  return {
    ok: true as const,
    week: 3,
    offenseFocus: over.offenseFocus ?? 'POWER_HITTING',
    defenseFocus: over.defenseFocus ?? 'BLOCK_HEAVY',
    autoOffenseSuggestion: over.autoOffenseSuggestion ?? 'POWER_HITTING',
    autoDefenseSuggestion: over.autoDefenseSuggestion ?? 'BLOCK_HEAVY',
    opponentSummary: {
      serveAceRate: 0.06,
      aceAllowedRate: 0.05,
      hittingPct: 0.27,
      blockPerSet: 2.1,
      digPerSet: 14.5,
      attackErrorRate: 0.18,
    },
    fromUserPick: false,
    hasUpcomingMatch: true,
    opponentTeamId: 't-opp',
  };
}

describe('PracticeFocusPicker', () => {
  it('renders offense + defense dropdowns with 4 options each', () => {
    render(<PracticeFocusPicker state={buildState()} onPick={() => undefined} />);
    const offense = screen.getByTestId('practice-focus-offense') as HTMLSelectElement;
    const defense = screen.getByTestId('practice-focus-defense') as HTMLSelectElement;
    expect(offense.options).toHaveLength(4);
    expect(defense.options).toHaveLength(4);
  });

  it('default selections match props', () => {
    render(
      <PracticeFocusPicker
        state={buildState({ offenseFocus: 'BALL_CONTROL', defenseFocus: 'DEFEND_TIPS_ROLLS' })}
        onPick={() => undefined}
      />,
    );
    const offense = screen.getByTestId('practice-focus-offense') as HTMLSelectElement;
    const defense = screen.getByTestId('practice-focus-defense') as HTMLSelectElement;
    expect(offense.value).toBe('BALL_CONTROL');
    expect(defense.value).toBe('DEFEND_TIPS_ROLLS');
  });

  it('the auto-suggested option is tagged "(suggested)" in the dropdown', () => {
    render(
      <PracticeFocusPicker
        state={buildState({ autoOffenseSuggestion: 'POWER_HITTING' })}
        onPick={() => undefined}
      />,
    );
    const offense = screen.getByTestId('practice-focus-offense') as HTMLSelectElement;
    const suggested = Array.from(offense.options).find((o) => o.value === 'POWER_HITTING')!;
    expect(suggested.textContent).toContain('suggested');
  });

  it('changing offense fires onPick with new offense + current defense', () => {
    const onPick = vi.fn();
    render(<PracticeFocusPicker state={buildState()} onPick={onPick} />);
    fireEvent.change(screen.getByTestId('practice-focus-offense'), {
      target: { value: 'SERVE_AGGRESSION' },
    });
    expect(onPick).toHaveBeenCalledWith('SERVE_AGGRESSION', 'BLOCK_HEAVY');
  });

  it('"Reset to suggestion" fires onPick with auto values', () => {
    const onPick = vi.fn();
    render(
      <PracticeFocusPicker
        state={buildState({
          offenseFocus: 'BALL_CONTROL',
          defenseFocus: 'DEFEND_TIPS_ROLLS',
          autoOffenseSuggestion: 'POWER_HITTING',
          autoDefenseSuggestion: 'BLOCK_HEAVY',
        })}
        onPick={onPick}
      />,
    );
    fireEvent.click(screen.getByTestId('practice-focus-reset'));
    expect(onPick).toHaveBeenCalledWith('POWER_HITTING', 'BLOCK_HEAVY');
  });

  it('renders opponent summary with formatted ratios', () => {
    render(<PracticeFocusPicker state={buildState()} onPick={() => undefined} />);
    const summary = screen.getByTestId('practice-focus-summary');
    expect(summary.textContent ?? '').toContain('6.0%'); // serveAceRate 0.06
    expect(summary.textContent ?? '').toContain('27.0%'); // hittingPct 0.27
    expect(summary.textContent ?? '').toContain('2.10'); // blockPerSet
  });

  it('axe-core: zero violations', async () => {
    const { container } = render(
      <PracticeFocusPicker state={buildState()} onPick={() => undefined} />,
    );
    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });
});
