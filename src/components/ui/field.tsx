"use client";

import { useId, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Field({
  label,
  htmlFor,
  helper,
  error,
  optional,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  helper?: ReactNode;
  error?: ReactNode;
  optional?: boolean;
  children: (ids: { id: string; describedBy?: string; invalid: boolean }) => ReactNode;
  className?: string;
}) {
  const auto = useId();
  const id = htmlFor ?? auto;
  const helperId = `${id}-helper`;
  const errorId = `${id}-error`;
  const invalid = Boolean(error);
  const describedBy =
    [error ? errorId : null, helper ? helperId : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-[13px] leading-5 font-semibold text-ink">
        {label}
        {optional && <span className="ml-1 font-normal text-ink-muted">(optional)</span>}
      </label>
      {children({ id, describedBy, invalid })}
      {error && (
        <p id={errorId} role="alert" className="text-xs leading-4 font-medium text-improve-text">
          {error}
        </p>
      )}
      {helper && (
        <p id={helperId} className="text-xs leading-4 text-ink-muted">
          {helper}
        </p>
      )}
    </div>
  );
}
