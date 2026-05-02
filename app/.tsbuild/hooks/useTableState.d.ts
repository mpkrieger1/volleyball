export type SortDir = 'asc' | 'desc';
export type UseTableStateInput<Row> = {
    rows: readonly Row[];
    getId: (row: Row) => string;
    /** Custom comparator. Returns negative if a < b, 0 if equal, positive if a > b. */
    compareFn?: (a: Row, b: Row, key: keyof Row, dir: SortDir) => number;
    /** Filter predicate; called per row. Default: include all. */
    filterPredicate?: (row: Row, filter: Record<string, unknown>) => boolean;
    defaultSort?: {
        key: keyof Row;
        dir: SortDir;
    };
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
export declare function useTableState<Row>(input: UseTableStateInput<Row>): UseTableStateOutput<Row>;
//# sourceMappingURL=useTableState.d.ts.map