import { useEffect, useState } from 'react';
import { useSaveSlotsStore } from '../store/useSaveSlotsStore';
import { useOffseasonStore } from '../store/useOffseasonStore';

/**
 * Sprint 16: offseason + preseason screen. If phase is OFFSEASON, shows
 * "Run Offseason" CTA. If phase is PRESEASON, shows the roster + redshirt
 * toggles + Start Season button.
 *
 * User-team shortcut (Sprint 13+): auto-select first team from listTeams.
 */
export function PreseasonView() {
  const openedSlotId = useSaveSlotsStore((s) => s.openedSlotId);
  const [teamId, setTeamId] = useState<string | null>(null);

  useEffect(() => {
    if (!openedSlotId) return;
    let cancelled = false;
    void (async () => {
      const res = await window.vcd.match.listTeams(openedSlotId);
      if (cancelled || !res.ok) return;
      if (res.teams.length > 0) setTeamId(res.teams[0]!.id);
    })();
    return () => {
      cancelled = true;
    };
  }, [openedSlotId]);

  if (!openedSlotId || !teamId) return null;
  return <PreseasonViewInner teamId={teamId} />;
}

function PreseasonViewInner({ teamId }: { teamId: string }) {
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

  return (
    <section aria-labelledby="preseason-heading" className="preseason-view">
      <header className="match-hub__header">
        <h1 id="preseason-heading">Offseason</h1>
        <p className="match-hub__sub">
          Phase: {phase} · Year: {year}
        </p>
      </header>

      <div className="preseason-view__controls" role="group" aria-label="Offseason controls">
        {phase === 'OFFSEASON' && (
          <button
            type="button"
            disabled={status === 'working'}
            onClick={() => void runOffseason(openedSlotId, teamId)}
          >
            Run Offseason
          </button>
        )}
        {phase === 'PRESEASON' && (
          <button
            type="button"
            disabled={status === 'working'}
            onClick={() => void startRegular(openedSlotId, teamId)}
          >
            Start Season
          </button>
        )}
      </div>

      {error && (
        <p role="alert" className="match-hub__error">
          {error}
        </p>
      )}

      {phase === 'PRESEASON' && roster.length > 0 ? (
        <table className="poll-view__table preseason-view__table">
          <caption>Preseason Roster — toggle redshirts before starting the season</caption>
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Pos</th>
              <th scope="col">Class</th>
              <th scope="col">Ovr</th>
              <th scope="col">Redshirt</th>
            </tr>
          </thead>
          <tbody>
            {roster.map((r) => (
              <tr key={r.playerId}>
                <td>
                  {r.firstName} {r.lastName}
                </td>
                <td>{r.position}</td>
                <td>{r.classYear}</td>
                <td>{r.overall}</td>
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
      ) : phase === 'OFFSEASON' ? (
        <p className="match-hub__sub">Season complete. Run the offseason to advance classes, graduate seniors, and develop returners.</p>
      ) : (
        <p className="match-hub__sub">Not currently in an offseason or preseason phase.</p>
      )}

      {status === 'loading' && <p>Loading…</p>}
    </section>
  );
}
