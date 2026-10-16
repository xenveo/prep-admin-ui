"use client";

import { cn } from "@/lib/cn";

export function Switch({
  checked,
  onChange,
  label,
  id,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  id?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-100",
        "disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-primary" : "bg-ink-faint",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "absolute left-0.5 top-0.5 h-5 w-5 rounded-full transition-[transform,background-color] duration-100",
          checked ? "translate-x-5 bg-on-primary" : "bg-surface",
        )}
      />
    </button>
  );
}
