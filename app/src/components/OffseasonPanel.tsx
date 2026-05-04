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

import { useEffect } from 'react';
import { useSaveSlotsStore } from '../store/useSaveSlotsStore';
import { useOffseasonStore } from '../store/useOffseasonStore';

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
  } = useOffseasonStore();

  useEffect(() => {
    if (openedSlotId) void load(openedSlotId, teamId);
  }, [openedSlotId, teamId, load]);

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
              onClick={() => void startRegular(openedSlotId, teamId)}
              className="offseason-panel__primary"
              data-testid="offseason-start-regular"
            >
              Start Regular Season
            </button>
          )}
        </div>
      </header>

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

      {phase === 'PRESEASON' && roster.length > 0 && (
        <>
          <p className="match-hub__sub">
            Toggle redshirts before starting the season. Once a player
            takes the floor, their redshirt status locks for the year.
          </p>
          <table className="offseason-panel__table">
            <caption className="visually-hidden">
              Preseason roster — redshirt toggles
            </caption>
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Pos</th>
                <th scope="col">Class</th>
                <th scope="col" className="t-num">Ovr</th>
                <th scope="col">Redshirt</th>
              </tr>
            </thead>
            <tbody>
              {roster.map((r) => (
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
                      onChange={(e) =>
                        void toggleRedshirt(openedSlotId, teamId, r.playerId, e.target.checked)
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {status === 'loading' && <p>Loading…</p>}
    </section>
  );
}
