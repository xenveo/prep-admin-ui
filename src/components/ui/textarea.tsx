"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/cn";
import { controlBorder } from "@/components/ui/input";

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }
>(function Textarea({ invalid, className, ...rest }, ref) {
  return (
    <textarea
      ref={ref}
      aria-invalid={invalid ? true : undefined}
      {...rest}
      className={cn(
        "min-h-[76px] w-full resize-y rounded-lg border bg-surface-sunken px-3 py-2.5 text-sm leading-[1.5] text-ink placeholder:text-ink-faint transition-colors duration-100 disabled:cursor-not-allowed disabled:bg-neutral-soft disabled:text-ink-muted",
        controlBorder(invalid),
        className,
      )}
    />
  );
});
