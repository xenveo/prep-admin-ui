"use client";

import { cn } from "@/lib/cn";

const btn =
  "cursor-pointer rounded-lg border border-primary-line bg-transparent px-3 py-[7px] text-[13px] leading-5 font-semibold whitespace-nowrap text-ink hover:border-primary aria-disabled:cursor-not-allowed aria-disabled:border-line aria-disabled:text-ink-faint";

export function BulkActionBar({
  count,
  onClear,
  actions,
  destructive,
}: {
  count: number;
  onClear: () => void;
  actions: { id: string; label: string; onClick: () => void; count?: number; disabled?: boolean }[];
  destructive?: { label: string; onClick: () => void };
}) {
  return (
    <div
      role="toolbar"
      aria-label="Bulk actions"
      className="flex flex-wrap items-center gap-3 rounded-[10px] border border-primary-line bg-primary-tint px-3.5 py-2.5 text-sm"
    >
      <span className="font-semibold text-ink" aria-live="polite">
        {count} selected
      </span>
      <span aria-hidden="true" className="flex-1" />
      {actions.map((a) => {
        const disabled = a.disabled || a.count === 0;
        return (
          <button
            key={a.id}
            type="button"
            aria-disabled={disabled || undefined}
            onClick={() => {
              if (!disabled) a.onClick();
            }}
            className={btn}
          >
            {a.label}
            {a.count !== undefined ? ` (${a.count})` : ""}
          </button>
        );
      })}
      {destructive && (
        <button type="button" onClick={destructive.onClick} className={cn(btn, "text-error hover:border-error")}>
          {destructive.label}
        </button>
      )}
      <button
        type="button"
        onClick={onClear}
        className="cursor-pointer border-0 bg-transparent p-0 text-[13px] font-semibold text-ink-muted hover:text-ink"
      >
        Clear
      </button>
    </div>
  );
}
