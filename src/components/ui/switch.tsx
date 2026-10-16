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
        "relative inline-flex h-[26px] w-11 shrink-0 cursor-pointer items-center rounded-full p-[3px] transition-colors duration-150",
        "disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-primary" : "bg-neutral-line",
      )}
    >
      {/* Knob: white on light, the light ink (#e8eeec) on dark — tokens.css sets color-scheme per theme. */}
      <span
        aria-hidden="true"
        className={cn(
          "size-5 rounded-full bg-[color:light-dark(var(--surface),var(--ink))] transition-transform duration-150",
          checked && "translate-x-[18px]",
        )}
      />
    </button>
  );
}
