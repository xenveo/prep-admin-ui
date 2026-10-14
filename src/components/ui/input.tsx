"use client";

import { forwardRef } from "react";
import { Icon, type IconName } from "@/components/ui/icon";
import { cn } from "@/lib/cn";

export const controlClass =
  "h-9 w-full rounded-md border bg-surface px-3 text-sm text-ink placeholder:text-ink-muted disabled:cursor-not-allowed disabled:bg-neutral-soft disabled:text-ink-muted";

export const Input = forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean; iconLeft?: IconName }
>(function Input({ invalid, iconLeft, className, ...rest }, ref) {
  const input = (
    <input
      ref={ref}
      aria-invalid={invalid ? true : undefined}
      {...rest}
      className={cn(
        controlClass,
        invalid ? "border-improve" : "border-input-line",
        iconLeft && "pl-9",
        !iconLeft && className,
      )}
    />
  );
  if (!iconLeft) return input;
  return (
    <span className={cn("relative block", className)}>
      <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-muted">
        <Icon name={iconLeft} size={16} />
      </span>
      {input}
    </span>
  );
});
