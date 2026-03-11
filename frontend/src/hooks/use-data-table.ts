"use client";

import { useState, useCallback, useMemo } from "react";

// ── Column Definition (portable) ────────────────────────────────────────────

export interface ColumnDef<T> {
  /** Unique key for the column, typically a property name of T */
  key: string;
  /** Display label for the column header */
  label: string;
  /** Optional shorter label for compact layouts */
  shortLabel?: string;
  /** Whether this column is sortable */
  sortable?: boolean;
  /** Accessor function to extract the raw value from a row */
  accessor: (row: T) => string | number | null | undefined;
  /** Optional width hint (Tailwind class like "w-[120px]") */
  width?: string;
  /** Optional className applied to both header and cells */
  className?: string;
}

export type SortDirection = "asc" | "desc";

export interface SortState {
  key: string;
  direction: SortDirection;
}

export interface UseDataTableReturn<T> {
  sortedData: T[];
  sortState: SortState;
  handleSort: (key: string) => void;
}

// ── Hook ────────────────────────────────────────────────────────────────────

/**
 * Generic data table logic hook — portable to React Native.
 * Manages sort state and produces sorted data.
 */
export function useDataTable<T>(
  data: T[],
  columns: ColumnDef<T>[],
  initialSortKey: string,
  initialDirection: SortDirection = "desc",
): UseDataTableReturn<T> {
  const [sortState, setSortState] = useState<SortState>({
    key: initialSortKey,
    direction: initialDirection,
  });

  const handleSort = useCallback(
    (key: string) => {
      const col = columns.find((c) => c.key === key);
      if (!col?.sortable) return;

      setSortState((prev) => ({
        key,
        direction: prev.key === key && prev.direction === "desc" ? "asc" : "desc",
      }));
    },
    [columns],
  );

  const sortedData = useMemo(() => {
    const col = columns.find((c) => c.key === sortState.key);
    if (!col) return data;

    const sorted = [...data];
    sorted.sort((a, b) => {
      const valA = col.accessor(a);
      const valB = col.accessor(b);

      const aNull = valA === undefined || valA === null;
      const bNull = valB === undefined || valB === null;
      if (aNull && bNull) return 0;
      if (aNull) return 1;
      if (bNull) return -1;

      let cmp = 0;
      if (typeof valA === "number" && typeof valB === "number") {
        cmp = valA - valB;
      } else {
        cmp = String(valA).localeCompare(String(valB));
      }

      return sortState.direction === "asc" ? cmp : -cmp;
    });

    return sorted;
  }, [data, columns, sortState]);

  return { sortedData, sortState, handleSort };
}
