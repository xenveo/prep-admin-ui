"use client";

import { forwardRef } from "react";
import { Icon, type IconName } from "@/components/ui/icon";
import { cn } from "@/lib/cn";

/** Shared control shell (no background or border colour, so callers can pick them). */
const controlBase =
  "h-[38px] w-full rounded-lg border px-3 text-sm text-ink placeholder:text-ink-faint transition-colors duration-100 disabled:cursor-not-allowed disabled:bg-neutral-soft disabled:text-ink-muted";

/** Sunken field look (forms, modals, side panels). */
export const controlClass = cn(controlBase, "bg-surface-sunken");

/** Border colour for a control: amber when invalid, mint on focus otherwise. */
export function controlBorder(invalid?: boolean) {
  return invalid ? "border-improve" : "border-input-line focus:border-primary-line";
}

export type InputTone = "sunken" | "surface";

export const Input = forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & {
    invalid?: boolean;
    iconLeft?: IconName;
    /** "sunken" (default) for form fields; "surface" for toolbar search. Search inputs default to "surface". */
    tone?: InputTone;
  }
>(function Input({ invalid, iconLeft, tone, className, ...rest }, ref) {
  const resolvedTone = tone ?? (rest.type === "search" ? "surface" : "sunken");
  const input = (
    <input
      ref={ref}
      aria-invalid={invalid ? true : undefined}
      {...rest}
      className={cn(
        controlBase,
        resolvedTone === "surface" ? "bg-surface" : "bg-surface-sunken",
        controlBorder(invalid),
        iconLeft && "pl-9",
        !iconLeft && className,
      )}
    />
  );
  if (!iconLeft) return input;
  return (
    <span className={cn("relative block", className)}>
      <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-faint">
        <Icon name={iconLeft} size={16} />
      </span>
      {input}
    </span>
  );
});
