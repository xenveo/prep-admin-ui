"use client";

import { useRef, type KeyboardEvent } from "react";
import { cn } from "@/lib/cn";

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
  size = "md",
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  size?: "md" | "sm";
}) {
  const groupRef = useRef<HTMLDivElement>(null);
  const activeIndex = Math.max(0, options.findIndex((o) => o.value === value));

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    let next = activeIndex;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (activeIndex + 1) % options.length;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (activeIndex - 1 + options.length) % options.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = options.length - 1;
    else return;
    e.preventDefault();
    onChange(options[next].value);
    groupRef.current?.querySelectorAll<HTMLElement>('[role="radio"]')[next]?.focus();
  }

  return (
    <div
      ref={groupRef}
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKeyDown}
      className="inline-flex gap-0.5 rounded-md bg-bg p-0.5"
    >
      {options.map((o, i) => {
        const selected = i === activeIndex;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(o.value)}
            className={cn(
              "inline-flex items-center justify-center whitespace-nowrap rounded-sm border px-3 font-medium",
              size === "md" ? "h-8 text-sm" : "h-7 text-[13px]",
              selected
                ? "border-line bg-surface text-ink shadow-none"
                : "border-transparent text-ink-muted hover:text-ink",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
