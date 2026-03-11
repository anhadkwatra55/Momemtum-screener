"use client";

import React, { useRef, useMemo, useCallback, type CSSProperties } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ChevronUp, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ColumnDef, SortState } from "@/hooks/use-data-table";

// ── Design Tokens ───────────────────────────────────────────────────────────
const ROW_HEIGHT = 52; // px — optimal for touch targets and data density
const OVERSCAN = 8; // extra rows rendered above/below viewport
const BORDER_RADIUS = "1.8rem";

// ── Types ───────────────────────────────────────────────────────────────────

export interface DataTableProps<T> {
  /** Sorted data array to display */
  data: T[];
  /** Column definitions */
  columns: ColumnDef<T>[];
  /** Current sort state */
  sortState: SortState;
  /** Sort handler */
  onSort: (key: string) => void;
  /** Row click handler */
  onRowClick?: (row: T, index: number) => void;
  /** Currently selected row key (matched via getRowKey) */
  selectedKey?: string | null;
  /** Extract a unique key from a row (defaults to index) */
  getRowKey?: (row: T) => string;
  /** Custom cell renderers keyed by column key */
  renderCell?: Partial<Record<string, (row: T, col: ColumnDef<T>) => React.ReactNode>>;
  /** Optional className for the outer wrapper */
  className?: string;
  /** Max height for the scrollable area (default: 80vh) */
  maxHeight?: string;
  /** Estimated row height override */
  rowHeight?: number;
}

// ── Memoized Header Cell ────────────────────────────────────────────────────

interface HeaderCellProps {
  col: { key: string; label: string; shortLabel?: string; sortable?: boolean; width?: string; className?: string };
  sortState: SortState;
  onSort: (key: string) => void;
}

const HeaderCell = React.memo(function HeaderCell({
  col,
  sortState,
  onSort,
}: HeaderCellProps) {
  const isSorted = sortState.key === col.key;
  const handleClick = useCallback(() => onSort(col.key), [onSort, col.key]);

  return (
    <th
      className={cn(
        "py-3.5 px-4 text-left text-xs uppercase tracking-[0.1em] font-semibold",
        "text-white/40 select-none whitespace-nowrap",
        "bg-[rgba(15,23,42,0.85)] backdrop-blur-xl",
        "sticky top-0 z-20",
        "border-b border-white/[0.06]",
        col.sortable && "cursor-pointer hover:text-white/60 transition-colors duration-150",
        col.width,
        col.className,
      )}
      onClick={col.sortable ? handleClick : undefined}
      role={col.sortable ? "button" : undefined}
      aria-sort={
        isSorted
          ? sortState.direction === "asc"
            ? "ascending"
            : "descending"
          : "none"
      }
    >
      <span className="inline-flex items-center gap-1">
        {col.shortLabel || col.label}
        {isSorted && (
          <span className="text-cyan-400">
            {sortState.direction === "asc" ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </span>
        )}
      </span>
    </th>
  );
});

// ── Main Component ──────────────────────────────────────────────────────────

function DataTableInner<T>({
  data,
  columns,
  sortState,
  onSort,
  onRowClick,
  selectedKey,
  getRowKey,
  renderCell,
  className,
  maxHeight = "80vh",
  rowHeight = ROW_HEIGHT,
}: DataTableProps<T>) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowHeight,
    overscan: OVERSCAN,
  });

  const virtualRows = virtualizer.getVirtualItems();
  const totalHeight = virtualizer.getTotalSize();

  // Spacer heights for virtual positioning
  const topPad = virtualRows[0]?.start ?? 0;
  const bottomPad = totalHeight - (virtualRows[virtualRows.length - 1]?.end ?? 0);

  // Stable row click wrapper
  const handleRowClick = useCallback(
    (row: T, index: number) => {
      if (onRowClick) onRowClick(row, index);
    },
    [onRowClick],
  );

  // Outer container style
  const containerStyle = useMemo<CSSProperties>(
    () => ({ borderRadius: BORDER_RADIUS }),
    [],
  );

  // Scroll area style
  const scrollStyle = useMemo<CSSProperties>(
    () => ({ maxHeight }),
    [maxHeight],
  );

  return (
    <div
      className={cn(
        "relative overflow-hidden",
        "bg-white/[0.03] backdrop-blur-xl",
        "border border-white/[0.06]",
        "shadow-[0_4px_24px_-4px_rgba(0,0,0,0.5),0_2px_8px_-2px_rgba(0,0,0,0.3)]",
        className,
      )}
      style={containerStyle}
    >
      {/* Scrollable area */}
      <div
        ref={scrollRef}
        className="overflow-auto"
        style={scrollStyle}
      >
        <table className="w-full text-sm border-collapse min-w-[768px]">
          {/* Sticky header */}
          <thead>
            <tr>
              {columns.map((col) => (
                <HeaderCell
                  key={col.key}
                  col={col}
                  sortState={sortState}
                  onSort={onSort}
                />
              ))}
            </tr>
          </thead>

          {/* Virtualized body */}
          <tbody>
            {/* Top spacer */}
            {topPad > 0 && (
              <tr>
                <td colSpan={columns.length} style={{ height: topPad, padding: 0 }} />
              </tr>
            )}

            {virtualRows.map((vRow) => {
              const row = data[vRow.index];
              const key = getRowKey ? getRowKey(row) : String(vRow.index);
              const isSelected = selectedKey !== undefined && key === selectedKey;

              return (
                <tr
                  key={key}
                  className={cn(
                    "transition-colors duration-150 group",
                    onRowClick && "cursor-pointer",
                    isSelected
                      ? "bg-cyan-500/10 border-l-2 border-l-cyan-400"
                      : "hover:bg-white/[0.03]",
                  )}
                  style={{ height: rowHeight }}
                  onClick={() => handleRowClick(row, vRow.index)}
                >
                  {columns.map((col) => {
                    const customRenderer = renderCell?.[col.key];
                    const rawValue = col.accessor(row);

                    return (
                      <td
                        key={col.key}
                        className={cn(
                          "py-3 px-4 font-mono whitespace-nowrap",
                          col.className,
                        )}
                      >
                        {customRenderer
                          ? customRenderer(row, col)
                          : rawValue !== null && rawValue !== undefined
                            ? String(rawValue)
                            : "—"}
                      </td>
                    );
                  })}
                </tr>
              );
            })}

            {/* Bottom spacer */}
            {bottomPad > 0 && (
              <tr>
                <td colSpan={columns.length} style={{ height: bottomPad, padding: 0 }} />
              </tr>
            )}

            {/* Empty state */}
            {data.length === 0 && (
              <tr>
                <td
                  colSpan={columns.length}
                  className="py-16 text-center text-white/30 text-base"
                >
                  <div className="flex flex-col items-center justify-center gap-3">
                    <svg
                      className="w-12 h-12 text-white/10"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    <p className="font-semibold text-white/40">No data available</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Bottom fade gradient for scroll indication */}
      <div
        className="absolute bottom-0 left-0 right-0 h-12 pointer-events-none
                    bg-gradient-to-t from-[rgba(5,10,18,0.9)] to-transparent z-10"
        style={{ borderRadius: `0 0 ${BORDER_RADIUS} ${BORDER_RADIUS}` }}
      />
    </div>
  );
}

/**
 * High-performance virtualized data table for 500+ rows.
 * Uses @tanstack/react-virtual for DOM-efficient rendering.
 * All business logic is external (via useDataTable hook) — this is a pure presentation component.
 */
export const DataTable = React.memo(DataTableInner) as typeof DataTableInner;
