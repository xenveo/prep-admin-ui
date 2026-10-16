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
      className="inline-flex max-w-full gap-1 overflow-x-auto rounded-[9px] border border-line bg-surface-sunken p-[3px]"
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
              "focus-inset inline-flex items-center justify-center whitespace-nowrap rounded-md font-semibold transition-colors duration-100",
              size === "md" ? "h-8 px-3.5 text-[13px]" : "h-7 px-2.5 text-xs",
              selected ? "bg-selected text-ink" : "bg-transparent text-ink-faint hover:text-ink",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
