// Sprint 36 Task 36.5 — PitchReasonsCard.
//
// Renders one pitch reason as a card. Active and inactive states have
// distinct visuals AND text labels (color-blind safe).

import type { recruiting } from '@vcd/shared';

type Props = {
  reason: recruiting.PitchReasonResult;
};

const TYPE_LABELS: Record<recruiting.PitchReasonType, string> = {
  COACH_PEDIGREE: 'Coach Pedigree',
  COACH_CONNECTION: 'Coach Connection',
};

export function PitchReasonsCard({ reason }: Props) {
  return (
    <article
      className={
        reason.active
          ? 'pitch-reason-card pitch-reason-card--active'
          : 'pitch-reason-card pitch-reason-card--inactive'
      }
      data-testid={`pitch-reason-${reason.type}`}
      aria-label={`${TYPE_LABELS[reason.type]} (${reason.active ? 'active' : 'inactive'})`}
    >
      <header className="pitch-reason-card__header">
        <h5 className="pitch-reason-card__title">{TYPE_LABELS[reason.type]}</h5>
        <span
          className="pitch-reason-card__status"
          data-testid={`pitch-reason-status-${reason.type}`}
        >
          {reason.active ? 'ACTIVE' : 'INACTIVE'}
        </span>
        {reason.active && (
          <span
            className="pitch-reason-card__points"
            data-testid={`pitch-reason-points-${reason.type}`}
          >
            +{reason.points}
          </span>
        )}
      </header>
      <p className="pitch-reason-card__flavor">{reason.flavorText}</p>
    </article>
  );
}
