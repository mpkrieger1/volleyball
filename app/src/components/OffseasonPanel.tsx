// Sprint 28: Offseason / Preseason panel mounted on the Season Hub.
//
// Phase-conditional:
//   - OFFSEASON: "Run Offseason" CTA (advances classes, graduates seniors,
//     develops returners, regenerates the hiring pool, opens NIL window).
//   - PRESEASON: "Start Season" CTA + redshirt-toggle table for the user's
//     active roster.
//   - Other phases: panel is hidden by the Hub (caller controls visibility).
//
// Replaces the standalone Offseason tab (Sprint 28). Reuses the existing
// `useOffseasonStore` so behavior is identical to the prior PreseasonView;
// just lives inside the Hub now.

import { useEffect, useMemo, useState } from 'react';
import { useSaveSlotsStore } from '../store/useSaveSlotsStore';
import { useOffseasonStore } from '../store/useOffseasonStore';
import { useTableState, type SortDir } from '../hooks/useTableState';
import { TrainingFocusPicker } from './TrainingFocusPicker';

type RosterRow = {
  playerId: string;
  firstName: string;
  lastName: string;
  position: string;
  classYear: string;
  overall: number;
  redshirtUsed: boolean;
  redshirtLocked: boolean;
};

type Props = {
  teamId: string;
};

export function OffseasonPanel({ teamId }: Props) {
  const openedSlotId = useSaveSlotsStore((s) => s.openedSlotId);
  const {
    phase,
    year,
    roster,
    status,
    error,
    load,
    toggleRedshirt,
    runOffseason,
    startRegular,
    // Sprint 33: event-aware fields.
    event,
    trainingFocus,
    trainingResults,
    loadEventState,
    setTrainingFocusPick,
    advanceEvent,
    loadTrainingResults,
  } = useOffseasonStore();
  // Last-week-of-offseason gate: when user clicks Start Regular Season
  // with un-decided freshmen, this holds the candidate list and the
  // confirm dialog opens. null = no dialog.
  const [pendingRedshirtConfirm, setPendingRedshirtConfirm] = useState<RosterRow[] | null>(null);

  useEffect(() => {
    if (openedSlotId) void load(openedSlotId, teamId);
  }, [openedSlotId, teamId, load]);

  // Sprint 33: keep the event cursor in sync.
  useEffect(() => {
    if (openedSlotId) void loadEventState(openedSlotId, teamId);
  }, [openedSlotId, teamId, loadEventState]);

  // Sprint 33: when we land on TRAINING_RESULTS, load the per-player
  // gain rows for the current dynasty year.
  useEffect(() => {
    if (openedSlotId && event === 'TRAINING_RESULTS') {
      void loadTrainingResults(openedSlotId, teamId, year);
    }
  }, [openedSlotId, teamId, event, year, loadTrainingResults]);

  if (!openedSlotId) return null;
  if (phase !== 'OFFSEASON' && phase !== 'PRESEASON') return null;

  return (
    <section
      className="offseason-panel"
      aria-labelledby="offseason-panel-heading"
      data-testid="offseason-panel"
    >
      <header className="offseason-panel__header">
        <h2 id="offseason-panel-heading" className="offseason-panel__h2">
          {phase === 'PRESEASON' ? 'Preseason' : 'Offseason'}
        </h2>
        <span className="offseason-panel__year">Year {year}</span>
        <div className="offseason-panel__cta">
          {phase === 'OFFSEASON' && (
            <button
              type="button"
              disabled={status === 'working'}
              onClick={() => void runOffseason(openedSlotId, teamId)}
              className="offseason-panel__primary"
              data-testid="offseason-run"
            >
              Run Offseason
            </button>
          )}
          {phase === 'PRESEASON' && (
            <button
              type="button"
              disabled={status === 'working'}
              onClick={() => {
                // User-driven gate: if there are still freshmen with no
                // explicit redshirt decision (not used, not locked), force
                // a confirmation. The user can skip and proceed, but at
                // least sees the unmade decisions before locking the
                // regular-season roster.
                const pendingFr = (roster as RosterRow[]).filter(
                  (r) => r.classYear === 'FR' && !r.redshirtUsed && !r.redshirtLocked,
                );
                if (pendingFr.length > 0) {
                  setPendingRedshirtConfirm(pendingFr);
                  return;
                }
                void startRegular(openedSlotId, teamId);
              }}
              className="offseason-panel__primary"
              data-testid="offseason-start-regular"
            >
              Start Regular Season
            </button>
          )}
        </div>
      </header>

      {pendingRedshirtConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="redshirt-confirm-heading"
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setPendingRedshirtConfirm(null);
          }}
        >
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3 id="redshirt-confirm-heading">Confirm redshirt decisions</h3>
            <p>
              You have <strong>{pendingRedshirtConfirm.length}</strong> freshman{pendingRedshirtConfirm.length === 1 ? '' : 'men'} without an explicit redshirt decision:
            </p>
            <ul className="offseason-panel__pending-list">
              {pendingRedshirtConfirm.slice(0, 8).map((r) => (
                <li key={r.playerId}>
                  {r.firstName} {r.lastName} — {r.position}, OVR {r.overall}
                </li>
              ))}
              {pendingRedshirtConfirm.length > 8 && (
                <li>…and {pendingRedshirtConfirm.length - 8} more</li>
              )}
            </ul>
            <p className="match-hub__sub">
              Once the regular season starts, redshirts lock when a player takes the floor. You can still change them now or skip and decide as the season unfolds.
            </p>
            <div className="quit-match__options">
              <button
                type="button"
                onClick={() => setPendingRedshirtConfirm(null)}
              >
                <strong>Go back to redshirts</strong>
                <span>Stay on this screen and toggle who redshirts</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setPendingRedshirtConfirm(null);
                  void startRegular(openedSlotId, teamId);
                }}
              >
                <strong>Skip and start the season</strong>
                <span>None of these freshmen will redshirt unless toggled later</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="match-hub__error">
          {error}
        </p>
      )}

      {phase === 'OFFSEASON' && (
        <p className="match-hub__sub">
          Run the offseason to advance classes, graduate seniors, develop
          returners, and refresh the coaching hiring pool.
        </p>
      )}

      {/* Sprint 33: event-aware advance panel. Shows the current event +
          a per-event body. Lives ABOVE the legacy CTAs so the event-driven
          flow is the primary path; runOffseason / startRegular remain as
          fallbacks for legacy callers / debug skip. */}
      {event && event === 'TRAINING_FOCUS' && trainingFocus && (
        <TrainingFocusPicker
          coaches={trainingFocus.coaches}
          isAdvancing={status === 'working'}
          onPick={(coachId, slotIndex, attribute) =>
            void setTrainingFocusPick(openedSlotId, teamId, coachId, slotIndex, attribute)
          }
          onAdvance={() => void advanceEvent(openedSlotId, teamId)}
        />
      )}
      {event && event === 'TRAINING_RESULTS' && (
        <section
          className="offseason-event-panel"
          aria-labelledby="training-results-heading"
          data-testid="training-results-panel"
        >
          <h3 id="training-results-heading" className="offseason-panel__h2">
            Training Results
          </h3>
          {trainingResults.length === 0 ? (
            <p className="match-hub__sub">No training gains recorded yet.</p>
          ) : (
            <ul className="offseason-panel__results-list">
              {trainingResults.slice(0, 30).map((r, i) => (
                <li key={`${r.playerId}-${r.attribute}-${i}`}>
                  {r.playerName} — {r.attribute} +{r.gainApplied}
                  {r.wasBreakthrough ? ' ★ breakthrough' : ''}
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            className="offseason-panel__primary"
            onClick={() => void advanceEvent(openedSlotId, teamId)}
            data-testid="training-results-advance"
          >
            Continue
          </button>
        </section>
      )}
      {event &&
        event !== 'TRAINING_FOCUS' &&
        event !== 'TRAINING_RESULTS' && (
          <section
            className="offseason-event-panel"
            aria-labelledby="event-advance-heading"
            data-testid={`event-panel-${event}`}
          >
            <h3 id="event-advance-heading" className="offseason-panel__h2">
              {humanizeEvent(event)}
            </h3>
            <p className="match-hub__sub">{eventBlurb(event)}</p>
            <button
              type="button"
              className="offseason-panel__primary"
              onClick={() => void advanceEvent(openedSlotId, teamId)}
              data-testid="event-advance"
              disabled={status === 'working'}
            >
              Advance
            </button>
          </section>
        )}

      {phase === 'PRESEASON' && roster.length > 0 && (
        <RedshirtTable
          roster={roster as RosterRow[]}
          onToggle={(playerId, redshirtUsed) =>
            void toggleRedshirt(openedSlotId, teamId, playerId, redshirtUsed)
          }
        />
      )}

      {status === 'loading' && <p>Loading…</p>}
    </section>
  );
}

// Sprint 33: short, plain-English labels for the offseason / preseason
// events. Renders inside the event-aware advance panel.
function humanizeEvent(event: string): string {
  switch (event) {
    case 'YEAR_SUMMARY':
      return 'Season Wrap-Up';
    case 'COACH_LEVELING':
      return 'Coach Leveling';
    case 'COACH_CAROUSEL':
      return 'Coaching Carousel';
    case 'PLAYERS_LEAVING':
      return 'Players Leaving';
    case 'PLAYERS_TRANSFERRING':
      return 'Transfer Portal';
    case 'RECRUITING_1':
      return 'Recruiting — Week 1';
    case 'RECRUITING_2':
      return 'Recruiting — Week 2';
    case 'RECRUITING_3':
      return 'Recruiting — Week 3';
    case 'SIGNING_DAY':
      return 'Signing Day';
    case 'BOOSTER_UPDATES':
      return 'Booster Update';
    case 'ADVANCE_YEAR':
      return 'Advance Year';
    case 'GAMEPLAN':
      return 'Gameplan';
    case 'FINALIZE':
      return 'Finalize';
    default:
      return event;
  }
}

function eventBlurb(event: string): string {
  switch (event) {
    case 'YEAR_SUMMARY':
      return 'Review the season that just ended.';
    case 'COACH_LEVELING':
      return 'Coaches gain experience; some retire or move on.';
    case 'COACH_CAROUSEL':
      return 'Refresh the hiring pool; fill open coach slots league-wide.';
    case 'PLAYERS_LEAVING':
      return 'Seniors graduate; rosters trim to the scholarship cap.';
    case 'PLAYERS_TRANSFERRING':
      return 'Transfer portal opens, then resolves all commits.';
    case 'RECRUITING_1':
      return 'First recruiting week — interest builds across the class.';
    case 'RECRUITING_2':
      return 'Second recruiting week — early commits start landing.';
    case 'RECRUITING_3':
      return 'Third recruiting week — final pushes before signing day.';
    case 'SIGNING_DAY':
      return 'Lock the class. Committed recruits become freshmen.';
    case 'BOOSTER_UPDATES':
      return 'Booster enthusiasm updates from this season’s record.';
    case 'ADVANCE_YEAR':
      return 'Roll the calendar forward; age the roster.';
    case 'GAMEPLAN':
      return 'Set the gameplan for the new season.';
    case 'FINALIZE':
      return 'Wrap preseason; the regular season is ready to start.';
    default:
      return '';
  }
}

// Sortable + filterable redshirt-decision table. Columns click-cycle
// asc → desc → cleared. Position + class filters at top. "Eligible only"
// toggle hides players who can't be redshirted (locked or already used).
function RedshirtTable({
  roster,
  onToggle,
}: {
  roster: RosterRow[];
  onToggle: (playerId: string, redshirtUsed: boolean) => void;
}) {
  const [positionFilter, setPositionFilter] = useState<string>('');
  const [classFilter, setClassFilter] = useState<string>('');
  const [eligibleOnly, setEligibleOnly] = useState(false);

  const filtered = useMemo(() => {
    return roster.filter((r) => {
      if (positionFilter && r.position !== positionFilter) return false;
      if (classFilter && r.classYear !== classFilter) return false;
      if (eligibleOnly && (r.redshirtLocked || r.redshirtUsed)) return false;
      return true;
    });
  }, [roster, positionFilter, classFilter, eligibleOnly]);

  const { visibleRows, sortKey, sortDir, setSort } = useTableState<RosterRow>({
    rows: filtered,
    getId: (r) => r.playerId,
    defaultSort: { key: 'overall', dir: 'desc' },
  });

  const positions = useMemo(
    () => Array.from(new Set(roster.map((r) => r.position))).sort(),
    [roster],
  );
  const classes = useMemo(
    () => Array.from(new Set(roster.map((r) => r.classYear))).sort(),
    [roster],
  );

  const sortIndicator = (key: keyof RosterRow): string => {
    if (sortKey !== key) return '';
    return sortDir === 'asc' ? ' ▲' : ' ▼';
  };
  const ariaSort = (key: keyof RosterRow): SortDir extends never ? never : 'ascending' | 'descending' | 'none' => {
    if (sortKey !== key) return 'none';
    return sortDir === 'asc' ? 'ascending' : 'descending';
  };

  return (
    <>
      <p className="match-hub__sub">
        Toggle redshirts before starting the season. Once a player takes
        the floor, their redshirt status locks for the year.
      </p>
      <div className="offseason-panel__filters" role="group" aria-label="Redshirt table filters">
        <label>
          Pos:
          <select value={positionFilter} onChange={(e) => setPositionFilter(e.target.value)} aria-label="Filter by position">
            <option value="">All</option>
            {positions.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
        <label>
          Class:
          <select value={classFilter} onChange={(e) => setClassFilter(e.target.value)} aria-label="Filter by class year">
            <option value="">All</option>
            {classes.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label>
          <input
            type="checkbox"
            checked={eligibleOnly}
            onChange={(e) => setEligibleOnly(e.target.checked)}
          />
          Eligible only
        </label>
        <span className="offseason-panel__count">
          {visibleRows.length} of {roster.length}
        </span>
      </div>
      <table className="offseason-panel__table">
        <caption className="visually-hidden">
          Preseason roster — redshirt toggles, sortable + filterable
        </caption>
        <thead>
          <tr>
            <th scope="col" aria-sort={ariaSort('lastName')}>
              <button type="button" onClick={() => setSort('lastName')} className="offseason-panel__sort-btn">
                Name{sortIndicator('lastName')}
              </button>
            </th>
            <th scope="col" aria-sort={ariaSort('position')}>
              <button type="button" onClick={() => setSort('position')} className="offseason-panel__sort-btn">
                Pos{sortIndicator('position')}
              </button>
            </th>
            <th scope="col" aria-sort={ariaSort('classYear')}>
              <button type="button" onClick={() => setSort('classYear')} className="offseason-panel__sort-btn">
                Class{sortIndicator('classYear')}
              </button>
            </th>
            <th scope="col" className="t-num" aria-sort={ariaSort('overall')}>
              <button type="button" onClick={() => setSort('overall')} className="offseason-panel__sort-btn">
                Ovr{sortIndicator('overall')}
              </button>
            </th>
            <th scope="col" aria-sort={ariaSort('redshirtUsed')}>
              <button type="button" onClick={() => setSort('redshirtUsed')} className="offseason-panel__sort-btn">
                Redshirt{sortIndicator('redshirtUsed')}
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          {visibleRows.map((r) => (
            <tr key={r.playerId}>
              <td>
                <strong>{r.lastName}</strong>{' '}
                <span className="offseason-panel__first">{r.firstName}</span>
              </td>
              <td>{r.position}</td>
              <td>{r.classYear}</td>
              <td className="t-num">{r.overall}</td>
              <td>
                <input
                  type="checkbox"
                  aria-label={`Redshirt ${r.firstName} ${r.lastName}`}
                  checked={r.redshirtUsed}
                  disabled={r.redshirtLocked}
                  onChange={(e) => onToggle(r.playerId, e.target.checked)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
