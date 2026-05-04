// Sprint 27 Task 27.5: Standings screen with three tabs.
//
// Lazy-hydrates on mount via `useStandingsStore.loadOverview(slotId)`. The
// IPC handler returns conference standings, RPI top-25, and stat leaders
// in one round-trip; the renderer just slices into the three tabs.

import { useEffect, useMemo, useState } from 'react';
import { useSaveSlotsStore } from '../store/useSaveSlotsStore';
import { useStandingsStore } from '../store/useStandingsStore';
import { useUserTeamStore } from '../store/useUserTeamStore';
import { useScheduleStore } from '../store/useScheduleStore';
import { useSeasonStore } from '../store/useSeasonStore';
import type { standingsIpc } from '@vcd/shared';

type Tab = 'conference' | 'rpi' | 'leaders';

const STAT_CATEGORIES: Array<{ key: standingsIpc.StatCategory; label: string }> = [
  { key: 'kills', label: 'Kills' },
  { key: 'assists', label: 'Assists' },
  { key: 'digs', label: 'Digs' },
  { key: 'blocks', label: 'Blocks' },
  { key: 'aces', label: 'Aces' },
];

export function StandingsView() {
  const openedSlotId = useSaveSlotsStore((s) => s.openedSlotId);
  const conferenceStandings = useStandingsStore((s) => s.conferenceStandings);
  const rpiTop25 = useStandingsStore((s) => s.rpiTop25);
  const statLeaders = useStandingsStore((s) => s.statLeaders);
  const status = useStandingsStore((s) => s.status);
  const error = useStandingsStore((s) => s.error);
  const loadOverview = useStandingsStore((s) => s.loadOverview);
  // Sprint 28: default the Conference tab to the user team's conference.
  const userTeamId = useUserTeamStore((s) => s.userTeamId);
  const teams = useScheduleStore((s) => s.teams);
  const userTeamConferenceId = useMemo(
    () => (userTeamId ? teams.find((t) => t.id === userTeamId)?.conferenceId ?? null : null),
    [userTeamId, teams],
  );

  const [tab, setTab] = useState<Tab>('conference');
  const [statCat, setStatCat] = useState<standingsIpc.StatCategory>('kills');
  const [selectedConfId, setSelectedConfId] = useState<string | null>(null);
  // Sprint 28: stat-leaders scope filter. Defaults to "national"; user can
  // flip to "conference" to see only leaders whose team is in the user's
  // conference. Disabled when the user has no team yet.
  const [leadersScope, setLeadersScope] = useState<'national' | 'conference'>('national');

  // Sprint 28 fix: standings used to load once (status === 'idle' gate)
  // and never refresh, so after advancing weeks the user saw stale 0-0
  // records. Now re-fetch whenever the slot OR the current week changes.
  const seasonWeek = useSeasonStore((s) => s.currentWeek);
  useEffect(() => {
    if (openedSlotId) {
      void loadOverview(openedSlotId);
    }
  }, [openedSlotId, seasonWeek, loadOverview]);

  if (!openedSlotId) return null;

  // Group conference standings by conference for the table render.
  const standingsByConf = new Map<
    string,
    { name: string; abbr: string; rows: standingsIpc.ConferenceStandingRow[] }
  >();
  for (const r of conferenceStandings) {
    let bucket = standingsByConf.get(r.conferenceId);
    if (!bucket) {
      bucket = { name: r.conferenceName, abbr: r.conferenceAbbr, rows: [] };
      standingsByConf.set(r.conferenceId, bucket);
    }
    bucket.rows.push(r);
  }

  // Sprint 28: pick the conference to display. User selection wins; else
  // the user team's conference; else the alphabetically-first conference.
  const sortedConfIds = [...standingsByConf.entries()]
    .sort(([, a], [, b]) => a.name.localeCompare(b.name))
    .map(([id]) => id);
  const activeConfId =
    (selectedConfId && standingsByConf.has(selectedConfId) ? selectedConfId : null) ??
    (userTeamConferenceId && standingsByConf.has(userTeamConferenceId) ? userTeamConferenceId : null) ??
    sortedConfIds[0] ??
    null;
  const activeBucket = activeConfId ? standingsByConf.get(activeConfId) ?? null : null;

  return (
    <section aria-labelledby="standings-heading" className="standings-view">
      <header className="match-hub__header">
        <h1 id="standings-heading">Standings</h1>
        <p className="match-hub__sub">
          Conference records, national RPI, and individual stat leaders.
        </p>
      </header>

      <nav className="standings-view__tabs" role="tablist" aria-label="Standings tabs">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'conference'}
          onClick={() => setTab('conference')}
          data-testid="tab-conference"
        >
          Conference
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'rpi'}
          onClick={() => setTab('rpi')}
          data-testid="tab-rpi"
        >
          RPI Top 25
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'leaders'}
          onClick={() => setTab('leaders')}
          data-testid="tab-leaders"
        >
          Stat Leaders
        </button>
      </nav>

      {error && (
        <p role="alert" className="match-hub__error">
          {error}
        </p>
      )}

      {status === 'loading' && <p>Loading standings…</p>}

      {tab === 'conference' && status === 'ready' && (
        <div className="standings-view__panel" role="tabpanel" data-testid="panel-conference">
          {standingsByConf.size === 0 ? (
            <p className="save-slots__empty">
              No conference matches played yet. Standings populate as the
              regular season progresses.
            </p>
          ) : (
            <>
              <div className="standings-view__conf-picker">
                <label htmlFor="conf-select">Conference</label>
                <select
                  id="conf-select"
                  data-testid="conf-select"
                  value={activeConfId ?? ''}
                  onChange={(e) => setSelectedConfId(e.target.value || null)}
                >
                  {sortedConfIds.map((id) => {
                    const b = standingsByConf.get(id)!;
                    const isUserConf = userTeamConferenceId === id;
                    return (
                      <option key={id} value={id}>
                        {b.name} ({b.abbr}){isUserConf ? ' — your conference' : ''}
                      </option>
                    );
                  })}
                </select>
                {userTeamConferenceId &&
                  standingsByConf.has(userTeamConferenceId) &&
                  activeConfId !== userTeamConferenceId && (
                    <button
                      type="button"
                      className="standings-view__conf-jump"
                      onClick={() => setSelectedConfId(userTeamConferenceId)}
                      data-testid="conf-jump-to-user"
                    >
                      Back to your conference
                    </button>
                  )}
              </div>

              {activeBucket && (
                <div className="standings-view__conf">
                  <h2 className="standings-view__conf-h2">
                    {activeBucket.name}{' '}
                    <span className="standings-view__conf-abbr">{activeBucket.abbr}</span>
                  </h2>
                  <table>
                    <thead>
                      <tr>
                        <th scope="col" className="t-num">#</th>
                        <th scope="col">Team</th>
                        <th scope="col" className="t-num">Conf</th>
                        <th scope="col" className="t-num">Overall</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeBucket.rows.map((r) => {
                        const isUserTeam = userTeamId === r.teamId;
                        return (
                          <tr
                            key={r.teamId}
                            className={isUserTeam ? 'standings-view__user-team-row' : undefined}
                            data-testid={isUserTeam ? 'user-team-row' : undefined}
                          >
                            <td className="t-num">{r.rank}</td>
                            <td>
                              <strong>{r.teamAbbr}</strong>{' '}
                              <span className="standings-view__team-school">{r.teamSchool}</span>
                            </td>
                            <td className="t-num">
                              {r.confWins}–{r.confLosses}
                            </td>
                            <td className="t-num">
                              {r.overallWins}–{r.overallLosses}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {tab === 'rpi' && status === 'ready' && (
        <div className="standings-view__panel" role="tabpanel" data-testid="panel-rpi">
          {rpiTop25.length === 0 ? (
            <p className="save-slots__empty">
              RPI snapshots are captured when the postseason bracket is
              generated. Top-25 will appear after the regular season ends.
            </p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th scope="col" className="t-num">#</th>
                  <th scope="col">Team</th>
                  <th scope="col" className="t-num">RPI</th>
                  <th scope="col" className="t-num">W–L</th>
                </tr>
              </thead>
              <tbody>
                {rpiTop25.map((r) => {
                  const isUserTeam = userTeamId === r.teamId;
                  return (
                    <tr
                      key={r.teamId}
                      className={isUserTeam ? 'standings-view__user-team-row' : undefined}
                    >
                      <td className="t-num">{r.rank}</td>
                      <td>
                        <strong>{r.teamAbbr}</strong>{' '}
                        <span className="standings-view__team-school">{r.teamSchool}</span>
                      </td>
                      <td className="t-num">{(r.rpiMilli / 1000).toFixed(3)}</td>
                      <td className="t-num">
                        {r.wins}–{r.losses}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'leaders' && status === 'ready' && (
        <div className="standings-view__panel" role="tabpanel" data-testid="panel-leaders">
          <div className="standings-view__cat-pickers" role="radiogroup" aria-label="Stat category">
            {STAT_CATEGORIES.map((c) => (
              <button
                key={c.key}
                type="button"
                role="radio"
                aria-checked={statCat === c.key}
                onClick={() => setStatCat(c.key)}
                className={statCat === c.key ? 'standings-view__cat--active' : 'standings-view__cat'}
                data-testid={`cat-${c.key}`}
              >
                {c.label}
              </button>
            ))}
          </div>
          {/* Sprint 28: scope filter — National (default) or Conference (user's). */}
          <div className="standings-view__scope-pickers" role="radiogroup" aria-label="Stat-leaders scope">
            <button
              type="button"
              role="radio"
              aria-checked={leadersScope === 'national'}
              onClick={() => setLeadersScope('national')}
              className={leadersScope === 'national' ? 'standings-view__scope--active' : 'standings-view__scope'}
              data-testid="scope-national"
            >
              National
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={leadersScope === 'conference'}
              onClick={() => setLeadersScope('conference')}
              disabled={!userTeamConferenceId}
              title={userTeamConferenceId ? 'Show only your conference' : 'Set your team to enable this filter'}
              className={leadersScope === 'conference' ? 'standings-view__scope--active' : 'standings-view__scope'}
              data-testid="scope-conference"
            >
              Your conference{userTeamConferenceId
                ? ''
                : ' (no team)'}
            </button>
          </div>
          {(() => {
            const all = statLeaders[statCat] ?? [];
            // Filter by conference scope if requested. Cross-reference the
            // row's teamId against `useScheduleStore.teams` to get its
            // conferenceId — no new IPC needed.
            const teamConfById = new Map(teams.map((t) => [t.id, t.conferenceId]));
            const filtered =
              leadersScope === 'conference' && userTeamConferenceId
                ? all.filter((r) => teamConfById.get(r.teamId) === userTeamConferenceId)
                : all;
            if (filtered.length === 0) {
              return (
                <p className="save-slots__empty">
                  {all.length === 0
                    ? 'No matches played yet. Leaders will populate as the season progresses.'
                    : 'No leaders in your conference for this category yet.'}
                </p>
              );
            }
            return (
              <table>
                <thead>
                  <tr>
                    <th scope="col" className="t-num">#</th>
                    <th scope="col">Player</th>
                    <th scope="col">Team</th>
                    <th scope="col" className="t-num">Pos</th>
                    <th scope="col" className="t-num">Total</th>
                    <th scope="col" className="t-num">/set</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row, idx) => {
                    const isUserTeam = userTeamId === row.teamId;
                    // Re-rank within the filtered set (so a #1-in-conference
                    // shows as #1 not whatever its national rank was).
                    const displayRank = leadersScope === 'conference' ? idx + 1 : row.rank;
                    return (
                      <tr
                        key={row.playerId}
                        className={isUserTeam ? 'standings-view__user-team-row' : undefined}
                      >
                        <td className="t-num">{displayRank}</td>
                        <td>{row.playerName}</td>
                        <td>{row.teamAbbr}</td>
                        <td className="t-num">{row.position}</td>
                        <td className="t-num">{row.value}</td>
                        <td className="t-num">{(row.perSetMilli / 1000).toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            );
          })()}
        </div>
      )}
    </section>
  );
}
