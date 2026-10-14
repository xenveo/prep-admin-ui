"use client";

import { forwardRef } from "react";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/cn";

export const Select = forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }
>(function Select({ invalid, className, children, ...rest }, ref) {
  return (
    <span className={cn("relative block", className)}>
      <select
        ref={ref}
        aria-invalid={invalid ? true : undefined}
        {...rest}
        className={cn(
          "h-9 w-full appearance-none rounded-md border bg-surface pr-9 pl-3 text-sm text-ink disabled:cursor-not-allowed disabled:bg-neutral-soft disabled:text-ink-muted",
          invalid ? "border-improve" : "border-input-line",
        )}
      >
        {children}
      </select>
      <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-ink-muted">
        <Icon name="chevron-down" size={16} />
      </span>
    </span>
  );
});
