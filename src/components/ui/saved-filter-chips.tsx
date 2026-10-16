"use client";

import { cn } from "@/lib/cn";
import { Icon } from "./icon";

/** Saved filters rendered as an underlined tab strip (design: Admin Candidates). */
export function SavedFilterChips({
  items,
  activeId,
  activeCount,
  onSelect,
  onSaveCurrent,
  onRemove,
}: {
  /**
   * `count`, when known, is shown as a pill on that tab.
   * `removable` tabs get a × button when `onRemove` is set.
   */
  items: { id: string; label: string; count?: number; removable?: boolean }[];
  activeId: string | null;
  /** Result count for the active tab, when known; wins over that item's own `count`. */
  activeCount?: number;
  onSelect: (id: string) => void;
  onSaveCurrent?: () => void;
  onRemove?: (id: string) => void;
}) {
  return (
    <div role="group" aria-label="Saved filters" className="flex items-center gap-1 overflow-x-auto border-b border-line">
      {items.map((it) => {
        const active = it.id === activeId;
        const count = active && activeCount !== undefined ? activeCount : it.count;
        const removable = Boolean(onRemove && it.removable);
        return (
          <span
            key={it.id}
            className={cn(
              "-mb-px flex flex-none items-center border-b-2 whitespace-nowrap",
              active ? "border-primary text-ink" : "border-transparent text-ink-faint hover:text-ink",
            )}
          >
            <button
              type="button"
              aria-pressed={active}
              onClick={() => onSelect(it.id)}
              className={cn(
                "flex cursor-pointer items-center gap-2 bg-transparent py-2.5 pl-3 text-sm font-semibold text-inherit",
                removable ? "pr-1" : "pr-3",
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
            {removable && (
              <button
                type="button"
                aria-label={`Delete saved filter ${it.label}`}
                onClick={() => onRemove?.(it.id)}
                className="mr-1 flex size-6 cursor-pointer items-center justify-center rounded-md text-ink-faint hover:bg-row-hover hover:text-ink"
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
          className="ml-auto flex-none cursor-pointer border-0 bg-transparent px-2 py-2.5 text-[13px] font-semibold whitespace-nowrap text-ink-faint hover:text-ink"
        >
          + Save current filters
        </button>
      )}
    </div>
  );
}
