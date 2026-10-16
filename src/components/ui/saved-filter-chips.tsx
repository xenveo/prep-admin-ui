"use client";

import { cn } from "@/lib/cn";

/** Saved filters rendered as an underlined tab strip (design: Admin Candidates). */
export function SavedFilterChips({
  items,
  activeId,
  activeCount,
  onSelect,
  onSaveCurrent,
}: {
  /** `count`, when known, is shown as a pill on that tab. */
  items: { id: string; label: string; count?: number }[];
  activeId: string | null;
  /** Result count for the active tab, when known; wins over that item's own `count`. */
  activeCount?: number;
  onSelect: (id: string) => void;
  onSaveCurrent?: () => void;
}) {
  return (
    <div role="group" aria-label="Saved filters" className="flex items-center gap-1 overflow-x-auto border-b border-line">
      {items.map((it) => {
        const active = it.id === activeId;
        const count = active && activeCount !== undefined ? activeCount : it.count;
        return (
          <button
            key={it.id}
            type="button"
            aria-pressed={active}
            onClick={() => onSelect(it.id)}
            className={cn(
              "-mb-px flex flex-none cursor-pointer items-center gap-2 border-b-2 bg-transparent px-3 py-2.5 text-sm font-semibold whitespace-nowrap",
              active ? "border-primary text-ink" : "border-transparent text-ink-faint hover:text-ink",
            )}
          >
            {it.label}
            {count !== undefined && (
              <span
                className={cn(
                  "rounded-full px-[7px] py-px text-xs",
                  active ? "bg-primary-soft text-primary-text" : "bg-neutral-soft text-ink-faint",
                )}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
      {onSaveCurrent && (
        <button
          type="button"
          onClick={onSaveCurrent}
          className="ml-auto flex-none cursor-pointer border-0 bg-transparent px-2 py-2.5 text-[13px] font-semibold whitespace-nowrap text-ink-faint hover:text-ink"
        >
          + Save current filters
        </button>
      )}
    </div>
  );
}
