import { useEffect } from 'react';
import { useSaveSlotsStore } from '../store/useSaveSlotsStore';
import { useScheduleStore } from '../store/useScheduleStore';
import { SeasonPanel } from './SeasonPanel';

export function ScheduleView() {
  const openedSlotId = useSaveSlotsStore((s) => s.openedSlotId);
  const { teams, selectedTeamId, rows, status, error, stats } = useScheduleStore();
  const loadTeams = useScheduleStore((s) => s.loadTeams);
  const selectTeam = useScheduleStore((s) => s.selectTeam);
  const generate = useScheduleStore((s) => s.generate);

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
            : 'Generate a 2026 schedule, then pick a team.'}
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
        <button
          type="button"
          onClick={() => void generate(openedSlotId, `user-${Date.now()}`)}
          disabled={status === 'generating'}
        >
          {status === 'generating' ? 'Generating…' : 'Generate 2026 schedule'}
        </button>
      </div>

      {error && (
        <p role="alert" className="match-hub__error">
          {error}
        </p>
      )}

      {selectedTeamId && rows.length === 0 && status === 'ready' && (
        <p className="save-slots__empty">No matches scheduled. Click the Generate button.</p>
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
