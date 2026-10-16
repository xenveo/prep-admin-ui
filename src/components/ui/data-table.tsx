"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Menu, type MenuItem } from "@/components/ui/menu";
import { cn } from "@/lib/cn";

export type Column<T> = {
  id: string;
  header: ReactNode;
  headerTooltip?: string;
  align?: "left" | "right" | "center";
  width?: number | string;
  sortable?: boolean;
  render: (row: T) => ReactNode;
  skeletonWidth?: number;
};
export type SortState = { columnId: string; direction: "asc" | "desc" };
export type DataTableProps<T> = {
  columns: Column<T>[];
  rows: T[];
  rowId: (row: T) => string;
  ariaLabel: string;
  selectable?: boolean;
  selectedIds?: ReadonlySet<string>;
  onSelectionChange?: (ids: Set<string>) => void;
  sort?: SortState;
  onSortChange?: (s: SortState) => void;
  onOpenRow?: (row: T) => void;
  activeRowId?: string | null;
  loading?: boolean;
  emptyState?: ReactNode;
  rowActions?: (row: T) => MenuItem[];
  twoLine?: boolean;
  focusRowIdRef?: React.MutableRefObject<((id: string) => void) | null>;
  rowClassName?: (row: T) => string | undefined;
  className?: string;
};

const SKELETON_ROWS = 5;
const SELECT_W = 20;
const ACTIONS_W = 30;
/** Column gap (gap-4) and the row's horizontal padding (px-4 on each side), in px. */
const COL_GAP = 16;
const ROW_PAD_X = 32;
const DEFAULT_COL_MIN = 140;

/** Smallest width a column track can shrink to: numbers, "Npx" and "minmax(Npx, …)". */
function minTrackWidth(width: Column<unknown>["width"]): number {
  if (typeof width === "number") return width;
  const m = width?.match(/^\s*(?:minmax\(\s*)?(\d+(?:\.\d+)?)px/);
  return m ? Number(m[1]) : DEFAULT_COL_MIN;
}

function headerText<T>(c: Column<T>): string {
  return typeof c.header === "string" ? c.header : c.id;
}

function cellAlign(align: Column<unknown>["align"]) {
  if (align === "right") return "justify-end text-right";
  if (align === "center") return "justify-center text-center";
  return "justify-start";
}

function SortArrow({ sorted }: { sorted: SortState["direction"] | null }) {
  return (
    <span aria-hidden="true" className="text-[10px] leading-none">
      {sorted === "asc" ? "↑" : sorted === "desc" ? "↓" : "↕"}
    </span>
  );
}

export function DataTable<T>({
  columns,
  rows,
  rowId,
  ariaLabel,
  selectable,
  selectedIds,
  onSelectionChange,
  sort,
  onSortChange,
  onOpenRow,
  activeRowId,
  loading,
  emptyState,
  rowActions,
  twoLine,
  focusRowIdRef,
  rowClassName,
  className,
}: DataTableProps<T>) {
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [announce, setAnnounce] = useState("");
  const rowEls = useRef(new Map<string, HTMLDivElement>());

  const ids = useMemo(() => rows.map(rowId), [rows, rowId]);
  const tabbableId =
    activeRowId && ids.includes(activeRowId)
      ? activeRowId
      : focusedId && ids.includes(focusedId)
        ? focusedId
        : (ids[0] ?? null);

  const focusRow = useCallback((id: string) => {
    const el = rowEls.current.get(id);
    if (el) {
      el.focus();
      el.scrollIntoView?.({ block: "nearest" });
    }
  }, []);

  useEffect(() => {
    if (!focusRowIdRef) return;
    focusRowIdRef.current = focusRow;
    return () => {
      focusRowIdRef.current = null;
    };
  }, [focusRowIdRef, focusRow]);

  const selected = selectedIds ?? EMPTY_SET;
  const selectedCount = ids.filter((id) => selected.has(id)).length;
  const headerChecked: boolean | "mixed" =
    ids.length > 0 && selectedCount === ids.length ? true : selectedCount > 0 ? "mixed" : false;

  const toggleAll = (next: boolean) => {
    const out = new Set(selected);
    for (const id of ids) {
      if (next) out.add(id);
      else out.delete(id);
    }
    onSelectionChange?.(out);
  };
  const toggleOne = (id: string, next: boolean) => {
    const out = new Set(selected);
    if (next) out.add(id);
    else out.delete(id);
    onSelectionChange?.(out);
  };

  const sortBy = (c: Column<T>) => {
    const direction: SortState["direction"] =
      sort?.columnId === c.id && sort.direction === "asc" ? "desc" : "asc";
    onSortChange?.({ columnId: c.id, direction });
    setAnnounce(
      `Sorted by ${headerText(c)}, ${direction === "asc" ? "ascending" : "descending"}`,
    );
  };

  const moveTo = (index: number, withOpen: boolean) => {
    const i = Math.max(0, Math.min(ids.length - 1, index));
    const id = ids[i];
    if (id === undefined) return;
    focusRow(id);
    if (withOpen && activeRowId) onOpenRow?.(rows[i]);
  };

  const onRowKeyDown = (e: React.KeyboardEvent<HTMLDivElement>, index: number) => {
    if (e.target !== e.currentTarget) return;
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        moveTo(index + 1, true);
        break;
      case "ArrowUp":
        e.preventDefault();
        moveTo(index - 1, true);
        break;
      case "Home":
        e.preventDefault();
        moveTo(0, true);
        break;
      case "End":
        e.preventDefault();
        moveTo(ids.length - 1, true);
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        onOpenRow?.(rows[index]);
        break;
    }
  };

  const template = [
    selectable ? `${SELECT_W}px` : null,
    ...columns.map((c) =>
      typeof c.width === "number"
        ? `${c.width}px`
        : (c.width ?? "minmax(140px, 1fr)"),
    ),
    rowActions ? `${ACTIONS_W}px` : null,
  ]
    .filter(Boolean)
    .join(" ");
  const colCount = columns.length + (selectable ? 1 : 0) + (rowActions ? 1 : 0);
  const minWidth =
    (selectable ? SELECT_W : 0) +
    (rowActions ? ACTIONS_W : 0) +
    columns.reduce((a, c) => a + minTrackWidth(c.width), 0) +
    COL_GAP * Math.max(0, colCount - 1) +
    ROW_PAD_X;
  // Every table uses the design's 64px rows; two-line content fits inside them.
  const rowH = twoLine ? "min-h-16 py-2" : "min-h-16";
  const rowGrid = "grid items-center gap-4 px-4";
  const showEmpty = !loading && rows.length === 0;
  const firstDataCol = columns[0]?.id;

  return (
    <div className={cn("overflow-hidden rounded-panel border border-line bg-surface", className)}>
      <div className="overflow-x-auto">
        <div
          role="grid"
          aria-label={ariaLabel}
          aria-rowcount={rows.length + 1}
          aria-colcount={colCount}
          aria-busy={loading || undefined}
          aria-multiselectable={selectable || undefined}
          style={{ minWidth }}
        >
          <div
            role="row"
            aria-rowindex={1}
            style={{ gridTemplateColumns: template }}
            className={cn(rowGrid, "h-11 border-b border-line text-xs leading-4 font-semibold text-ink-faint")}
          >
            {selectable && (
              <div role="columnheader" className="flex items-center">
                <Checkbox
                  checked={headerChecked}
                  onChange={toggleAll}
                  label="Select all"
                  disabled={ids.length === 0}
                />
              </div>
            )}
            {columns.map((c) => {
              const sorted = sort?.columnId === c.id ? sort.direction : null;
              return (
                <div
                  key={c.id}
                  role="columnheader"
                  aria-sort={
                    c.sortable
                      ? sorted === "asc"
                        ? "ascending"
                        : sorted === "desc"
                          ? "descending"
                          : "none"
                      : undefined
                  }
                  className={cn("flex min-w-0 items-center", cellAlign(c.align))}
                >
                  {c.sortable ? (
                    <button
                      type="button"
                      title={c.headerTooltip}
                      onClick={() => sortBy(c)}
                      className={cn(
                        "inline-flex min-w-0 cursor-pointer items-center gap-1 rounded-sm border-0 bg-transparent p-0 text-xs leading-4 font-semibold whitespace-nowrap hover:text-ink",
                        sorted ? "text-ink" : "text-inherit",
                      )}
                    >
                      {c.header}
                      <SortArrow sorted={sorted} />
                    </button>
                  ) : (
                    <span title={c.headerTooltip} className="truncate">
                      {c.header}
                    </span>
                  )}
                </div>
              );
            })}
            {rowActions && (
              <div role="columnheader">
                <span className="sr-only">Actions</span>
              </div>
            )}
          </div>

          {loading &&
            Array.from({ length: SKELETON_ROWS }, (_, i) => (
              <div
                key={i}
                role="row"
                aria-hidden="true"
                style={{ gridTemplateColumns: template }}
                className={cn(rowGrid, "border-b border-line last:border-b-0", rowH)}
              >
                {selectable && (
                  <div role="gridcell" className="flex items-center">
                    <span className="size-[18px] rounded-[4px] bg-line" />
                  </div>
                )}
                {columns.map((c) => (
                  <div key={c.id} role="gridcell" className={cn("flex min-w-0", cellAlign(c.align))}>
                    <span
                      className="h-3 max-w-full rounded-sm bg-line"
                      style={{ width: c.skeletonWidth ?? 96 }}
                    />
                  </div>
                ))}
                {rowActions && <div role="gridcell" />}
              </div>
            ))}

          {showEmpty && (
            <div role="row" aria-rowindex={2}>
              <div
                role="gridcell"
                aria-colspan={colCount}
                className="sticky left-0 flex w-full items-center justify-center px-6 py-14 text-center"
              >
                {emptyState}
              </div>
            </div>
          )}

          {!loading &&
            rows.map((row, index) => {
              const id = ids[index];
              const isSelected = selected.has(id);
              const isActive = activeRowId === id;
              return (
                <div
                  key={id}
                  role="row"
                  aria-rowindex={index + 2}
                  aria-selected={selectable ? isSelected : undefined}
                  data-row-id={id}
                  data-active={isActive || undefined}
                  ref={(el) => {
                    if (el) rowEls.current.set(id, el);
                    else rowEls.current.delete(id);
                  }}
                  tabIndex={id === tabbableId ? 0 : -1}
                  onFocus={(e) => {
                    if (e.target === e.currentTarget) setFocusedId(id);
                  }}
                  onClick={() => onOpenRow?.(row)}
                  onKeyDown={(e) => onRowKeyDown(e, index)}
                  style={{ gridTemplateColumns: template }}
                  className={cn(
                    "group focus-inset border-b border-line last:border-b-0",
                    rowGrid,
                    rowH,
                    onOpenRow && "cursor-pointer",
                    isSelected ? "bg-primary-tint" : "hover:bg-row-hover",
                    isActive && "shadow-[inset_3px_0_0_var(--primary)]",
                    rowClassName?.(row),
                  )}
                >
                  {selectable && (
                    <div
                      role="gridcell"
                      className="flex items-center"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Checkbox
                        checked={isSelected}
                        onChange={(next) => toggleOne(id, next)}
                        label="Select row"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  )}
                  {columns.map((c) => (
                    <div
                      key={c.id}
                      role="gridcell"
                      className={cn(
                        "flex min-w-0 items-center text-sm leading-5",
                        cellAlign(c.align),
                        isActive && c.id === firstDataCol && "font-semibold",
                      )}
                    >
                      {c.render(row)}
                    </div>
                  ))}
                  {rowActions && (
                    <div
                      role="gridcell"
                      className="flex justify-end"
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    >
                      <Menu label="Row actions" items={rowActions(row)} align="end" />
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      </div>
      <div role="status" aria-live="polite" className="sr-only">
        {announce}
      </div>
    </div>
  );
}

const EMPTY_SET: ReadonlySet<string> = new Set();
