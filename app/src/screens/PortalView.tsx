import { useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import { useSaveSlotsStore } from '../store/useSaveSlotsStore';
import { usePortalStore, type PortalEntry } from '../store/usePortalStore';
import { useUserTeamStore } from '../store/useUserTeamStore';
import { useTableState } from '../hooks/useTableState';
import type { portalIpc } from '@vcd/shared';

const POSITIONS = ['OH', 'MB', 'OPP', 'S', 'L', 'DS'] as const;

/**
 * Sprint 21: reads Season.userTeamId via useUserTeamStore. Falls back to
 * teams[0] for legacy saves where userTeamId is null.
 */
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
  const openedSlotId = useSaveSlotsStore((s) => s.openedSlotId);
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

  if (!openedSlotId) return null;

  const canAct = phase === 'PORTAL' && status !== 'advancing';

  return (
    <section aria-labelledby="portal-heading" className="portal-view">
      <header className="match-hub__header">
        <h1 id="portal-heading">Transfer Portal</h1>
        <p className="match-hub__sub">
          Phase: {phase}
          {phase === 'PORTAL'
            ? ` · Week ${week} · Budget: ${budgetRemaining}`
            : ''}
        </p>
      </header>

      <div className="portal-view__controls" role="group" aria-label="Portal controls">
        {phase !== 'PORTAL' && (
          <button
            type="button"
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
              disabled={!canAct}
              onClick={() => void advance(openedSlotId, teamId)}
            >
              Advance Week
            </button>
            <button
              type="button"
              disabled={!canAct}
              onClick={() => void close(openedSlotId)}
            >
              Close Portal (Signing Day)
            </button>
          </>
        )}
      </div>

      <div role="tablist" aria-label="Portal tabs" className="portal-view__tabs">
        <button
          role="tab"
          type="button"
          aria-selected={tab === 'incoming'}
          onClick={() => setTab('incoming')}
          className={
            tab === 'incoming' ? 'app-nav__btn app-nav__btn--active' : 'app-nav__btn'
          }
        >
          Incoming ({incoming.length})
        </button>
        <button
          role="tab"
          type="button"
          aria-selected={tab === 'outgoing'}
          onClick={() => setTab('outgoing')}
          className={
            tab === 'outgoing' ? 'app-nav__btn app-nav__btn--active' : 'app-nav__btn'
          }
        >
          Outgoing ({outgoing.length})
        </button>
      </div>

      {tab === 'incoming' && (
        <label>
          Position:{' '}
          <select
            aria-label="Filter by position"
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
        </label>
      )}

      {error && (
        <p role="alert" className="match-hub__error">
          {error}
        </p>
      )}

      {tab === 'incoming' ? (
        visibleIncoming.length === 0 ? (
          <p className="match-hub__sub">
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
        )
      ) : outgoing.length === 0 ? (
        <p className="match-hub__sub">None of your players are in the portal.</p>
      ) : (
        <OutgoingTable rows={outgoing} />
      )}

      {status === 'loading' && <p>Loading…</p>}
    </section>
  );
}

function IncomingTable(props: {
  rows: PortalEntry[];
  canAct: boolean;
  onAct: (entry: PortalEntry, action: portalIpc.PortalActionType, nilAmount?: number) => void;
}) {
  const [nilAmounts, setNilAmounts] = useState<Record<string, string>>({});
  const tbl = useTableState<PortalEntry>({ rows: props.rows, getId: (r) => r.transferPortalId });
  const [anchorId, setAnchorId] = useState<string | null>(null);
  const visible = tbl.visibleRows;

  const sortHeader = (label: string, key: keyof PortalEntry & string) => {
    const isActive = tbl.sortKey === key;
    const ariaSort = !isActive ? 'none' : tbl.sortDir === 'asc' ? 'ascending' : 'descending';
    return (
      <th scope="col" aria-sort={ariaSort}>
        <button type="button" className="portal-view__sort-btn" onClick={() => tbl.setSort(key)}>
          {label}{isActive ? (tbl.sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
        </button>
      </th>
    );
  };

  return (
    <>
      {tbl.selection.size > 0 && (
        <div className="portal-view__bulk" role="status">
          {tbl.selection.size} selected
          <button type="button" onClick={() => tbl.clearSelection()}>Clear</button>
        </div>
      )}
      <table className="poll-view__table portal-view__table" aria-label="Incoming portal targets">
      <thead>
        <tr>
          <th scope="col">
            <input
              type="checkbox"
              aria-label="Select all visible portal entries"
              checked={visible.length > 0 && tbl.selection.size === visible.length}
              onChange={(e) => (e.target.checked ? tbl.selectAll() : tbl.clearSelection())}
            />
          </th>
          {sortHeader('Name', 'lastName')}
          <th scope="col">Pos</th>
          <th scope="col">Class</th>
          {sortHeader('Ovr', 'overall')}
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
              className={isSelected ? 'portal-view__row--selected' : undefined}
              onKeyDown={onKey}
            >
              <td>
                <input
                  type="checkbox"
                  aria-label={`Select ${r.firstName} ${r.lastName}`}
                  checked={isSelected}
                  onChange={() => onSelect({ shiftKey: false, ctrlKey: true, metaKey: false })}
                />
              </td>
              <td>
                {r.firstName} {r.lastName}
              </td>
              <td>{r.position}</td>
              <td>{r.classYear}</td>
              <td>{r.overall}</td>
              <td>{r.myInterest}</td>
              <td>{r.lastNilOffer > 0 ? `$${(r.lastNilOffer / 100).toLocaleString()}` : '—'}</td>
              <td>
                <button type="button" disabled={disabled} onClick={() => props.onAct(r, 'CALL')}>
                  Call
                </button>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => props.onAct(r, 'OFFICIAL_VISIT')}
                >
                  Official
                </button>
                <input
                  type="number"
                  min={0}
                  placeholder="NIL $"
                  aria-label={`NIL offer for ${r.firstName} ${r.lastName}`}
                  value={nilVal}
                  onChange={(e) =>
                    setNilAmounts({ ...nilAmounts, [r.transferPortalId]: e.target.value })
                  }
                  style={{ width: '5rem' }}
                  disabled={disabled}
                />
                <button
                  type="button"
                  disabled={disabled || !nilVal || Number(nilVal) <= 0}
                  onClick={() =>
                    props.onAct(r, 'OFFER_NIL', Math.round(Number(nilVal) * 100))
                  }
                >
                  Offer NIL
                </button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
    </>
  );
}

function OutgoingTable(props: { rows: PortalEntry[] }) {
  return (
    <table className="poll-view__table portal-view__table">
      <thead>
        <tr>
          <th scope="col">Name</th>
          <th scope="col">Pos</th>
          <th scope="col">Class</th>
          <th scope="col">Ovr</th>
          <th scope="col">Status</th>
        </tr>
      </thead>
      <tbody>
        {props.rows.map((r) => (
          <tr key={r.transferPortalId}>
            <td>
              {r.firstName} {r.lastName}
            </td>
            <td>{r.position}</td>
            <td>{r.classYear}</td>
            <td>{r.overall}</td>
            <td>{r.status}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
