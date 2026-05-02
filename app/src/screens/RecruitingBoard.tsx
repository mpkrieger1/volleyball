import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useSaveSlotsStore } from '../store/useSaveSlotsStore';
import { useRecruitingStore, type BoardRecruit } from '../store/useRecruitingStore';
import { useUserTeamStore } from '../store/useUserTeamStore';
import { useTableState } from '../hooks/useTableState';
import type { recruitingIpc } from '@vcd/shared';

const POSITIONS = ['OH', 'MB', 'OPP', 'S', 'L', 'DS'] as const;
const REGIONS = ['EAST', 'CENTRAL', 'MOUNTAIN', 'PACIFIC'] as const;
const STARS = [1, 2, 3, 4, 5] as const;

const ACTIONS: recruitingIpc.RecruitingActionType[] = [
  'CALL',
  'UNOFFICIAL_VISIT',
  'HOME_VISIT',
  'OFFICIAL_VISIT',
];
const ACTION_LABELS: Record<string, string> = {
  CALL: 'Call',
  UNOFFICIAL_VISIT: 'Unofficial',
  HOME_VISIT: 'Home Visit',
  OFFICIAL_VISIT: 'Official',
};

/**
 * Sprint 21: reads Season.userTeamId via useUserTeamStore. Falls back to
 * teams[0] for legacy saves where userTeamId is null. The Sprint 13
 * shortcut comment has been replaced.
 */
export function RecruitingBoard() {
  const openedSlotId = useSaveSlotsStore((s) => s.openedSlotId);
  const userTeamId = useUserTeamStore((s) => s.userTeamId);
  const userTeamStatus = useUserTeamStore((s) => s.status);
  const [fallbackTeamId, setFallbackTeamId] = useState<string | null>(null);

  // Legacy fallback: load teams[0] only if userTeamStore is ready and the
  // value is null (pre-Sprint-21 saves never wrote userTeamId).
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
  return <RecruitingBoardInner teamId={teamId} />;
}

function RecruitingBoardInner({ teamId }: { teamId: string }) {
  const openedSlotId = useSaveSlotsStore((s) => s.openedSlotId);
  const {
    phase,
    week,
    budgetRemaining,
    recruits,
    status,
    error,
    filter,
    load,
    setFilter,
    openCycle,
    performAction,
    advanceWeek,
    closeCycle,
  } = useRecruitingStore();

  useEffect(() => {
    if (openedSlotId) void load(openedSlotId, teamId);
  }, [openedSlotId, teamId, load]);

  // Sprint 21: filter via the existing recruitingStore filter, then layer
  // sort + multi-select via useTableState.
  const filtered = useMemo(() => {
    return recruits.filter((r) => {
      if (filter.position && r.position !== filter.position) return false;
      if (filter.region && r.hometownRegion !== filter.region) return false;
      if (filter.minStars && r.stars < filter.minStars) return false;
      return true;
    });
  }, [recruits, filter]);

  const tbl = useTableState<BoardRecruit>({
    rows: filtered,
    getId: (r) => r.recruitId,
  });
  const [anchorId, setAnchorId] = useState<string | null>(null);
  const visible = tbl.visibleRows;

  if (!openedSlotId) return null;

  const canAct = phase === 'RECRUITING' && status !== 'advancing';

  return (
    <section aria-labelledby="rec-heading" className="recruiting-board">
      <header className="match-hub__header">
        <h1 id="rec-heading">Recruiting</h1>
        <p className="match-hub__sub">
          Phase: {phase}
          {phase === 'RECRUITING'
            ? ` · Week ${week} · Budget: ${budgetRemaining}`
            : ''}
        </p>
      </header>

      <div className="recruiting-board__controls" role="group" aria-label="Recruiting controls">
        {phase !== 'RECRUITING' && (
          <button
            type="button"
            disabled={status === 'advancing'}
            onClick={() => void openCycle(openedSlotId, 2026)}
          >
            Open Recruiting Cycle
          </button>
        )}
        {phase === 'RECRUITING' && (
          <>
            <button
              type="button"
              disabled={!canAct}
              onClick={() => void advanceWeek(openedSlotId, teamId)}
            >
              Advance Week
            </button>
            <button
              type="button"
              disabled={!canAct}
              onClick={() => void closeCycle(openedSlotId)}
            >
              Close Cycle (Signing Day)
            </button>
          </>
        )}
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
        <label>
          Region:{' '}
          <select
            aria-label="Filter by region"
            value={filter.region ?? ''}
            onChange={(e) => {
              const v = e.target.value;
              const { region: _r, ...rest } = filter;
              setFilter(v ? { ...rest, region: v } : rest);
            }}
          >
            <option value="">All</option>
            {REGIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <label>
          Min stars:{' '}
          <select
            aria-label="Filter by min stars"
            value={filter.minStars ?? 0}
            onChange={(e) => {
              const n = Number(e.target.value);
              const { minStars: _m, ...rest } = filter;
              setFilter(n > 0 ? { ...rest, minStars: n } : rest);
            }}
          >
            <option value="0">Any</option>
            {STARS.map((s) => (
              <option key={s} value={s}>
                {s}+
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

      {recruits.length === 0 ? (
        <p className="match-hub__sub">
          No recruits on board yet. Open a recruiting cycle to begin.
        </p>
      ) : (
        <>
          {tbl.selection.size > 0 && (
            <div className="recruiting-board__bulk" role="status">
              {tbl.selection.size} selected
              <button type="button" onClick={() => tbl.clearSelection()}>
                Clear selection
              </button>
            </div>
          )}
          <table
            className="poll-view__table recruiting-board__table"
            aria-label="Recruiting board"
          >
            <thead>
              <tr>
                <th scope="col">
                  <input
                    type="checkbox"
                    aria-label="Select all visible recruits"
                    checked={visible.length > 0 && tbl.selection.size === visible.length}
                    onChange={(e) =>
                      e.target.checked ? tbl.selectAll() : tbl.clearSelection()
                    }
                  />
                </th>
                <SortHeader label="Name" sortKey="lastName" tbl={tbl} />
                <th scope="col">Pos</th>
                <SortHeader label="Stars" sortKey="stars" tbl={tbl} />
                <SortHeader label="Ht" sortKey="height" tbl={tbl} />
                <th scope="col">Home</th>
                <th scope="col">State</th>
                <SortHeader label="Interest" sortKey="interest" tbl={tbl} />
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r, idx) => (
                <BoardRow
                  key={r.recruitId}
                  recruit={r}
                  canAct={canAct}
                  isSelected={tbl.selection.has(r.recruitId)}
                  rowIndex={idx}
                  rowsCount={visible.length}
                  onSelect={(e) => {
                    if (e.shiftKey && anchorId) tbl.selectRange(anchorId, r.recruitId);
                    else if (e.ctrlKey || e.metaKey) tbl.toggleSelected(r.recruitId);
                    else tbl.selectOnly(r.recruitId);
                    setAnchorId(r.recruitId);
                  }}
                  onAct={(action) =>
                    openedSlotId && void performAction(openedSlotId, teamId, r.recruitId, action)
                  }
                />
              ))}
            </tbody>
          </table>
        </>
      )}

      {status === 'loading' && <p>Loading…</p>}
    </section>
  );
}

function SortHeader<Row>(props: {
  label: string;
  sortKey: keyof Row & string;
  tbl: ReturnType<typeof useTableState<Row>>;
}) {
  const isActive = props.tbl.sortKey === props.sortKey;
  const ariaSort: 'ascending' | 'descending' | 'none' = !isActive
    ? 'none'
    : props.tbl.sortDir === 'asc'
      ? 'ascending'
      : 'descending';
  return (
    <th scope="col" aria-sort={ariaSort}>
      <button
        type="button"
        className="recruiting-board__sort-btn"
        onClick={() => props.tbl.setSort(props.sortKey)}
      >
        {props.label}
        {isActive ? (props.tbl.sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
      </button>
    </th>
  );
}

function BoardRow(props: {
  recruit: BoardRecruit;
  canAct: boolean;
  isSelected: boolean;
  rowIndex: number;
  rowsCount: number;
  onSelect: (e: { shiftKey: boolean; ctrlKey: boolean; metaKey: boolean }) => void;
  onAct: (action: recruitingIpc.RecruitingActionType) => void;
}) {
  const r = props.recruit;
  const disabled = !props.canAct || r.commitState !== 'PENDING';
  const pct = Math.min(100, Math.round((r.interest / 1000) * 100));
  const home = r.hometownCity && r.hometownState ? `${r.hometownCity}, ${r.hometownState}` : '—';
  const ref = useRef<HTMLTableRowElement | null>(null);

  const onKey = (e: KeyboardEvent<HTMLTableRowElement>): void => {
    if (e.key === 'ArrowDown' && props.rowIndex < props.rowsCount - 1) {
      e.preventDefault();
      const next = ref.current?.nextElementSibling as HTMLTableRowElement | null;
      next?.focus();
    } else if (e.key === 'ArrowUp' && props.rowIndex > 0) {
      e.preventDefault();
      const prev = ref.current?.previousElementSibling as HTMLTableRowElement | null;
      prev?.focus();
    } else if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      props.onSelect({ shiftKey: e.shiftKey, ctrlKey: e.ctrlKey, metaKey: e.metaKey });
    }
  };

  return (
    <tr
      ref={ref}
      tabIndex={0}
      aria-selected={props.isSelected}
      className={props.isSelected ? 'recruiting-board__row--selected' : undefined}
      onKeyDown={onKey}
    >
      <td>
        <input
          type="checkbox"
          aria-label={`Select ${r.firstName} ${r.lastName}`}
          checked={props.isSelected}
          onChange={() => props.onSelect({ shiftKey: false, ctrlKey: true, metaKey: false })}
        />
      </td>
      <td>
        {r.firstName} {r.lastName}
      </td>
      <td>{r.position}</td>
      <td>{'★'.repeat(r.stars)}</td>
      <td>{r.height ? `${r.height}cm` : '—'}</td>
      <td>{home}</td>
      <td>{r.commitState}</td>
      <td>
        <div
          role="meter"
          aria-valuenow={r.interest}
          aria-valuemin={0}
          aria-valuemax={1000}
          aria-label={`Interest ${r.interest} of 1000`}
          className="recruiting-board__meter"
        >
          <div className="recruiting-board__meter-fill" style={{ width: `${pct}%` }} />
        </div>
      </td>
      <td>
        {ACTIONS.map((a) => (
          <button
            key={a}
            type="button"
            disabled={disabled}
            onClick={() => props.onAct(a)}
            className="recruiting-board__action"
          >
            {ACTION_LABELS[a]}
          </button>
        ))}
      </td>
    </tr>
  );
}
