// Sprint 36 Task 36.5 — NilOfferSlider.
//
// Slider from $0 to min(5×baseline, available budget). Live preview of
// converted points via convertNilOfferToPoints. "Confirm" button persists
// the offer and bumps Team.nilBudgetUsedCents (delta-aware semantics in
// the IPC handler).

import { useState } from 'react';
import { recruiting } from '@vcd/shared';

type Props = {
  recruitStars: number;
  priorities: recruiting.RecruitPriorities;
  currentOfferCents: number;
  budgetCents: number;
  budgetUsedCents: number;
  onConfirm: (offerCents: number) => void;
};

function fmtMoney(cents: number): string {
  const dollars = Math.round(cents / 100);
  if (dollars >= 1000) return `$${(dollars / 1000).toFixed(0)}k`;
  return `$${dollars}`;
}

export function NilOfferSlider({
  recruitStars,
  priorities,
  currentOfferCents,
  budgetCents,
  budgetUsedCents,
  onConfirm,
}: Props) {
  const baseline = recruiting.getNilOfferBaselineCents({ stars: recruitStars });
  const sliderMax = Math.min(baseline * 5, budgetCents); // 5× baseline ceiling
  const [draftCents, setDraftCents] = useState<number>(currentOfferCents);
  const stepCents = 100_000; // $1k step

  const remaining = budgetCents - budgetUsedCents + currentOfferCents;
  const canConfirm = draftCents <= remaining;
  const previewPoints = recruiting.convertNilOfferToPoints({
    offerCents: draftCents,
    recruit: { stars: recruitStars },
    priorities,
  });

  return (
    <section
      className="nil-offer-slider"
      aria-labelledby="nil-offer-slider-heading"
      data-testid="nil-offer-slider"
    >
      <h4 id="nil-offer-slider-heading" className="nil-offer-slider__heading">
        NIL Offer
      </h4>
      <div className="nil-offer-slider__row">
        <label htmlFor="nil-slider-input" className="nil-offer-slider__label">
          Offer:
          <span data-testid="nil-offer-amount">{fmtMoney(draftCents)}</span>
        </label>
        <input
          id="nil-slider-input"
          type="range"
          min={0}
          max={sliderMax}
          step={stepCents}
          value={draftCents}
          onChange={(e) => setDraftCents(Number(e.target.value))}
          data-testid="nil-offer-input"
          className="nil-offer-slider__input"
        />
      </div>
      <p className="nil-offer-slider__preview" data-testid="nil-offer-preview">
        {fmtMoney(draftCents)} = +{previewPoints} interest points
      </p>
      <p className="nil-offer-slider__budget">
        Budget: {fmtMoney(budgetUsedCents)} used / {fmtMoney(budgetCents)} total
      </p>
      <button
        type="button"
        onClick={() => onConfirm(draftCents)}
        disabled={!canConfirm}
        data-testid="nil-offer-confirm"
        className="nil-offer-slider__confirm"
      >
        Confirm offer
      </button>
    </section>
  );
}
