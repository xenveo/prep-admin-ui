"use client";

import { cn } from "@/lib/cn";

export function SavedFilterChips({
  items,
  activeId,
  onSelect,
  onSaveCurrent,
}: {
  items: { id: string; label: string }[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onSaveCurrent?: () => void;
}) {
  return (
    <div role="group" aria-label="Saved filters" className="flex flex-wrap items-center gap-2">
      <span className="mr-1 text-xs leading-4 text-ink-muted">Saved filters</span>
      {items.map((it) => {
        const active = it.id === activeId;
        return (
          <button
            key={it.id}
            type="button"
            aria-pressed={active}
            onClick={() => onSelect(it.id)}
            className={cn(
              "h-7 cursor-pointer rounded-full border px-3 text-xs font-medium",
              active
                ? "border-primary bg-primary-soft text-primary-text"
                : "border-line bg-surface text-ink",
            )}
          >
            {it.label}
          </button>
        );
      })}
      {onSaveCurrent && (
        <button
          type="button"
          onClick={onSaveCurrent}
          className="h-7 cursor-pointer px-2 text-xs font-medium text-ink-muted"
        >
          + Save current filters
        </button>
      )}
    </div>
  );
}
