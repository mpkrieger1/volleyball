// Sprint 36 Task 36.5 — NilOfferSlider tests.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { NilOfferSlider } from '../../app/src/components/NilOfferSlider';

afterEach(() => cleanup());

const basePriorities = {
  playingTime: 5,
  proximityToHome: 5,
  prestige: 5,
  facilities: 5,
  nilDeal: 8,
};

describe('NilOfferSlider', () => {
  it('renders slider with current offer + budget label', () => {
    render(
      <NilOfferSlider
        recruitStars={5}
        priorities={basePriorities}
        currentOfferCents={5_000_000}
        budgetCents={30_000_000}
        budgetUsedCents={10_000_000}
        onConfirm={() => undefined}
      />,
    );
    expect(screen.getByTestId('nil-offer-input')).toBeTruthy();
    expect(screen.getByTestId('nil-offer-amount').textContent).toContain('50');
  });

  it('changing the slider updates the live preview points', () => {
    render(
      <NilOfferSlider
        recruitStars={5}
        priorities={basePriorities}
        currentOfferCents={0}
        budgetCents={30_000_000}
        budgetUsedCents={0}
        onConfirm={() => undefined}
      />,
    );
    fireEvent.change(screen.getByTestId('nil-offer-input'), {
      target: { value: '12500000' }, // $125k = 0.5× baseline
    });
    // 75 × 8 × 0.5 = 300 → cap 200
    expect(screen.getByTestId('nil-offer-preview').textContent).toContain('+200');
  });

  it('Confirm button disabled when offer exceeds available budget', () => {
    render(
      <NilOfferSlider
        recruitStars={5}
        priorities={basePriorities}
        currentOfferCents={0}
        budgetCents={10_000_000}
        budgetUsedCents={9_000_000} // only $10k left
        onConfirm={() => undefined}
      />,
    );
    fireEvent.change(screen.getByTestId('nil-offer-input'), {
      target: { value: '5000000' }, // $50k > $10k available
    });
    const cta = screen.getByTestId('nil-offer-confirm') as HTMLButtonElement;
    expect(cta.disabled).toBe(true);
  });

  it('clicking Confirm fires onConfirm with the draft cents', () => {
    const onConfirm = vi.fn();
    render(
      <NilOfferSlider
        recruitStars={5}
        priorities={basePriorities}
        currentOfferCents={0}
        budgetCents={30_000_000}
        budgetUsedCents={0}
        onConfirm={onConfirm}
      />,
    );
    fireEvent.change(screen.getByTestId('nil-offer-input'), { target: { value: '5000000' } });
    fireEvent.click(screen.getByTestId('nil-offer-confirm'));
    expect(onConfirm).toHaveBeenCalledWith(5_000_000);
  });

  it('axe-core: zero violations', async () => {
    const { container } = render(
      <NilOfferSlider
        recruitStars={5}
        priorities={basePriorities}
        currentOfferCents={0}
        budgetCents={30_000_000}
        budgetUsedCents={0}
        onConfirm={() => undefined}
      />,
    );
    expect((await axe(container)).violations).toEqual([]);
  });
});
