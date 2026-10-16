"use client";

import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { useEscapeLayer, useFocusTrap, useIsClient } from "@/lib/use-focus-trap";
import { Icon } from "./icon";

export type MenuItem = {
  id: string;
  label: string;
  onSelect: () => void;
  disabled?: boolean;
  disabledReason?: string;
  destructive?: boolean;
  dividerBefore?: boolean;
};

export function useMenu(): { open: boolean; setOpen(v: boolean): void } {
  const [open, setOpen] = useState(false);
  return { open, setOpen };
}

const WIDTH = 200;
const ITEM_H = 36;

type Pos = { left: number; top?: number; bottom?: number };

export function Menu({
  label,
  items,
  trigger,
  align = "end",
  triggerClassName,
  triggerVariant = "ghost",
}: {
  label: string;
  items: MenuItem[];
  trigger?: ReactNode;
  align?: "start" | "end";
  triggerClassName?: string;
  /** ghost = borderless 30px ⋯ (table rows); outline = 34px bordered square (panel/page headers). */
  triggerVariant?: "ghost" | "outline";
}) {
  const { open, setOpen } = useMenu();
  const [pos, setPos] = useState<Pos>({ left: 0, top: 0 });
  const isClient = useIsClient();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const active = open && isClient;

  const close = useCallback(() => setOpen(false), [setOpen]);

  const openMenu = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const estimated = items.length * ITEM_H + 8 + items.filter((i) => i.dividerBefore).length * 9;
    const below = window.innerHeight - rect.bottom;
    const flipUp = below < estimated + 12 && rect.top > below;
    const rawLeft = align === "end" ? rect.right - WIDTH : rect.left;
    const left = Math.max(8, Math.min(rawLeft, window.innerWidth - WIDTH - 8));
    setPos(flipUp ? { left, bottom: window.innerHeight - rect.top + 4 } : { left, top: rect.bottom + 4 });
    setOpen(true);
  }, [align, items, setOpen]);

  useEscapeLayer(active, close);
  useFocusTrap({
    active,
    containerRef: menuRef,
    returnFocusRef: triggerRef,
    trap: false,
    getInitialFocus: () => menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])'),
  });

  useEffect(() => {
    if (!active) return;
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (menuRef.current?.contains(t) || triggerRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onScroll = (e: Event) => {
      if (menuRef.current && e.target instanceof Node && menuRef.current.contains(e.target)) return;
      setOpen(false);
    };
    const onResize = () => setOpen(false);
    document.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [active, setOpen]);

  function onTriggerKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    // Keep row-level handlers (Enter opens the row, arrows move rows) from seeing menu keys.
    if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ") {
      e.stopPropagation();
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        openMenu();
      }
    }
  }

  function onMenuKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    e.stopPropagation();
    const nodes = Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])') ?? [],
    );
    const i = nodes.findIndex((n) => n === document.activeElement);
    let next: number | null = null;
    if (e.key === "ArrowDown") next = (i + 1) % nodes.length;
    else if (e.key === "ArrowUp") next = (i - 1 + nodes.length) % nodes.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = nodes.length - 1;
    else if (e.key === "Tab") {
      e.preventDefault();
      close();
      return;
    }
    if (next !== null && nodes.length > 0) {
      e.preventDefault();
      nodes[next].focus();
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={(e) => {
          e.stopPropagation();
          if (open) close();
          else openMenu();
        }}
        onKeyDown={onTriggerKeyDown}
        className={cn(
          "relative inline-flex shrink-0 items-center justify-center transition-colors duration-100 after:absolute after:inset-x-0 after:content-['']",
          triggerVariant === "outline"
            ? cn(
                "h-[34px] min-w-[34px] rounded-lg border after:-inset-y-[5px] hover:border-neutral-line hover:text-ink",
                open ? "border-neutral-line text-ink" : "border-input-line text-ink-muted",
              )
            : cn(
                "h-[30px] min-w-[30px] rounded-[7px] after:-inset-y-[7px] hover:bg-row-hover hover:text-ink",
                open ? "bg-row-hover text-ink" : "text-ink-faint",
              ),
          triggerClassName,
        )}
      >
        {trigger ?? <Icon name="more" size={16} />}
      </button>
      {active
        ? createPortal(
            <div
              ref={menuRef}
              id={menuId}
              role="menu"
              aria-label={label}
              aria-orientation="vertical"
              onKeyDown={onMenuKeyDown}
              onClick={(e) => e.stopPropagation()}
              style={{ position: "fixed", width: WIDTH, left: pos.left, top: pos.top, bottom: pos.bottom }}
              className="z-[70] rounded-lg border border-line bg-surface p-1 shadow-[var(--shadow-menu)]"
            >
              {items.map((item) => (
                <div key={item.id}>
                  {item.dividerBefore ? <div role="separator" className="-mx-1 my-1 h-px bg-line" /> : null}                  <button
                    type="button"
                    role="menuitem"
                    tabIndex={-1}
                    aria-disabled={item.disabled || undefined}
                    title={item.disabled ? item.disabledReason : undefined}
                    onClick={() => {
                      if (item.disabled) return;
                      close();
                      item.onSelect();
                    }}
                    className={cn(
                      "focus-inset flex h-9 w-full items-center rounded-md px-3 text-left text-sm font-medium",
                      item.disabled
                        ? "cursor-not-allowed text-ink-faint"
                        : cn("hover:bg-row-hover focus:bg-row-hover", item.destructive ? "text-error" : "text-ink"),
                    )}
                  >
                    {item.label}
                  </button>
                </div>
              ))}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
