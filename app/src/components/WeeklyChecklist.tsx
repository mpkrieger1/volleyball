// Sprint 28: weekly to-do checklist for the Season Hub.
//
// Derives a list of activities the user should complete this week from
// existing store state (no new IPC). Each item shows a status pill
// (Done / Pending / Optional / N/A) and a CTA button that routes to the
// relevant screen via useNavStore.

import type { ActiveScreen } from '../store/useNavStore';
import type { scheduleIpc } from '@vcd/shared';

export type ChecklistStatus = 'done' | 'pending' | 'optional' | 'na';

export type ChecklistItem = {
  id: string;
  title: string;
  detail: string;
  status: ChecklistStatus;
  /** Where the user goes when they click the CTA. */
  goTo?: ActiveScreen;
  ctaLabel?: string;
};

export type ChecklistInput = {
  phase: string;
  currentWeek: number;
  rows: scheduleIpc.TeamScheduleRow[];
  recruitingPhase: string;
  recruitingBudgetRemaining: number;
};

/**
 * Pure function — easy to unit-test. Returns the activity list for a given
 * week + phase + user-team schedule snapshot.
 */
export function buildChecklist(input: ChecklistInput): ChecklistItem[] {
  const items: ChecklistItem[] = [];
  const matchThisWeek = input.rows.find((r) => r.weekIndex === input.currentWeek);
  const recruitingActive = input.recruitingPhase === 'RECRUITING';

  // 1. Match.
  if (matchThisWeek) {
    const oppLabel = matchThisWeek.isHome
      ? `vs ${matchThisWeek.opponentAbbr}`
      : `at ${matchThisWeek.opponentAbbr}`;
    const tag = matchThisWeek.isTournament
      ? matchThisWeek.tournamentRound ?? 'Tournament'
      : matchThisWeek.isConference
        ? 'Conference'
        : 'Non-conference';
    items.push({
      id: 'match',
      title: 'Play your match',
      detail: `${oppLabel} · ${tag} · ${matchThisWeek.isoDate}`,
      status: matchThisWeek.winnerId ? 'done' : 'pending',
      goTo: 'match-hub',
      ctaLabel: matchThisWeek.winnerId ? 'View replay' : 'Play now',
    });
  } else if (input.phase === 'REGULAR') {
    items.push({
      id: 'match',
      title: 'Bye week',
      detail: 'No match scheduled this week.',
      status: 'na',
    });
  }

  // 2. Recruiting actions.
  if (recruitingActive) {
    const remaining = input.recruitingBudgetRemaining;
    items.push({
      id: 'recruiting',
      title: 'Spend recruiting actions',
      detail:
        remaining > 0
          ? `${remaining} action point${remaining === 1 ? '' : 's'} unspent — pitch, scout, or offer.`
          : 'All weekly recruiting points spent.',
      status: remaining > 0 ? 'pending' : 'done',
      goTo: 'recruiting',
      ctaLabel: remaining > 0 ? 'Open recruiting' : 'Review board',
    });
  }

  // 3. Phase-specific extras.
  switch (input.phase) {
    case 'PRESEASON':
      items.push({
        id: 'preseason-roster',
        title: 'Set redshirts and review roster',
        detail: 'Confirm your starting rotation before Week 1.',
        status: 'optional',
        goTo: 'roster',
        ctaLabel: 'Open roster',
      });
      items.push({
        id: 'preseason-staff',
        title: 'Review coaching staff',
        detail: 'Hire or extend assistants before the season opens.',
        status: 'optional',
        goTo: 'staff',
        ctaLabel: 'Open staff',
      });
      break;
    case 'OFFSEASON':
      items.push({
        id: 'offseason-portal',
        title: 'Work the transfer portal',
        detail: 'Pursue transfers and answer offers from your players.',
        status: 'optional',
        goTo: 'portal',
        ctaLabel: 'Open portal',
      });
      items.push({
        id: 'offseason-nil',
        title: 'Distribute NIL',
        detail: 'Allocate booster funds to keep your roster intact.',
        status: 'optional',
        goTo: 'nil',
        ctaLabel: 'Open NIL',
      });
      break;
    case 'CONF_TOURNEY':
    case 'NCAA':
      items.push({
        id: 'bracket',
        title: 'Track the bracket',
        detail: 'Keep an eye on seeding and your path forward.',
        status: 'optional',
        goTo: 'bracket',
        ctaLabel: 'Open bracket',
      });
      break;
    case 'REGULAR':
      items.push({
        id: 'standings',
        title: 'Check standings',
        detail: 'See where you sit in the conference and AVCA poll.',
        status: 'optional',
        goTo: 'standings',
        ctaLabel: 'Open standings',
      });
      break;
    default:
      break;
  }

  return items;
}

const STATUS_LABELS: Record<ChecklistStatus, string> = {
  done: 'Done',
  pending: 'Pending',
  optional: 'Optional',
  na: 'N/A',
};

type Props = {
  items: ChecklistItem[];
  onNavigate: (screen: ActiveScreen) => void;
};

export function WeeklyChecklist({ items, onNavigate }: Props) {
  const pending = items.filter((i) => i.status === 'pending').length;
  const total = items.filter((i) => i.status === 'pending' || i.status === 'done').length;

  return (
    <section
      aria-labelledby="weekly-checklist-heading"
      className="weekly-checklist"
      data-testid="weekly-checklist"
    >
      <header className="weekly-checklist__header">
        <h2 id="weekly-checklist-heading" className="weekly-checklist__heading">
          This week
        </h2>
        <span className="weekly-checklist__progress" aria-live="polite">
          {pending === 0
            ? total === 0
              ? 'Nothing required'
              : 'All required actions complete — ready to advance.'
            : `${pending} of ${total} required item${total === 1 ? '' : 's'} pending`}
        </span>
      </header>
      <ul className="weekly-checklist__list">
        {items.map((item) => (
          <li
            key={item.id}
            className={`weekly-checklist__item weekly-checklist__item--${item.status}`}
            data-testid={`checklist-item-${item.id}`}
          >
            <div className="weekly-checklist__item-body">
              <div className="weekly-checklist__item-row">
                <span
                  aria-hidden="true"
                  className={`weekly-checklist__icon weekly-checklist__icon--${item.status}`}
                >
                  {item.status === 'done' ? '✓' : item.status === 'pending' ? '○' : '·'}
                </span>
                <strong className="weekly-checklist__item-title">{item.title}</strong>
                <span
                  className={`ui-badge ui-badge--${
                    item.status === 'done'
                      ? 'success'
                      : item.status === 'pending'
                        ? 'accent'
                        : 'muted'
                  }`}
                >
                  {STATUS_LABELS[item.status]}
                </span>
              </div>
              <p className="weekly-checklist__item-detail">{item.detail}</p>
            </div>
            {item.goTo && item.ctaLabel && (
              <button
                type="button"
                className="ui-btn"
                onClick={() => onNavigate(item.goTo!)}
                data-testid={`checklist-cta-${item.id}`}
              >
                {item.ctaLabel}
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
