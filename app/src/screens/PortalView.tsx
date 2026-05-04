// Sprint 28 redesign: Portal screen using ShadCN-style primitives.
//
// Layout:
//   - Header band (phase + week + budget remaining).
//   - Tab bar: Incoming / Outgoing.
//   - Filter row + action row (Open / Advance / Close).
//   - ShadCN-styled table (.ui-table) with sortable headers, focusable rows,
//     and refined inputs/buttons.

import { useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import { useSaveSlotsStore } from '../store/useSaveSlotsStore';
import { usePortalStore, type PortalEntry } from '../store/usePortalStore';
import { useUserTeamStore } from '../store/useUserTeamStore';
import { useTableState } from '../hooks/useTableState';
import type { portalIpc } from '@vcd/shared';

const POSITIONS = ['OH', 'MB', 'OPP', 'S', 'L', 'DS'] as const;

export function PortalView() {
  const openedSlotId = useSaveSlotsStore((s) => s.openedSlotId);
  const userTeamId = useUserTeamStore((s) => s.userTeamId);
  const userTeamStatus = useUserTeamStore((s) => s.status);
  const [fallbackTeamId, setFallbackTeamId] = useState<string | null>(null);

  useEffect(() => {
    if (!openedSlotId) return;
    if (userTeamStatus !== 'ready') return;
    if (userTeamId) return;
    let cancelled = false;
    void (async () => {
      const res = await window.vcd.match.listTeams(openedSlotId);
      if (cancelled || !res.ok) return;
      if (res.teams.length > 0) setFallbackTeamId(res.teams[0]!.id);
    })();
    return () => {
      cancelled = true;
    };
  }, [openedSlotId, userTeamId, userTeamStatus]);

  const teamId = userTeamId ?? fallbackTeamId;
  if (!openedSlotId || !teamId) return null;
  return <PortalViewInner teamId={teamId} />;
}

function PortalViewInner({ teamId }: { teamId: string }) {
  const openedSlotId = useSaveSlotsStore((s) => s.openedSlotId)!;
  const {
    phase,
    week,
    budgetRemaining,
    incoming,
    outgoing,
    status,
    error,
    tab,
    filter,
    load,
    setTab,
    setFilter,
    openPortal,
    performAction,
    advance,
    close,
  } = usePortalStore();

  useEffect(() => {
    if (openedSlotId) void load(openedSlotId, teamId);
  }, [openedSlotId, teamId, load]);

  const visibleIncoming = useMemo(() => {
    return incoming.filter((e) =>
      !filter.position || e.position === filter.position,
    );
  }, [incoming, filter]);

  const canAct = phase === 'PORTAL' && status !== 'advancing';

  return (
    <section aria-labelledby="portal-heading" className="portal-view">
      <header className="match-hub__header">
        <h1 id="portal-heading">Transfer Portal</h1>
        <p className="match-hub__sub">Pursue transfers and answer offers.</p>
      </header>

      <section className="recruiting-header" aria-label="Portal summary">
        <div className="recruiting-header__cap">
          <span className="recruiting-header__cap-label">Phase</span>
          <span className="recruiting-header__cap-value">{phase}</span>
        </div>
        <div className="recruiting-header__cap">
          <span className="recruiting-header__cap-label">Week</span>
          <span className="recruiting-header__cap-value">
            {phase === 'PORTAL' ? week : '—'}
          </span>
        </div>
        <div className="recruiting-header__cap">
          <span className="recruiting-header__cap-label">Actions remaining</span>
          <span className="recruiting-header__cap-value">
            {phase === 'PORTAL' ? budgetRemaining : '—'}
          </span>
        </div>
        <div className="recruiting-header__cap">
          <span className="recruiting-header__cap-label">Incoming</span>
          <span className="recruiting-header__cap-value">{incoming.length}</span>
        </div>
        <div className="recruiting-header__cap">
          <span className="recruiting-header__cap-label">Outgoing</span>
          <span className="recruiting-header__cap-value">{outgoing.length}</span>
        </div>
      </section>

      <nav
        className="recruiting-board__tabs"
        role="tablist"
        aria-label="Portal tabs"
      >
        <button
          role="tab"
          type="button"
          aria-selected={tab === 'incoming'}
          onClick={() => setTab('incoming')}
          className={
            tab === 'incoming'
              ? 'recruiting-board__tab recruiting-board__tab--active'
              : 'recruiting-board__tab'
          }
          data-testid="portal-tab-incoming"
        >
          Incoming ({incoming.length})
        </button>
        <button
          role="tab"
          type="button"
          aria-selected={tab === 'outgoing'}
          onClick={() => setTab('outgoing')}
          className={
            tab === 'outgoing'
              ? 'recruiting-board__tab recruiting-board__tab--active'
              : 'recruiting-board__tab'
          }
          data-testid="portal-tab-outgoing"
        >
          Outgoing ({outgoing.length})
        </button>
      </nav>

      <div className="recruiting-board__toolbar" role="group" aria-label="Portal toolbar">
        <div className="recruiting-board__toolbar-actions">
          {phase !== 'PORTAL' && (
            <button
              type="button"
              className="ui-btn ui-btn--primary"
              disabled={status === 'advancing'}
              onClick={() => void openPortal(openedSlotId)}
            >
              Open Portal
            </button>
          )}
          {phase === 'PORTAL' && (
            <>
              <button
                type="button"
                className="ui-btn ui-btn--primary"
                disabled={!canAct}
                onClick={() => void advance(openedSlotId, teamId)}
              >
                Advance Week
              </button>
              <button
                type="button"
                className="ui-btn"
                disabled={!canAct}
                onClick={() => void close(openedSlotId)}
              >
                Close Portal (Signing Day)
              </button>
            </>
          )}
        </div>

        {tab === 'incoming' && (
          <div className="recruiting-board__toolbar-filters">
            <div className="ui-field">
              <label htmlFor="portal-filter-pos" className="ui-label">Position</label>
              <select
                id="portal-filter-pos"
                className="ui-select"
                value={filter.position ?? ''}
                onChange={(e) => {
                  const v = e.target.value;
                  const { position: _p, ...rest } = filter;
                  setFilter(v ? { ...rest, position: v } : rest);
                }}
              >
                <option value="">All</option>
                {POSITIONS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {error && (
        <p role="alert" className="match-hub__error">
          {error}
        </p>
      )}

      {status === 'loading' && <p data-testid="portal-loading">Loading…</p>}

      {tab === 'incoming' &&
        (visibleIncoming.length === 0 ? (
          <p className="match-hub__sub" data-testid="portal-empty-incoming">
            No incoming portal targets. Open the portal to seed entries.
          </p>
        ) : (
          <IncomingTable
            rows={visibleIncoming}
            canAct={canAct}
            onAct={(entry, action, nilAmount) =>
              void performAction(openedSlotId, teamId, entry.transferPortalId, action, nilAmount)
            }
          />
        ))}

      {tab === 'outgoing' &&
        (outgoing.length === 0 ? (
          <p className="match-hub__sub" data-testid="portal-empty-outgoing">
            None of your players are in the portal.
          </p>
        ) : (
          <OutgoingTable rows={outgoing} />
        ))}
    </section>
  );
}

function IncomingTable(props: {
  rows: PortalEntry[];
  canAct: boolean;
  onAct: (entry: PortalEntry, action: portalIpc.PortalActionType, nilAmount?: number) => void;
}) {
  const [nilAmounts, setNilAmounts] = useState<Record<string, string>>({});
  const tbl = useTableState<PortalEntry>({
    rows: props.rows,
    getId: (r) => r.transferPortalId,
    defaultSort: { key: 'overall', dir: 'desc' },
  });
  const [anchorId, setAnchorId] = useState<string | null>(null);
  const visible = tbl.visibleRows;

  const sortHeader = (label: string, key: keyof PortalEntry & string, numeric = true) => {
    const isActive = tbl.sortKey === key;
    const ariaSort = !isActive ? 'none' : tbl.sortDir === 'asc' ? 'ascending' : 'descending';
    return (
      <th scope="col" aria-sort={ariaSort} className={numeric ? 't-num' : undefined}>
        <button
          type="button"
          className="roster-view__sort-btn"
          onClick={() => tbl.setSort(key)}
        >
          {label}
          {isActive ? (tbl.sortDir === 'asc' ? ' ▲' : ' ▼') : ''}
        </button>
      </th>
    );
  };

  return (
    <>
      {tbl.selection.size > 0 && (
        <div className="recruiting-header" role="status" aria-label="Selection">
          <div className="recruiting-header__cap">
            <span className="recruiting-header__cap-label">Selected</span>
            <span className="recruiting-header__cap-value">{tbl.selection.size}</span>
          </div>
          <button type="button" className="ui-btn" onClick={() => tbl.clearSelection()}>
            Clear
          </button>
        </div>
      )}
      <div className="ui-table-wrap">
        <table
          className="ui-table portal-view__table"
          aria-label="Incoming portal targets"
          data-testid="portal-incoming-table"
        >
          <thead>
            <tr>
              <th scope="col" className="t-num">
                <label className="ui-checkbox" aria-label="Select all visible portal entries">
                  <input
                    type="checkbox"
                    checked={visible.length > 0 && tbl.selection.size === visible.length}
                    onChange={(e) =>
                      e.target.checked ? tbl.selectAll() : tbl.clearSelection()
                    }
                  />
                  <span className="visually-hidden">Select all</span>
                </label>
              </th>
              {sortHeader('Name', 'lastName', false)}
              <th scope="col" className="t-num">Pos</th>
              <th scope="col" className="t-num">Class</th>
              {sortHeader('OVR', 'overall')}
              {sortHeader('Interest', 'myInterest')}
              {sortHeader('NIL', 'lastNilOffer')}
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r, idx) => {
              const disabled = !props.canAct || r.status !== 'ACTIVE';
              const nilVal = nilAmounts[r.transferPortalId] ?? '';
              const isSelected = tbl.selection.has(r.transferPortalId);
              const onSelect = (e: { shiftKey: boolean; ctrlKey: boolean; metaKey: boolean }) => {
                if (e.shiftKey && anchorId) tbl.selectRange(anchorId, r.transferPortalId);
                else if (e.ctrlKey || e.metaKey) tbl.toggleSelected(r.transferPortalId);
                else tbl.selectOnly(r.transferPortalId);
                setAnchorId(r.transferPortalId);
              };
              const onKey = (e: KeyboardEvent<HTMLTableRowElement>): void => {
                if (e.key === 'ArrowDown' && idx < visible.length - 1) {
                  e.preventDefault();
                  const next = e.currentTarget.nextElementSibling as HTMLTableRowElement | null;
                  next?.focus();
                } else if (e.key === 'ArrowUp' && idx > 0) {
                  e.preventDefault();
                  const prev = e.currentTarget.previousElementSibling as HTMLTableRowElement | null;
                  prev?.focus();
                } else if (e.key === ' ') {
                  e.preventDefault();
                  onSelect({ shiftKey: e.shiftKey, ctrlKey: e.ctrlKey, metaKey: e.metaKey });
                }
              };
              return (
                <tr
                  key={r.transferPortalId}
                  tabIndex={0}
                  aria-selected={isSelected}
                  className={
                    isSelected
                      ? 'recruiting-board__row portal-view__row--selected'
                      : 'recruiting-board__row'
                  }
                  onKeyDown={onKey}
                  data-testid={`portal-row-${r.transferPortalId}`}
                >
                  <td className="t-num">
                    <label className="ui-checkbox" aria-label={`Select ${r.firstName} ${r.lastName}`}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() =>
                          onSelect({ shiftKey: false, ctrlKey: true, metaKey: false })
                        }
                      />
                      <span className="visually-hidden">Select</span>
                    </label>
                  </td>
                  <td>
                    <strong>{r.lastName}</strong>
                    <span className="roster-view__first-name"> {r.firstName}</span>
                  </td>
                  <td className="t-num">{r.position}</td>
                  <td className="t-num">{r.classYear}</td>
                  <td className="t-num">{r.overall}</td>
                  <td className="t-num">{r.myInterest}</td>
                  <td className="t-num">
                    {r.lastNilOffer > 0 ? `$${(r.lastNilOffer / 100).toLocaleString()}` : '—'}
                  </td>
                  <td>
                    <div className="portal-view__action-row">
                      <button
                        type="button"
                        className="ui-btn"
                        disabled={disabled}
                        onClick={() => props.onAct(r, 'CALL')}
                      >
                        Call
                      </button>
                      <button
                        type="button"
                        className="ui-btn"
                        disabled={disabled}
                        onClick={() => props.onAct(r, 'OFFICIAL_VISIT')}
                      >
                        Official
                      </button>
                      <input
                        type="number"
                        min={0}
                        placeholder="$ NIL"
                        aria-label={`NIL offer for ${r.firstName} ${r.lastName}`}
                        value={nilVal}
                        onChange={(e) =>
                          setNilAmounts({
                            ...nilAmounts,
                            [r.transferPortalId]: e.target.value,
                          })
                        }
                        className="portal-view__nil-input"
                        disabled={disabled}
                      />
                      <button
                        type="button"
                        className="ui-btn ui-btn--primary"
                        disabled={disabled || !nilVal || Number(nilVal) <= 0}
                        onClick={() =>
                          props.onAct(r, 'OFFER_NIL', Math.round(Number(nilVal) * 100))
                        }
                      >
                        Offer NIL
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function OutgoingTable(props: { rows: PortalEntry[] }) {
  return (
    <div className="ui-table-wrap">
      <table
        className="ui-table portal-view__table"
        aria-label="Outgoing portal entries"
        data-testid="portal-outgoing-table"
      >
        <thead>
          <tr>
            <th scope="col">Name</th>
            <th scope="col" className="t-num">Pos</th>
            <th scope="col" className="t-num">Class</th>
            <th scope="col" className="t-num">OVR</th>
            <th scope="col">Status</th>
          </tr>
        </thead>
        <tbody>
          {props.rows.map((r) => {
            const variant =
              r.status === 'ACTIVE'
                ? 'accent'
                : r.status === 'COMMITTED' || r.status === 'SIGNED'
                  ? 'success'
                  : 'muted';
            return (
              <tr key={r.transferPortalId}>
                <td>
                  <strong>{r.lastName}</strong>
                  <span className="roster-view__first-name"> {r.firstName}</span>
                </td>
                <td className="t-num">{r.position}</td>
                <td className="t-num">{r.classYear}</td>
                <td className="t-num">{r.overall}</td>
                <td>
                  <span className={`ui-badge ui-badge--${variant}`}>{r.status}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
