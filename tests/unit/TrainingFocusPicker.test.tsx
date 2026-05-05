// Sprint 33 Task 33.5 — TrainingFocusPicker.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import type { offseasonIpc } from '@vcd/shared';
import { TrainingFocusPicker } from '../../app/src/components/TrainingFocusPicker';

afterEach(() => cleanup());

function buildCoach(
  role: 'HC' | 'AHC' | 'AC',
  validFocuses: offseasonIpc.CoachSlotInfo['validFocuses'],
  defaults: offseasonIpc.CoachSlotInfo['defaultPicks'],
  current: offseasonIpc.CoachSlotInfo['currentPicks'] = [null, null, null],
): offseasonIpc.CoachSlotInfo {
  return {
    coachId: `coach-${role}`,
    firstName: 'Coach',
    lastName: role,
    role,
    ratingDevelop: 75,
    validFocuses,
    defaultPicks: defaults,
    currentPicks: current,
  };
}

function buildAllCoaches(): offseasonIpc.CoachSlotInfo[] {
  return [
    buildCoach(
      'HC',
      ['athleticism', 'iq', 'stamina'],
      ['athleticism', 'iq', 'stamina'],
    ),
    buildCoach(
      'AHC',
      ['attack', 'serve', 'set'],
      ['attack', 'serve', 'set'],
    ),
    buildCoach(
      'AC',
      ['block', 'pass', 'dig'],
      ['block', 'pass', 'dig'],
    ),
  ];
}

describe('TrainingFocusPicker', () => {
  it('renders 9 dropdowns (3 coaches × 3 slots)', () => {
    render(
      <TrainingFocusPicker
        coaches={buildAllCoaches()}
        onPick={() => undefined}
        onAdvance={() => undefined}
      />,
    );
    for (const role of ['HC', 'AHC', 'AC'] as const) {
      for (const slot of [0, 1, 2]) {
        expect(screen.getByTestId(`slot-${role}-${slot}`)).toBeTruthy();
      }
    }
  });

  it('coach panels show ratingDevelop', () => {
    render(
      <TrainingFocusPicker
        coaches={buildAllCoaches()}
        onPick={() => undefined}
        onAdvance={() => undefined}
      />,
    );
    const labels = screen.getAllByText(/DEV 75/);
    expect(labels.length).toBe(3);
  });

  it('disables Advance until all 9 slots are filled', () => {
    render(
      <TrainingFocusPicker
        coaches={buildAllCoaches()} // currentPicks = [null,null,null]
        onPick={() => undefined}
        onAdvance={() => undefined}
      />,
    );
    expect(screen.getByTestId('training-focus-advance')).toBeDisabled();
  });

  it('enables Advance when every slot has a picked attribute', () => {
    const filled = buildAllCoaches().map((c) => ({
      ...c,
      currentPicks: c.defaultPicks.slice(0, 3),
    }));
    render(
      <TrainingFocusPicker
        coaches={filled}
        onPick={() => undefined}
        onAdvance={() => undefined}
      />,
    );
    expect(screen.getByTestId('training-focus-advance')).not.toBeDisabled();
  });

  it('clicking Advance fires onAdvance', () => {
    const onAdvance = vi.fn();
    const filled = buildAllCoaches().map((c) => ({
      ...c,
      currentPicks: c.defaultPicks.slice(0, 3),
    }));
    render(
      <TrainingFocusPicker
        coaches={filled}
        onPick={() => undefined}
        onAdvance={onAdvance}
      />,
    );
    fireEvent.click(screen.getByTestId('training-focus-advance'));
    expect(onAdvance).toHaveBeenCalledOnce();
  });

  it('changing a slot dropdown fires onPick(coachId, slotIndex, attribute)', () => {
    const onPick = vi.fn();
    render(
      <TrainingFocusPicker
        coaches={buildAllCoaches()}
        onPick={onPick}
        onAdvance={() => undefined}
      />,
    );
    fireEvent.change(screen.getByTestId('slot-HC-1'), { target: { value: 'stamina' } });
    expect(onPick).toHaveBeenCalledWith('coach-HC', 1, 'stamina');
  });

  it('axe-core: zero violations', async () => {
    const { container } = render(
      <TrainingFocusPicker
        coaches={buildAllCoaches()}
        onPick={() => undefined}
        onAdvance={() => undefined}
      />,
    );
    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });
});
