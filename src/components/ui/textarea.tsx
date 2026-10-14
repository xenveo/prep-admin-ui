"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/cn";

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
        "min-h-[72px] w-full resize-y rounded-md border bg-surface px-3 py-2 text-sm leading-5 text-ink placeholder:text-ink-muted disabled:cursor-not-allowed disabled:bg-neutral-soft",
        invalid ? "border-improve" : "border-input-line",
        className,
      )}
    />
  );
});
