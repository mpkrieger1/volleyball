// Sprint 28 Tasks 28.1 + 28.2: Roster screen for the user's team.
//
// Sortable, keyboard-navigable table of the user's players. Click a row
// to open the PlayerProfileModal. Default sort: position then OVR desc.
// Reuses the Sprint 21 useTableState hook.

import { useEffect, useRef, useState } from 'react';
import type { rosterIpc, matchIpc } from '@vcd/shared';
import { roster as rosterShared } from '@vcd/shared';
import { useSaveSlotsStore } from '../store/useSaveSlotsStore';
import { useUserTeamStore } from '../store/useUserTeamStore';
import { useScheduleStore } from '../store/useScheduleStore';
import { useRosterStore } from '../store/useRosterStore';
import { useTableState, type SortDir } from '../hooks/useTableState';
import { PlayerProfileModal } from '../components/PlayerProfileModal';

const POSITION_ORDER: Record<string, number> = {
  S: 0,
  OH: 1,
  MB: 2,
  OPP: 3,
  L: 4,
  DS: 5,
};

function compareRows(
  a: rosterIpc.RosterPlayer,
  b: rosterIpc.RosterPlayer,
  key: keyof rosterIpc.RosterPlayer,
  dir: SortDir,
): number {
  if (key === 'position') {
    const ra = POSITION_ORDER[a.position] ?? 99;
    const rb = POSITION_ORDER[b.position] ?? 99;
    if (ra === rb) return a.lastName.localeCompare(b.lastName);
    return dir === 'asc' ? ra - rb : rb - ra;
  }
  const av = a[key];
  const bv = b[key];
  if (av === bv) return a.lastName.localeCompare(b.lastName);
  if (av == null) return dir === 'asc' ? -1 : 1;
  if (bv == null) return dir === 'asc' ? 1 : -1;
  if (typeof av === 'number' && typeof bv === 'number') {
    return dir === 'asc' ? av - bv : bv - av;
  }
  if (typeof av === 'boolean' && typeof bv === 'boolean') {
    return dir === 'asc' ? Number(av) - Number(bv) : Number(bv) - Number(av);
  }
  const aStr = String(av);
  const bStr = String(bv);
  return dir === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
}

const COLUMNS: Array<{ key: keyof rosterIpc.RosterPlayer; label: string; numeric?: boolean }> = [
  { key: 'jersey', label: '#', numeric: true },
  { key: 'lastName', label: 'Name' },
  { key: 'position', label: 'Pos', numeric: true },
  { key: 'classYear', label: 'Yr', numeric: true },
  { key: 'height', label: 'Ht', numeric: true },
  { key: 'overall', label: 'OVR', numeric: true },
  { key: 'potential', label: 'POT', numeric: true },
  { key: 'redshirtUsed', label: 'Status' },
];

export function RosterView() {
  const openedSlotId = useSaveSlotsStore((s) => s.openedSlotId);
  const userTeamId = useUserTeamStore((s) => s.userTeamId);
  const teams = useScheduleStore((s) => s.teams);
  const {
    players,
    status,
    error,
    load,
    profile,
    profileStatus,
    loadProfile,
    selectPlayer,
    selectedPlayerId,
    mode,
    setMode,
    seasonStats,
    statsStatus,
    loadStats,
  } = useRosterStore();
  const lastTriggerRef = useRef<HTMLTableRowElement | null>(null);
  const [_, force] = useState(0);

  useEffect(() => {
    if (openedSlotId && userTeamId) void load(openedSlotId, userTeamId);
  }, [openedSlotId, userTeamId, load]);

  // Sprint 28: lazy-load season stats the first time the user flips to
  // Stats mode (and on every team change while in Stats mode).
  useEffect(() => {
    if (mode !== 'stats') return;
    if (!openedSlotId || !userTeamId) return;
    if (statsStatus === 'loading' || statsStatus === 'ready') return;
    void loadStats(openedSlotId, userTeamId);
  }, [mode, openedSlotId, userTeamId, statsStatus, loadStats]);

  const userTeam = userTeamId ? teams.find((t) => t.id === userTeamId) : null;

  const tableState = useTableState({
    rows: players,
    getId: (p) => p.id,
    compareFn: compareRows,
    defaultSort: { key: 'position', dir: 'asc' },
  });

  const openProfile = (playerId: string, row: HTMLTableRowElement | null) => {
    lastTriggerRef.current = row;
    selectPlayer(playerId);
    if (openedSlotId) void loadProfile(openedSlotId, playerId);
  };

  const closeProfile = () => {
    selectPlayer(null);
    // Restore focus to the row that opened the modal.
    setTimeout(() => {
      lastTriggerRef.current?.focus();
      force((n) => n + 1);
    }, 0);
  };

  if (!openedSlotId) return null;
  if (!userTeamId) {
    return (
      <section aria-labelledby="roster-heading" className="roster-view">
        <header className="match-hub__header">
          <h1 id="roster-heading">Roster</h1>
          <p className="match-hub__sub">Pick your team from the Hub to see your roster.</p>
        </header>
      </section>
    );
  }

  // Sprint 37 (post-launch UAT): team overall = mean of player overalls.
  // Distinct from prestige (program reputation, not the current roster).
  const teamOverall =
    players.length === 0
      ? null
      : Math.round(
          players.reduce((sum, p) => sum + p.overall, 0) / players.length,
        );

  return (
    <section aria-labelledby="roster-heading" className="roster-view">
      <header className="match-hub__header">
        <h1 id="roster-heading">
          {userTeam ? `${userTeam.schoolName} Roster` : 'Roster'}
        </h1>
        <p className="match-hub__sub">
          {players.length} / {rosterShared.MAX_ROSTER_SIZE} players
          {teamOverall !== null && (
            <>
              {' · '}
              <strong data-testid="roster-team-overall">
                Team OVR {teamOverall}
              </strong>
            </>
          )}
          . Click a row for the full profile.
        </p>
      </header>

      {userTeam && <ProgramInfo prestige={userTeam.prestige} />}

      <nav
        className="recruiting-board__tabs"
        role="tablist"
        aria-label="Roster view mode"
      >
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'ratings'}
          onClick={() => setMode('ratings')}
          className={
            mode === 'ratings'
              ? 'recruiting-board__tab recruiting-board__tab--active'
              : 'recruiting-board__tab'
          }
          data-testid="roster-mode-ratings"
        >
          Ratings
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'stats'}
          onClick={() => setMode('stats')}
          className={
            mode === 'stats'
              ? 'recruiting-board__tab recruiting-board__tab--active'
              : 'recruiting-board__tab'
          }
          data-testid="roster-mode-stats"
        >
          Stats
        </button>
      </nav>

      {error && (
        <p role="alert" className="match-hub__error" data-testid="roster-error">
          {error}
        </p>
      )}

      {status === 'loading' && (
        <p data-testid="roster-loading">Loading roster…</p>
      )}

      {mode === 'stats' && statsStatus === 'loading' && (
        <p data-testid="roster-stats-loading">Loading season stats…</p>
      )}

      {status === 'ready' && players.length === 0 && (
        <p className="save-slots__empty" data-testid="roster-empty">
          No players on this roster yet. If this looks wrong, the save may be
          missing seed data — try creating a fresh save from the Save Slots
          screen.
        </p>
      )}

      {mode === 'stats' && players.length > 0 && (
        <RosterStatsTable
          players={players}
          seasonStats={seasonStats}
          onSelect={openProfile}
        />
      )}

      {mode === 'ratings' && players.length > 0 && (
        <table
          className="roster-view__table"
          data-testid="roster-table"
        >
          <caption className="visually-hidden">Team roster</caption>
          <thead>
            <tr>
              {COLUMNS.map((c) => {
                const ariaSort =
                  tableState.sortKey === c.key
                    ? tableState.sortDir === 'asc'
                      ? 'ascending'
                      : 'descending'
                    : 'none';
                return (
                  <th
                    key={String(c.key)}
                    scope="col"
                    aria-sort={ariaSort}
                    className={c.numeric ? 't-num' : undefined}
                  >
                    <button
                      type="button"
                      className="roster-view__sort-btn"
                      onClick={() => tableState.setSort(c.key)}
                    >
                      {c.label}
                      {tableState.sortKey === c.key
                        ? tableState.sortDir === 'asc'
                          ? ' ▲'
                          : ' ▼'
                        : ''}
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {tableState.visibleRows.map((p) => (
              <tr
                key={p.id}
                tabIndex={0}
                onClick={(e) => openProfile(p.id, e.currentTarget)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openProfile(p.id, e.currentTarget);
                  }
                }}
                data-testid={`roster-row-${p.id}`}
                className="roster-view__row"
              >
                <td className="t-num">{p.jersey}</td>
                <td>
                  <strong>{p.lastName}</strong>
                  <span className="roster-view__first-name">{p.firstName}</span>
                </td>
                <td className="t-num">{p.position}</td>
                <td className="t-num">{p.classYear}</td>
                <td className="t-num">{p.height} cm</td>
                <td className="t-num">{p.overall}</td>
                <td className="t-num">{p.potential}</td>
                <td>
                  {p.isLibero ? (
                    <span className="roster-view__pill roster-view__pill--libero">Libero</span>
                  ) : p.isCaptain ? (
                    <span className="roster-view__pill roster-view__pill--captain">Captain</span>
                  ) : p.redshirtUsed ? (
                    <span className="roster-view__pill roster-view__pill--redshirt">RS used</span>
                  ) : (
                    <span className="roster-view__pill">Healthy</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {selectedPlayerId && (
        <PlayerProfileModal
          profile={profile}
          loading={profileStatus === 'loading'}
          error={profileStatus === 'error' ? error : null}
          onClose={closeProfile}
        />
      )}
    </section>
  );
}

// Sprint 28: stats-mode table. Pivots the roster against the season-totals
// IPC response so the user sees per-player kills/digs/blocks/hitting% etc.
type RosterStatsRowSrc = matchIpc.SeasonAnalyticsResponse extends infer R
  ? R extends { ok: true; players: Array<infer P> }
    ? P
    : never
  : never;

function fmtPct(milli: number): string {
  const sign = milli >= 0 ? '' : '-';
  const abs = Math.abs(milli);
  return `${sign}.${String(Math.round(abs)).padStart(3, '0')}`;
}
function fmtPerSet(milli: number): string {
  return (milli / 1000).toFixed(2);
}

function RosterStatsTable({
  players,
  seasonStats,
  onSelect,
}: {
  players: rosterIpc.RosterPlayer[];
  seasonStats: { players: RosterStatsRowSrc[] } | null;
  onSelect: (playerId: string, row: HTMLTableRowElement | null) => void;
}) {
  const byPlayer = new Map<string, RosterStatsRowSrc>();
  for (const s of seasonStats?.players ?? []) byPlayer.set(s.playerId, s);

  return (
    <div className="ui-table-wrap">
      <table className="ui-table" data-testid="roster-stats-table">
        <caption className="visually-hidden">Player season stats</caption>
        <thead>
          <tr>
            <th scope="col" className="t-num">#</th>
            <th scope="col">Player</th>
            <th scope="col" className="t-num">Pos</th>
            <th scope="col" className="t-num">M</th>
            <th scope="col" className="t-num">Sets</th>
            <th scope="col" className="t-num">K</th>
            <th scope="col" className="t-num">K/S</th>
            <th scope="col" className="t-num">E</th>
            <th scope="col" className="t-num">TA</th>
            <th scope="col" className="t-num">Pct</th>
            <th scope="col" className="t-num">D</th>
            <th scope="col" className="t-num">B</th>
            <th scope="col" className="t-num">A</th>
            <th scope="col" className="t-num">As</th>
          </tr>
        </thead>
        <tbody>
          {players.map((p) => {
            const s = byPlayer.get(p.id);
            return (
              <tr
                key={p.id}
                tabIndex={0}
                onClick={(e) => onSelect(p.id, e.currentTarget)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelect(p.id, e.currentTarget);
                  }
                }}
                data-testid={`roster-stats-row-${p.id}`}
                className="roster-view__row"
              >
                <td className="t-num">{p.jersey}</td>
                <td>
                  <strong>{p.lastName}</strong>
                  <span className="roster-view__first-name"> {p.firstName}</span>
                </td>
                <td className="t-num">{p.position}</td>
                <td className="t-num">{s?.matchesPlayed ?? 0}</td>
                <td className="t-num">{s?.setsPlayed ?? 0}</td>
                <td className="t-num">{s?.kills ?? 0}</td>
                <td className="t-num">{s ? fmtPerSet(s.killsPerSetMilli) : '0.00'}</td>
                <td className="t-num">{s?.errors ?? 0}</td>
                <td className="t-num">{s?.totalAttacks ?? 0}</td>
                <td className="t-num">{s ? fmtPct(s.hittingPctMilli) : '.000'}</td>
                <td className="t-num">{s?.digs ?? 0}</td>
                <td className="t-num">{s?.blocks ?? 0}</td>
                <td className="t-num">{s?.aces ?? 0}</td>
                <td className="t-num">{s?.assists ?? 0}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Program info panel ──────────────────────────────────────────────────
// Shows the team's prestige with a tier label and an expandable
// explainer covering current behavior + planned future factors. Honest
// about what's modeled today vs. what's a v1.x backlog item.

const PRESTIGE_TIER_THRESHOLDS: ReadonlyArray<{ min: number; label: string; pursue: string }> = [
  { min: 70, label: 'Blueblood', pursue: 'recruits 5-stars' },
  { min: 50, label: 'Power program', pursue: 'recruits 4-stars' },
  { min: 30, label: 'Mid-major', pursue: 'recruits 3-stars' },
  { min: 15, label: 'Low-major', pursue: 'recruits 2-stars' },
  { min: 0, label: 'D-I bottom', pursue: 'recruits 1-stars' },
];

function tierFor(prestige: number): { label: string; pursue: string } {
  for (const t of PRESTIGE_TIER_THRESHOLDS) {
    if (prestige >= t.min) return { label: t.label, pursue: t.pursue };
  }
  return { label: 'Unrated', pursue: 'unknown' };
}

function ProgramInfo({ prestige }: { prestige: number }) {
  const [open, setOpen] = useState(false);
  const tier = tierFor(prestige);
  return (
    <section className="program-info" aria-labelledby="program-info-heading">
      <header className="program-info__head">
        <div className="program-info__stat">
          <span className="program-info__label">Prestige</span>
          <strong className="program-info__value">{prestige}</strong>
          <span className="program-info__tier">({tier.label})</span>
        </div>
        <button
          type="button"
          className="program-info__toggle"
          aria-expanded={open}
          aria-controls="program-info-body"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? 'Hide details' : 'How prestige works'}
        </button>
      </header>
      {open && (
        <div id="program-info-body" className="program-info__body">
          <h3 id="program-info-heading">About your program</h3>

          <h4>What prestige does today</h4>
          <p>
            Prestige (0-100) is the dominant factor in how recruits view your
            program. Combined with their star rating it produces base
            interest:{' '}
            <code>prestige × stars</code>. Each star tier expects a minimum
            prestige (5★ = 70, 4★ = 50, 3★ = 30, 2★ = 15) — falling below that
            floor costs 12 interest points per shortfall point.
          </p>
          <p>Examples at <strong>prestige {prestige}</strong> ({tier.label}):</p>
          <ul>
            {([5, 4, 3, 2] as const).map((stars) => {
              const floor = { 5: 70, 4: 50, 3: 30, 2: 15 }[stars];
              const base = prestige * stars;
              const penalty = prestige < floor ? (floor - prestige) * 12 : 0;
              const score = Math.max(0, base - penalty);
              const verdict = score >= 200 ? 'in the race' : score >= 100 ? 'on the bubble' : 'out of reach';
              return (
                <li key={stars}>
                  {stars}-star recruit: base {base}
                  {penalty > 0 && ` − ${penalty} (below ${floor} floor)`}
                  {' '}= <strong>{score}</strong> interest → {verdict}
                </li>
              );
            })}
          </ul>
          <p>
            Prestige also drives <em>operating budget</em> (more prestige =
            larger coach salary cap), <em>booster collective budget</em>{' '}
            (NIL), and the average rating of synthetically-generated lineups
            during fallback paths.
          </p>

          <h4>How prestige changes year-to-year</h4>
          <p>
            <strong>Today, prestige is static.</strong> It&apos;s loaded from the
            real-world program ratings at league seed and never changes for
            the rest of the dynasty. This is a known v1.0 gap.
          </p>
          <p>v1.x is planned to evolve prestige based on:</p>
          <ul>
            <li>NCAA tournament finishes (national title = +3, Final Four = +2, S16 = +1, miss tourney for 3+ years = −1)</li>
            <li>Sustained record (5-year rolling W% above .700 = +1, below .400 = −1)</li>
            <li>Coach reputation (Hall-of-Fame HC retiring = +1; high HC turnover = −1)</li>
            <li>Conference realignment moves (deferred to v2 per PRD)</li>
          </ul>
          <p>
            Until that ships, your prestige is locked at <strong>{prestige}</strong>{' '}
            for the entire dynasty. Use it as a measuring stick for which
            recruits are realistic, not something to optimize for.
          </p>

          <h4>Other school factors (FCCD-style)</h4>
          <p>
            FCCD models several non-prestige factors that influence recruit
            interest: facilities, academics, campus life, atmosphere, scheme
            fit, NIL deal quality. <strong>None of these exist yet in VCD.</strong>{' '}
            They&apos;re called out as &ldquo;deferred — needs new team props&rdquo; in the
            recruiting interest model. v1.x backlog items for when we add
            them:
          </p>
          <ul>
            <li><strong>Facilities</strong> — practice gym + training room rating; recruits weight this for development potential.</li>
            <li><strong>Academics</strong> — graduation rate / academic profile; matters more for top programs.</li>
            <li><strong>Campus life</strong> — student-experience score; soft factor for recruits weighing fit.</li>
            <li><strong>Scheme fit</strong> — your offensive system (5-1 / 6-2) vs. the recruit&apos;s preferred role.</li>
            <li><strong>Atmosphere</strong> — home-attendance rating; part of &ldquo;feel&rdquo; of the program.</li>
            <li><strong>NIL deal quality</strong> — booster collective budget already exists, but isn&apos;t surfaced as a recruit-facing factor yet.</li>
          </ul>
          <p>
            For v1, prestige + region (proximity to recruit&apos;s home state) +
            HC.recruit rating + open scholarships at the recruit&apos;s position
            are the only signals.
          </p>
        </div>
      )}
    </section>
  );
}
