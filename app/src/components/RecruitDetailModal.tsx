// Sprint 28 Task 28.5B: recruit detail modal.
// Sprint 37 Task 37.4: slots in the 4 Sprint 36 sub-components
// (PrioritiesReadout, PitchReasonsCard, ScoutTierIndicator, NilOfferSlider)
// against the extended getRecruitDetail IPC payload.
//
// Two sub-tabs (Battle, Scouting). Action buttons sit in the modal
// footer; clicking one fires recruiting.action via the store's
// performAction. ESC closes; click-outside closes.

import { useEffect, useRef, useState } from 'react';
import type { recruiting, recruitingIpc } from '@vcd/shared';
import { InterestMeter } from './InterestMeter';
import { PrioritiesReadout } from './PrioritiesReadout';
import { PitchReasonsCard } from './PitchReasonsCard';
import { ScoutTierIndicator } from './ScoutTierIndicator';
import { NilOfferSlider } from './NilOfferSlider';

const NEUTRAL_PRIORITIES: recruiting.RecruitPriorities = {
  playingTime: 5,
  proximityToHome: 5,
  prestige: 5,
  facilities: 5,
  nilDeal: 0,
};

type Tab = 'battle' | 'scouting';

const ACTIONS: Array<{ key: recruitingIpc.RecruitingActionType; label: string; cost: number }> = [
  { key: 'SCOUT', label: 'Scout', cost: 3 },
  { key: 'PHONE_CALL', label: 'Phone Call', cost: 2 },
  { key: 'HOME_VISIT', label: 'Home Visit', cost: 10 },
  { key: 'OFFER_SCHOLARSHIP', label: 'Offer Scholarship', cost: 15 },
  { key: 'CAMP_INVITE', label: 'Camp Invite', cost: 6 },
];

type Props = {
  detail: recruitingIpc.RecruitDetailView | null;
  loading: boolean;
  /** Sprint 37 (post-launch UAT): error message to surface in the modal body. */
  errorMessage?: string | null;
  budgetRemaining: number;
  onAction: (action: recruitingIpc.RecruitingActionType) => void;
  onClose: () => void;
  /** Sprint 37 Task 37.4: NIL slider confirm hook. */
  onSetNilOffer?: (offerCents: number) => void;
};

export function RecruitDetailModal({
  detail,
  loading,
  errorMessage,
  budgetRemaining,
  onAction,
  onClose,
  onSetNilOffer,
}: Props) {
  const [tab, setTab] = useState<Tab>('battle');
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  return (
    <div
      className="recruit-detail-overlay"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="recruit-detail-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="recruit-detail-title"
        data-testid="recruit-detail-modal"
        tabIndex={-1}
      >
        {loading && <p data-testid="recruit-detail-loading">Loading…</p>}
        {!loading && !detail && errorMessage && (
          <div role="alert" data-testid="recruit-detail-error" className="recruit-detail-modal__error">
            <h2>Couldn’t load recruit details</h2>
            <p>{errorMessage}</p>
            <button type="button" onClick={onClose} className="ui-btn">Close</button>
          </div>
        )}
        {!loading && !detail && !errorMessage && (
          <div role="alert" data-testid="recruit-detail-empty" className="recruit-detail-modal__error">
            <h2>No recruit data</h2>
            <p>The recruit returned no data. Try clicking again, or close and re-open.</p>
            <button type="button" onClick={onClose} className="ui-btn">Close</button>
          </div>
        )}
        {!loading && detail && (
          <>
            <header className="recruit-detail-modal__header">
              <h2 id="recruit-detail-title">
                {detail.position} {detail.firstName} {detail.lastName}
                <span className="recruit-detail-modal__stars" aria-label={`${detail.stars} stars`}>
                  {'★'.repeat(detail.stars)}{'☆'.repeat(5 - detail.stars)}
                </span>
              </h2>
              <p className="recruit-detail-modal__sub">
                {detail.height ? `${detail.height} cm` : '— cm'}
                {' · '}
                {detail.hometownCity ?? '—'}, {detail.hometownState ?? '—'}
                {' · '}
                {detail.commitState}
                {' · '}
                Scout level: {detail.scoutLevel}/3
              </p>
              <button
                type="button"
                className="recruit-detail-modal__close"
                aria-label="Close recruit detail"
                data-testid="recruit-detail-close"
                onClick={onClose}
              >
                ×
              </button>
            </header>

            <nav className="recruit-detail-modal__tabs" role="tablist" aria-label="Recruit detail tabs">
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'battle'}
                onClick={() => setTab('battle')}
                className={
                  tab === 'battle'
                    ? 'recruit-detail-modal__tab recruit-detail-modal__tab--active'
                    : 'recruit-detail-modal__tab'
                }
                data-testid="tab-battle"
              >
                Recruiting Battle
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'scouting'}
                onClick={() => setTab('scouting')}
                className={
                  tab === 'scouting'
                    ? 'recruit-detail-modal__tab recruit-detail-modal__tab--active'
                    : 'recruit-detail-modal__tab'
                }
                data-testid="tab-scouting"
              >
                Scouting
              </button>
            </nav>

            <div role="tabpanel" className="recruit-detail-modal__panel">
              {tab === 'battle' && (
                <>
                  <InterestMeter rows={detail.interestMeter ?? []} />
                  <PrioritiesReadout
                    priorities={detail.priorities ?? NEUTRAL_PRIORITIES}
                    wantsToLeaveHome={detail.wantsToLeaveHome ?? false}
                    {...(detail.teamPriorityLevels && { teamLevels: detail.teamPriorityLevels })}
                  />
                  {(detail.pitchReasons?.length ?? 0) > 0 && (
                    <div
                      className="recruit-detail-modal__pitch-row"
                      data-testid="pitch-reasons-row"
                    >
                      {detail.pitchReasons.map((r) => (
                        <PitchReasonsCard key={r.type} reason={r} />
                      ))}
                    </div>
                  )}
                  {onSetNilOffer && (detail.nilBudgetCents ?? 0) > 0 && (
                    <NilOfferSlider
                      recruitStars={detail.stars}
                      priorities={detail.priorities ?? NEUTRAL_PRIORITIES}
                      currentOfferCents={detail.nilOfferCents ?? 0}
                      budgetCents={detail.nilBudgetCents ?? 0}
                      budgetUsedCents={detail.nilBudgetUsedCents ?? 0}
                      onConfirm={onSetNilOffer}
                    />
                  )}
                </>
              )}
              {tab === 'scouting' && (
                <>
                  <ScoutTierIndicator
                    scoutLevel={detail.scoutLevel}
                    budgetRemaining={budgetRemaining}
                  />
                  <ScoutReport rows={detail.scoutReport ?? []} scoutLevel={detail.scoutLevel} />
                </>
              )}
            </div>

            <footer className="recruit-detail-modal__footer">
              <p className="recruit-detail-modal__budget">
                Actions left this week: <strong>{budgetRemaining}</strong>
              </p>
              <div
                className="recruit-detail-modal__actions"
                role="group"
                aria-label="Recruiting actions"
              >
                {ACTIONS.map((a) => {
                  const affordable = budgetRemaining >= a.cost;
                  return (
                    <button
                      key={a.key}
                      type="button"
                      onClick={() => onAction(a.key)}
                      disabled={!affordable}
                      className="recruit-detail-modal__action"
                      data-testid={`action-${a.key}`}
                    >
                      {a.label} ({a.cost})
                    </button>
                  );
                })}
              </div>
            </footer>
          </>
        )}
      </div>
    </div>
  );
}

function ScoutReport({
  rows,
  scoutLevel,
}: {
  rows: recruitingIpc.ScoutReportRow[];
  scoutLevel: number;
}) {
  return (
    <div className="scout-report">
      <p className="scout-report__sub">
        Scout level <strong>{scoutLevel}/3</strong>. Each Scout action reveals more skills.
      </p>
      <table className="scout-report__table">
        <caption className="visually-hidden">Scouting letter grades</caption>
        <thead>
          <tr>
            <th scope="col">Skill</th>
            <th scope="col">Grade</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.skill}>
              <th scope="row">{r.skill}</th>
              <td className={`scout-report__grade scout-report__grade--${r.grade}`}>
                {r.grade}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
