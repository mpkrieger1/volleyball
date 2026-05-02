// Sprint 21: shared sort / filter / multi-select state for tabular screens
// (RecruitingBoard, PortalView, NilView).
//
// Pure logic (no DOM). Selection supports single click, Ctrl+click toggle,
// and Shift+click range. Sort cycles asc → desc → cleared. Filter is a
// caller-supplied predicate over an opaque `Record<string, unknown>`.

import { useCallback, useMemo, useState } from 'react';

export type SortDir = 'asc' | 'desc';

export type UseTableStateInput<Row> = {
  rows: readonly Row[];
  getId: (row: Row) => string;
  /** Custom comparator. Returns negative if a < b, 0 if equal, positive if a > b. */
  compareFn?: (a: Row, b: Row, key: keyof Row, dir: SortDir) => number;
  /** Filter predicate; called per row. Default: include all. */
  filterPredicate?: (row: Row, filter: Record<string, unknown>) => boolean;
  defaultSort?: { key: keyof Row; dir: SortDir };
};

export type UseTableStateOutput<Row> = {
  visibleRows: Row[];
  sortKey: keyof Row | null;
  sortDir: SortDir;
  /** Click a column header. Cycles asc → desc → cleared. */
  setSort: (key: keyof Row) => void;
  filter: Record<string, unknown>;
  setFilter: (key: string, value: unknown) => void;
  clearFilter: () => void;
  selection: ReadonlySet<string>;
  /** Single-click: replaces selection with this id. */
  selectOnly: (id: string) => void;
  /** Ctrl/Cmd+click: toggle this id in/out of selection. */
  toggleSelected: (id: string) => void;
  /** Shift+click: select range from anchor to id (within visibleRows). */
  selectRange: (anchorId: string, id: string) => void;
  /** Select every visible row. */
  selectAll: () => void;
  clearSelection: () => void;
};

function defaultCompare<Row>(a: Row, b: Row, key: keyof Row, dir: SortDir): number {
  const av = a[key];
  const bv = b[key];
  if (av === bv) return 0;
  if (av == null) return dir === 'asc' ? -1 : 1;
  if (bv == null) return dir === 'asc' ? 1 : -1;
  if (typeof av === 'number' && typeof bv === 'number') {
    return dir === 'asc' ? av - bv : bv - av;
  }
  const aStr = String(av);
  const bStr = String(bv);
  return dir === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
}

export function useTableState<Row>(input: UseTableStateInput<Row>): UseTableStateOutput<Row> {
  const [sortKey, setSortKey] = useState<keyof Row | null>(input.defaultSort?.key ?? null);
  const [sortDir, setSortDir] = useState<SortDir>(input.defaultSort?.dir ?? 'asc');
  const [filter, setFilterState] = useState<Record<string, unknown>>({});
  const [selection, setSelection] = useState<ReadonlySet<string>>(() => new Set<string>());

  const setSort = useCallback(
    (key: keyof Row) => {
      // asc → desc → cleared, then back to asc on next click.
      if (sortKey !== key) {
        setSortKey(key);
        setSortDir('asc');
        return;
      }
      if (sortDir === 'asc') {
        setSortDir('desc');
        return;
      }
      // already desc → clear
      setSortKey(null);
      setSortDir('asc');
    },
    [sortKey, sortDir],
  );

  const setFilter = useCallback((key: string, value: unknown) => {
    setFilterState((prev) => ({ ...prev, [key]: value }));
  }, []);
  const clearFilter = useCallback(() => setFilterState({}), []);

  const selectOnly = useCallback((id: string) => setSelection(new Set([id])), []);
  const toggleSelected = useCallback((id: string) => {
    setSelection((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  const clearSelection = useCallback(() => setSelection(new Set<string>()), []);

  const visibleRows = useMemo(() => {
    let result = input.filterPredicate
      ? input.rows.filter((r) => input.filterPredicate!(r, filter))
      : [...input.rows];
    if (sortKey !== null) {
      const cmp = input.compareFn ?? defaultCompare;
      result = [...result].sort((a, b) => cmp(a, b, sortKey, sortDir));
    }
    return result;
  }, [input, filter, sortKey, sortDir]);

  const selectRange = useCallback(
    (anchorId: string, id: string) => {
      const ids = visibleRows.map(input.getId);
      const ai = ids.indexOf(anchorId);
      const bi = ids.indexOf(id);
      if (ai < 0 || bi < 0) {
        toggleSelected(id);
        return;
      }
      const [lo, hi] = ai <= bi ? [ai, bi] : [bi, ai];
      const range = ids.slice(lo, hi + 1);
      setSelection((prev) => {
        const next = new Set(prev);
        for (const r of range) next.add(r);
        return next;
      });
    },
    [visibleRows, input.getId, toggleSelected],
  );

  const selectAll = useCallback(() => {
    setSelection(new Set(visibleRows.map(input.getId)));
  }, [visibleRows, input.getId]);

  return {
    visibleRows,
    sortKey,
    sortDir,
    setSort,
    filter,
    setFilter,
    clearFilter,
    selection,
    selectOnly,
    toggleSelected,
    selectRange,
    selectAll,
    clearSelection,
  };
}
