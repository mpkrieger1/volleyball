import { useEffect, useState, type KeyboardEvent } from 'react';
import { useSaveSlotsStore } from '../store/useSaveSlotsStore';
import { useNilStore, type NilRow } from '../store/useNilStore';
import { useUserTeamStore } from '../store/useUserTeamStore';
import { useTableState } from '../hooks/useTableState';

/**
 * Sprint 21: NIL allocator reads Season.userTeamId via useUserTeamStore.
 * Falls back to teams[0] for legacy saves where userTeamId is null.
 */
export function NilView() {
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
  return <NilViewInner teamId={teamId} />;
}

function NilViewInner({ teamId }: { teamId: string }) {
  const openedSlotId = useSaveSlotsStore((s) => s.openedSlotId);
  const {
    collectiveBudget,
    totalSpent,
    remaining,
    roster,
    phase,
    isOpen,
    status,
    error,
    load,
    assign,
    revoke,
    autoDistribute,
  } = useNilStore();
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const tbl = useTableState<NilRow>({ rows: roster, getId: (r) => r.playerId });
  const [anchorId, setAnchorId] = useState<string | null>(null);
  const visible = tbl.visibleRows;

  useEffect(() => {
    if (openedSlotId) void load(openedSlotId, teamId);
  }, [openedSlotId, teamId, load]);

  const sortHeader = (label: string, key: keyof NilRow & string) => {
    const isActive = tbl.sortKey === key;
    const ariaSort = !isActive ? 'none' : tbl.sortDir === 'asc' ? 'ascending' : 'descending';
    return (
      <th scope="col" aria-sort={ariaSort}>
        <button type="button" className="nil-view__sort-btn" onClick={() => tbl.setSort(key)}>
          {label}{isActive ? (tbl.sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
        </button>
      </th>
    );
  };

  if (!openedSlotId) return null;

  // Sprint 28: NIL operates in whole dollars only — round any cents
  // remainder away at display time. (Underlying storage stays in cents
  // per CLAUDE.md money convention; this is a UI-only round.)
  const fmt = (cents: number) =>
    `$${Math.round(cents / 100).toLocaleString()}`;

  return (
    <section aria-labelledby="nil-heading" className="nil-view">
      <header className="match-hub__header">
        <h1 id="nil-heading">NIL Collective</h1>
        <p className="match-hub__sub">
          Budget: {fmt(collectiveBudget)} · Spent: {fmt(totalSpent)} · Remaining:{' '}
          {fmt(remaining)}
        </p>
      </header>

      {!isOpen && (
        <section
          className="nil-view__closed"
          role="status"
          data-testid="nil-closed"
          aria-labelledby="nil-closed-heading"
        >
          <h2 id="nil-closed-heading">NIL is closed during {phase}</h2>
          <p>
            The NIL window opens at the start of the offseason and stays open
            through preseason. It closes once the regular season begins. Your
            current allocations remain visible below but cannot be edited.
          </p>
        </section>
      )}

      <div className="nil-view__controls" role="group" aria-label="NIL controls">
        <button
          type="button"
          disabled={status === 'working' || !isOpen}
          onClick={() => void autoDistribute(openedSlotId, teamId)}
        >
          Auto-distribute
        </button>
      </div>

      {error && (
        <p role="alert" className="match-hub__error">
          {error}
        </p>
      )}

      {tbl.selection.size > 0 && (
        <div className="nil-view__bulk" role="status">
          {tbl.selection.size} selected
          <button type="button" onClick={() => tbl.clearSelection()}>Clear</button>
        </div>
      )}
      <table className="poll-view__table nil-view__table" aria-label="NIL roster">
        <thead>
          <tr>
            <th scope="col">
              <input
                type="checkbox"
                aria-label="Select all visible players"
                checked={visible.length > 0 && tbl.selection.size === visible.length}
                onChange={(e) => (e.target.checked ? tbl.selectAll() : tbl.clearSelection())}
              />
            </th>
            {sortHeader('Name', 'lastName')}
            <th scope="col">Pos</th>
            <th scope="col">Class</th>
            {sortHeader('Ovr', 'overall')}
            {sortHeader('Value', 'valueCents')}
            {sortHeader('Current NIL', 'currentNilCents')}
            <th scope="col">Assign $</th>
            <th scope="col">Actions</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((r, idx) => {
            const inputVal = inputs[r.playerId] ?? '';
            const isSelected = tbl.selection.has(r.playerId);
            const onSelect = (e: { shiftKey: boolean; ctrlKey: boolean; metaKey: boolean }) => {
              if (e.shiftKey && anchorId) tbl.selectRange(anchorId, r.playerId);
              else if (e.ctrlKey || e.metaKey) tbl.toggleSelected(r.playerId);
              else tbl.selectOnly(r.playerId);
              setAnchorId(r.playerId);
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
                key={r.playerId}
                tabIndex={0}
                aria-selected={isSelected}
                className={isSelected ? 'nil-view__row--selected' : undefined}
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
                <td>{fmt(r.valueCents)}</td>
                <td>{fmt(r.currentNilCents)}</td>
                <td>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    placeholder="$"
                    aria-label={`Assign NIL to ${r.firstName} ${r.lastName}`}
                    value={inputVal}
                    onChange={(e) => {
                      // Sprint 28: whole dollars only — strip any decimal
                      // portion the user types.
                      const digitsOnly = e.target.value.replace(/[^0-9]/g, '');
                      setInputs({ ...inputs, [r.playerId]: digitsOnly });
                    }}
                    style={{ width: '6rem' }}
                  />
                </td>
                <td>
                  <button
                    type="button"
                    disabled={!isOpen || !inputVal || Number(inputVal) < 0}
                    onClick={() =>
                      void assign(
                        openedSlotId,
                        teamId,
                        r.playerId,
                        Math.round(Number(inputVal) * 100),
                      )
                    }
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    disabled={!isOpen || r.currentNilCents === 0}
                    onClick={() => void revoke(openedSlotId, teamId, r.playerId)}
                  >
                    Revoke
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {status === 'loading' && <p>Loading…</p>}
    </section>
  );
}
