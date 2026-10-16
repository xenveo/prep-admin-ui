"use client";

import { cn } from "@/lib/cn";
import { Icon } from "./icon";

export function SavedFilterChips({
  items,
  activeId,
  onSelect,
  onSaveCurrent,
  onRemove,
}: {
  /** `removable` chips get a × button when `onRemove` is set. */
  items: { id: string; label: string; removable?: boolean }[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onSaveCurrent?: () => void;
  onRemove?: (id: string) => void;
}) {
  return (
    <div role="group" aria-label="Saved filters" className="flex flex-wrap items-center gap-2">
      <span className="mr-1 text-xs leading-4 text-ink-muted">Saved filters</span>
      {items.map((it) => {
        const active = it.id === activeId;
        const removable = Boolean(onRemove && it.removable);
        return (
          <span
            key={it.id}
            className={cn(
              "inline-flex h-7 items-center rounded-full border text-xs font-medium",
              active
                ? "border-primary bg-primary-soft text-primary-text"
                : "border-line bg-surface text-ink",
            )}
          >
            <button
              type="button"
              aria-pressed={active}
              onClick={() => onSelect(it.id)}
              className={cn("h-full cursor-pointer rounded-full pl-3", removable ? "pr-1" : "pr-3")}
            >
              {it.label}
            </button>
            {removable && (
              <button
                type="button"
                aria-label={`Delete saved filter ${it.label}`}
                onClick={() => onRemove?.(it.id)}
                className="mr-1 flex size-5 cursor-pointer items-center justify-center rounded-full text-ink-muted hover:bg-row-hover hover:text-ink"
              >
                <Icon name="close" size={14} />
              </button>
            )}
          </span>
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
