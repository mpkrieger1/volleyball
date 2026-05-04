import { useEffect } from 'react';
import { useSaveSlotsStore } from '../store/useSaveSlotsStore';
import { useScheduleStore } from '../store/useScheduleStore';
import { useUserTeamStore } from '../store/useUserTeamStore';
import { useMatchHubStore } from '../store/useMatchHubStore';
import { useNavStore } from '../store/useNavStore';
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

  // Sprint 28: clicking a played user-team match routes to the Match Hub
  // with the saved PBP/box-score loaded for replay (huskers.com-style
  // box score view).
  const userTeamId = useUserTeamStore((s) => s.userTeamId);
  const loadMatchForReplay = useMatchHubStore((s) => s.loadMatchForReplay);
  const setScreen = useNavStore((s) => s.setScreen);

  useEffect(() => {
    if (openedSlotId) void loadTeams(openedSlotId);
  }, [openedSlotId, loadTeams]);

  // Sprint 28: auto-select the user's team on open if no selection yet.
  useEffect(() => {
    if (!openedSlotId || !userTeamId) return;
    if (!selectedTeamId) void selectTeam(openedSlotId, userTeamId);
  }, [openedSlotId, userTeamId, selectedTeamId, selectTeam]);

  if (!openedSlotId) return null;

  function openBoxScore(matchId: string): void {
    if (!openedSlotId) return;
    void loadMatchForReplay(openedSlotId, matchId);
    setScreen('match-hub');
  }

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
              <th scope="col" className="t-num">Wk</th>
              <th scope="col">Date</th>
              <th scope="col" className="t-num">H/A</th>
              <th scope="col">Opponent</th>
              <th scope="col" className="t-num">Kind</th>
              <th scope="col">Result</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const isUserTeamSelected = selectedTeamId === userTeamId;
              const isPlayed = r.winnerId !== null;
              const userWon = isPlayed && r.winnerId === selectedTeamId;
              // Sprint 28: defensive — older main-process builds don't
              // return homeSetsWon / awaySetsWon. Fall back to "W"/"L"
              // without scores if the fields are missing.
              const myScoreRaw = r.isHome ? r.homeSetsWon : r.awaySetsWon;
              const oppScoreRaw = r.isHome ? r.awaySetsWon : r.homeSetsWon;
              const haveScores =
                typeof myScoreRaw === 'number' && typeof oppScoreRaw === 'number';
              const result = isPlayed
                ? haveScores
                  ? userWon
                    ? `W ${myScoreRaw}–${oppScoreRaw}`
                    : `L ${myScoreRaw}–${oppScoreRaw}`
                  : userWon
                    ? 'W'
                    : 'L'
                : '—';
              // Sprint 28: tournament rows show their round label (e.g.
              // "CT R1") instead of a raw week number, so the user knows
              // what stage of postseason they're looking at. Regular-
              // season weeks are 0-indexed in the schedule generator
              // (week 0 = first week of play); display +1 so the user
              // sees Week 1..13 to match their mental model.
              const wkDisplay = r.isTournament
                ? (r.tournamentRound ?? '').replace(/_/g, ' ') || 'TRN'
                : `${r.weekIndex + 1}`;
              return (
                <tr key={r.matchId} className={isPlayed ? 'schedule-view__row--played' : undefined}>
                  <td className="t-num">{wkDisplay}</td>
                  <td>{r.isoDate}</td>
                  <td className="t-num">{r.isHome ? 'H' : r.isNeutralSite ? 'N' : 'A'}</td>
                  <td>
                    <strong>{r.opponentAbbr}</strong>{' '}
                    <span className="schedule-view__opp-school">{r.opponentSchool}</span>
                  </td>
                  <td className="t-num">{r.isTournament ? 'TRN' : r.isConference ? 'conf' : 'nc'}</td>
                  <td>
                    {isPlayed && isUserTeamSelected ? (
                      <button
                        type="button"
                        className={`schedule-view__result-btn ${userWon ? 'schedule-view__result-btn--win' : 'schedule-view__result-btn--loss'}`}
                        onClick={() => openBoxScore(r.matchId)}
                        data-testid={`schedule-result-${r.matchId}`}
                        title="View box score"
                      >
                        {result}
                      </button>
                    ) : isPlayed ? (
                      <span
                        className={`schedule-view__result-text ${userWon ? 'schedule-view__result-text--win' : 'schedule-view__result-text--loss'}`}
                      >
                        {result}
                      </span>
                    ) : (
                      <span className="schedule-view__result-pending">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}
