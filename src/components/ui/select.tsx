"use client";

import { forwardRef } from "react";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/cn";
import { controlBorder } from "@/components/ui/input";

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
          "h-[38px] w-full appearance-none rounded-lg border bg-surface-sunken pr-9 pl-3 text-sm text-ink transition-colors duration-100 disabled:cursor-not-allowed disabled:bg-neutral-soft disabled:text-ink-muted",
          controlBorder(invalid),
        )}
      >
        {children}
      </select>
      <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-ink-faint">
        <Icon name="chevron-down" size={16} />
      </span>
    </span>
  );
});
