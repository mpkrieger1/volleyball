// Sprint 27 Task 27.5: Standings screen with three tabs.
//
// Lazy-hydrates on mount via `useStandingsStore.loadOverview(slotId)`. The
// IPC handler returns conference standings, RPI top-25, and stat leaders
// in one round-trip; the renderer just slices into the three tabs.

import { useEffect, useState } from 'react';
import { useSaveSlotsStore } from '../store/useSaveSlotsStore';
import { useStandingsStore } from '../store/useStandingsStore';
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
  const [tab, setTab] = useState<Tab>('conference');
  const [statCat, setStatCat] = useState<standingsIpc.StatCategory>('kills');

  useEffect(() => {
    if (openedSlotId && status === 'idle') {
      void loadOverview(openedSlotId);
    }
  }, [openedSlotId, status, loadOverview]);

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
            [...standingsByConf.entries()]
              .sort(([, a], [, b]) => a.name.localeCompare(b.name))
              .map(([confId, bucket]) => (
                <div key={confId} className="standings-view__conf">
                  <h2 className="standings-view__conf-h2">
                    {bucket.name} <span className="standings-view__conf-abbr">{bucket.abbr}</span>
                  </h2>
                  <table>
                    <thead>
                      <tr>
                        <th scope="col">#</th>
                        <th scope="col">Team</th>
                        <th scope="col">Conf</th>
                        <th scope="col">Overall</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bucket.rows.map((r) => (
                        <tr key={r.teamId}>
                          <td>{r.rank}</td>
                          <td>
                            <strong>{r.teamAbbr}</strong>{' '}
                            <span className="standings-view__team-school">{r.teamSchool}</span>
                          </td>
                          <td>
                            {r.confWins}–{r.confLosses}
                          </td>
                          <td>
                            {r.overallWins}–{r.overallLosses}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))
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
                  <th scope="col">#</th>
                  <th scope="col">Team</th>
                  <th scope="col">RPI</th>
                  <th scope="col">W–L</th>
                </tr>
              </thead>
              <tbody>
                {rpiTop25.map((r) => (
                  <tr key={r.teamId}>
                    <td>{r.rank}</td>
                    <td>
                      <strong>{r.teamAbbr}</strong>{' '}
                      <span className="standings-view__team-school">{r.teamSchool}</span>
                    </td>
                    <td>{(r.rpiMilli / 1000).toFixed(3)}</td>
                    <td>
                      {r.wins}–{r.losses}
                    </td>
                  </tr>
                ))}
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
          {(statLeaders[statCat]?.length ?? 0) === 0 ? (
            <p className="save-slots__empty">
              No matches played yet. Leaders will populate as the season
              progresses.
            </p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th scope="col">#</th>
                  <th scope="col">Player</th>
                  <th scope="col">Team</th>
                  <th scope="col">Pos</th>
                  <th scope="col">Total</th>
                  <th scope="col">/set</th>
                </tr>
              </thead>
              <tbody>
                {(statLeaders[statCat] ?? []).map((row) => (
                  <tr key={row.playerId}>
                    <td>{row.rank}</td>
                    <td>{row.playerName}</td>
                    <td>{row.teamAbbr}</td>
                    <td>{row.position}</td>
                    <td>{row.value}</td>
                    <td>{(row.perSetMilli / 1000).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </section>
  );
}
