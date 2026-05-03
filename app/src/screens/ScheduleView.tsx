import { useEffect } from 'react';
import { useSaveSlotsStore } from '../store/useSaveSlotsStore';
import { useScheduleStore } from '../store/useScheduleStore';
import { SeasonPanel } from './SeasonPanel';

export function ScheduleView() {
  const openedSlotId = useSaveSlotsStore((s) => s.openedSlotId);
  const { teams, selectedTeamId, rows, status, error, stats } = useScheduleStore();
  const loadTeams = useScheduleStore((s) => s.loadTeams);
  const selectTeam = useScheduleStore((s) => s.selectTeam);
  // Sprint 27 (Task 27.1): manual schedule generation removed; the schedule
  // auto-generates at offseason→preseason→regular transition. The
  // `useScheduleStore.generate` action remains in the store for tests +
  // back-compat, but is no longer reachable from the UI.

  useEffect(() => {
    if (openedSlotId) void loadTeams(openedSlotId);
  }, [openedSlotId, loadTeams]);

  if (!openedSlotId) return null;

  return (
    <section aria-labelledby="schedule-heading" className="schedule-view">
      <SeasonPanel />
      <header className="match-hub__header">
        <h1 id="schedule-heading">Schedule</h1>
        <p className="match-hub__sub">
          {stats
            ? `${stats.totalMatches} matches · ${stats.confMatches} conf · ${stats.nonConfMatches} non-conf · ${stats.tournamentMatches} tournament`
            : 'Pick a team to view their schedule.'}
        </p>
      </header>

      <div className="schedule-view__controls" role="group" aria-label="Schedule controls">
        <label>
          <span>Team</span>
          <select
            value={selectedTeamId ?? ''}
            onChange={(e) => {
              if (e.target.value) void selectTeam(openedSlotId, e.target.value);
            }}
            aria-label="Select team"
          >
            <option value="">Select team…</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.schoolName} ({t.abbr})
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && (
        <p role="alert" className="match-hub__error">
          {error}
        </p>
      )}

      {selectedTeamId && rows.length === 0 && status === 'ready' && (
        <p className="save-slots__empty">
          No matches scheduled yet — the schedule auto-generates when you
          start the regular season from the Hub.
        </p>
      )}

      {rows.length > 0 && (
        <table className="schedule-view__table">
          <thead>
            <tr>
              <th scope="col">Wk</th>
              <th scope="col">Date</th>
              <th scope="col">H/A</th>
              <th scope="col">Opponent</th>
              <th scope="col">Conf</th>
              <th scope="col">Kind</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.matchId}>
                <td>{r.weekIndex}</td>
                <td>{r.isoDate}</td>
                <td>{r.isHome ? 'H' : r.isNeutralSite ? 'N' : 'A'}</td>
                <td>
                  {r.opponentAbbr} <span style={{ color: 'var(--muted)' }}>{r.opponentSchool}</span>
                </td>
                <td>{r.isConference ? '✓' : ''}</td>
                <td>{r.isTournament ? 'TRN' : r.isConference ? 'conf' : 'nc'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
