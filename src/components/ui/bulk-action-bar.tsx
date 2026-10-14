"use client";

import { cn } from "@/lib/cn";

const btn =
  "h-8 cursor-pointer rounded-md border border-line bg-surface px-3 text-[13px] font-medium text-ink aria-disabled:cursor-not-allowed aria-disabled:text-ink-muted";

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
      className="flex h-11 items-center gap-1 rounded-t-md border-b border-primary bg-primary-tint pr-2 pl-4"
    >
      <span className="mr-2 font-semibold text-primary-text" aria-live="polite">
        {count} selected
      </span>
      <button
        type="button"
        onClick={onClear}
        className="h-8 cursor-pointer px-2 text-[13px] font-medium text-primary-text underline"
      >
        Clear
      </button>
      <span aria-hidden="true" className="mx-2 h-5 w-px bg-primary" />
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
        <button
          type="button"
          onClick={destructive.onClick}
          className={cn(btn, "ml-auto text-error")}
        >
          {destructive.label}
        </button>
      )}
    </div>
  );
}
