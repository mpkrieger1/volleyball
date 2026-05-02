import { describe, expect, it } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTableState } from '../../../app/src/hooks/useTableState';

type Row = { id: string; name: string; score: number };
const ROWS: Row[] = [
  { id: 'a', name: 'Alice', score: 5 },
  { id: 'b', name: 'Bob', score: 8 },
  { id: 'c', name: 'Carol', score: 3 },
  { id: 'd', name: 'Dave', score: 11 },
];

const filterByScore = (row: Row, f: Record<string, unknown>): boolean => {
  if (typeof f.minScore === 'number' && row.score < f.minScore) return false;
  return true;
};

describe('useTableState', () => {
  it('returns all rows by default', () => {
    const { result } = renderHook(() =>
      useTableState({ rows: ROWS, getId: (r) => r.id }),
    );
    expect(result.current.visibleRows).toHaveLength(4);
  });

  it('setSort cycles asc → desc → cleared', () => {
    const { result } = renderHook(() =>
      useTableState({ rows: ROWS, getId: (r) => r.id }),
    );
    act(() => result.current.setSort('score'));
    expect(result.current.sortKey).toBe('score');
    expect(result.current.sortDir).toBe('asc');
    expect(result.current.visibleRows.map((r) => r.id)).toEqual(['c', 'a', 'b', 'd']);

    act(() => result.current.setSort('score'));
    expect(result.current.sortDir).toBe('desc');
    expect(result.current.visibleRows.map((r) => r.id)).toEqual(['d', 'b', 'a', 'c']);

    act(() => result.current.setSort('score'));
    expect(result.current.sortKey).toBeNull();
  });

  it('filter narrows visibleRows', () => {
    const { result } = renderHook(() =>
      useTableState({ rows: ROWS, getId: (r) => r.id, filterPredicate: filterByScore }),
    );
    act(() => result.current.setFilter('minScore', 5));
    expect(result.current.visibleRows.map((r) => r.id)).toEqual(['a', 'b', 'd']);
  });

  it('selectOnly replaces selection', () => {
    const { result } = renderHook(() =>
      useTableState({ rows: ROWS, getId: (r) => r.id }),
    );
    act(() => result.current.selectOnly('a'));
    expect(result.current.selection.has('a')).toBe(true);
    act(() => result.current.selectOnly('b'));
    expect(result.current.selection.has('a')).toBe(false);
    expect(result.current.selection.has('b')).toBe(true);
  });

  it('toggleSelected adds and removes', () => {
    const { result } = renderHook(() =>
      useTableState({ rows: ROWS, getId: (r) => r.id }),
    );
    act(() => result.current.toggleSelected('a'));
    act(() => result.current.toggleSelected('b'));
    expect(result.current.selection.size).toBe(2);
    act(() => result.current.toggleSelected('a'));
    expect(result.current.selection.has('a')).toBe(false);
    expect(result.current.selection.has('b')).toBe(true);
  });

  it('selectRange selects everything from anchor to target inclusive', () => {
    const { result } = renderHook(() =>
      useTableState({ rows: ROWS, getId: (r) => r.id }),
    );
    act(() => result.current.selectRange('a', 'c'));
    expect([...result.current.selection].sort()).toEqual(['a', 'b', 'c']);
  });

  it('selectRange works in reverse direction (anchor after target)', () => {
    const { result } = renderHook(() =>
      useTableState({ rows: ROWS, getId: (r) => r.id }),
    );
    act(() => result.current.selectRange('c', 'a'));
    expect([...result.current.selection].sort()).toEqual(['a', 'b', 'c']);
  });

  it('selectAll picks every visible row', () => {
    const { result } = renderHook(() =>
      useTableState({ rows: ROWS, getId: (r) => r.id, filterPredicate: filterByScore }),
    );
    act(() => result.current.setFilter('minScore', 5));
    act(() => result.current.selectAll());
    expect([...result.current.selection].sort()).toEqual(['a', 'b', 'd']);
  });

  it('clearSelection empties selection', () => {
    const { result } = renderHook(() =>
      useTableState({ rows: ROWS, getId: (r) => r.id }),
    );
    act(() => result.current.selectAll());
    act(() => result.current.clearSelection());
    expect(result.current.selection.size).toBe(0);
  });
});
