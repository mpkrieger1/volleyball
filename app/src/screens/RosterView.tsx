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

  return (
    <section aria-labelledby="roster-heading" className="roster-view">
      <header className="match-hub__header">
        <h1 id="roster-heading">
          {userTeam ? `${userTeam.schoolName} Roster` : 'Roster'}
        </h1>
        <p className="match-hub__sub">
          {players.length} / {rosterShared.MAX_ROSTER_SIZE} players. Click a row for the full profile.
        </p>
      </header>

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
