"use client";

import Link from "next/link";
import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export type TabItem = { id: string; label: string; count?: number; badge?: ReactNode; href?: string };

/** Each tab element gets id `tab-${item.id}` so a tabpanel can use aria-labelledby. */
export function Tabs({
  items,
  activeId,
  onChange,
  label,
  className,
  panelId,
}: {
  items: TabItem[];
  activeId: string;
  onChange?: (id: string) => void;
  label: string;
  className?: string;
  panelId?: string;
}) {
  const listRef = useRef<HTMLDivElement>(null);

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const idx = items.findIndex((i) => i.id === activeId);
    const focused = Array.from(listRef.current?.querySelectorAll<HTMLElement>('[role="tab"]') ?? []);
    const fi = focused.findIndex((el) => el === document.activeElement);
    const current = fi >= 0 ? fi : Math.max(0, idx);
    let next = current;
    if (e.key === "ArrowRight") next = (current + 1) % items.length;
    else if (e.key === "ArrowLeft") next = (current - 1 + items.length) % items.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = items.length - 1;
    else return;
    e.preventDefault();
    focused[next]?.focus();
    // Button tabs activate on arrow (automatic); route tabs only move focus, Enter navigates.
    if (!items[next].href) onChange?.(items[next].id);
  }

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cn("flex gap-6 border-b border-line", className)}
    >
      {items.map((item) => {
        const selected = item.id === activeId;
        const common = {
          id: `tab-${item.id}`,
          role: "tab" as const,
          "aria-selected": selected,
          "aria-controls": panelId,
          tabIndex: selected ? 0 : -1,
          className: cn(
            "-mb-px inline-flex h-10 items-center gap-1.5 whitespace-nowrap border-b-2 text-sm",
            selected
              ? "border-primary font-semibold text-primary-text"
              : "border-transparent font-medium text-ink-muted hover:text-ink",
          ),
        };
        const inner = (
          <>
            {item.label}
            {item.count != null ? <span className="font-medium text-ink-muted">{item.count}</span> : null}
            {item.badge}
          </>
        );
        return item.href ? (
          <Link key={item.id} href={item.href} {...common} aria-current={selected ? "page" : undefined}>
            {inner}
          </Link>
        ) : (
          <button key={item.id} type="button" onClick={() => onChange?.(item.id)} {...common}>
            {inner}
          </button>
        );
      })}
    </div>
  );
}
