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
  items: { id: string; label: string }[];
  activeId: string | null;
  /** Result count shown on the active tab, when known. */
  activeCount?: number;
  onSelect: (id: string) => void;
  onSaveCurrent?: () => void;
}) {
  return (
    <div role="group" aria-label="Saved filters" className="flex items-center gap-1 overflow-x-auto border-b border-line">
      {items.map((it) => {
        const active = it.id === activeId;
        return (
          <button
            key={it.id}
            type="button"
            aria-pressed={active}
            onClick={() => onSelect(it.id)}
            className={cn(
              "-mb-px flex flex-none cursor-pointer items-center gap-2 border-b-2 bg-transparent px-3 py-2.5 text-sm font-semibold whitespace-nowrap",
              active ? "border-primary text-ink" : "border-transparent text-ink-muted hover:text-ink",
            )}
          >
            {it.label}
            {active && activeCount !== undefined && (
              <span className="rounded-full bg-primary-soft px-[7px] py-px text-xs text-primary-text">{activeCount}</span>
            )}
          </button>
        );
      })}
      {onSaveCurrent && (
        <button
          type="button"
          onClick={onSaveCurrent}
          className="ml-auto flex-none cursor-pointer px-2 py-2.5 text-xs font-medium whitespace-nowrap text-ink-muted hover:text-ink"
        >
          + Save current filters
        </button>
      )}
    </div>
  );
}
