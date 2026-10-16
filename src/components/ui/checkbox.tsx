"use client";

import { cn } from "@/lib/cn";

export function Checkbox({
  checked,
  onChange,
  label,
  className,
  disabled,
  onClick,
}: {
  checked: boolean | "mixed";
  onChange: (next: boolean) => void;
  label: string;
  className?: string;
  disabled?: boolean;
  onClick?: React.MouseEventHandler;
}) {
  const on = checked === true || checked === "mixed";
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={(e) => {
        onClick?.(e);
        if (!disabled) onChange(checked !== true);
      }}
      className={cn(
        "relative inline-flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-[4px] border-[1.5px] p-0 transition-colors duration-100 before:absolute before:-inset-3.5 before:content-[''] disabled:cursor-not-allowed disabled:opacity-50",
        on
          ? "border-primary bg-primary text-on-primary"
          : "border-neutral-line bg-surface-sunken hover:border-ink-faint",
        className,
      )}
    >
      {checked === true && (
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M5 12l5 5 9-10" />
        </svg>
      )}
      {checked === "mixed" && (
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" aria-hidden="true">
          <path d="M6 12h12" />
        </svg>
      )}
    </button>
  );
}
