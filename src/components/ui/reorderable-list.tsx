"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export function ReorderableList<T>({
  items,
  itemId,
  onReorder,
  renderItem,
  itemLabel,
  selectedId,
  onSelect,
  ariaLabel,
}: {
  items: T[];
  itemId: (item: T) => string;
  onReorder: (items: T[]) => void;
  renderItem: (item: T, ctx: { index: number; selected: boolean; handle: ReactNode }) => ReactNode;
  itemLabel: (item: T, index: number) => string;
  selectedId?: string;
  onSelect?: (id: string) => void;
  ariaLabel: string;
}) {
  const [announce, setAnnounce] = useState("");
  const [armedId, setArmedId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const handleEls = useRef(new Map<string, HTMLButtonElement>());
  const pendingFocus = useRef<string | null>(null);

  useEffect(() => {
    if (pendingFocus.current) {
      handleEls.current.get(pendingFocus.current)?.focus();
      pendingFocus.current = null;
    }
  });

  const move = (from: number, to: number, focusHandle: boolean) => {
    if (to < 0 || to >= items.length || from === to) return;
    const next = items.slice();
    const [it] = next.splice(from, 1);
    next.splice(to, 0, it);
    if (focusHandle) pendingFocus.current = itemId(it);
    onReorder(next);
    setAnnounce(`${itemLabel(it, to)} moved to position ${to + 1} of ${items.length}`);
  };

  return (
    <div>
      <ul role="list" aria-label={ariaLabel} className="m-0 flex list-none flex-col p-0">
        {items.map((item, index) => {
          const id = itemId(item);
          const label = itemLabel(item, index);
          const selected = selectedId === id;
          const handle = (
            <button
              type="button"
              ref={(el) => {
                if (el) handleEls.current.set(id, el);
                else handleEls.current.delete(id);
              }}
              aria-label={`Reorder ${label.charAt(0).toLowerCase()}${label.slice(1)}. Use arrow keys to move.`}
              onPointerDown={() => setArmedId(id)}
              onPointerUp={() => setArmedId(null)}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === "ArrowUp") {
                  e.preventDefault();
                  e.stopPropagation();
                  move(index, index - 1, true);
                } else if (e.key === "ArrowDown") {
                  e.preventDefault();
                  e.stopPropagation();
                  move(index, index + 1, true);
                }
              }}
              className="relative inline-flex h-5 w-3 shrink-0 cursor-grab items-center justify-center rounded-sm text-xs leading-5 whitespace-nowrap text-ink-faint transition-colors duration-100 after:absolute after:-inset-x-1.5 after:-inset-y-3 after:content-[''] hover:text-ink-muted active:cursor-grabbing"
            >
              <span aria-hidden="true">⋮⋮</span>
            </button>
          );
          return (
            <li
              key={id}
              draggable={armedId === id || dragId === id}
              onDragStart={(e) => {
                setDragId(id);
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", id);
              }}
              onDragOver={(e) => {
                if (dragId === null) return;
                e.preventDefault();
                setOverIndex(index);
              }}
              onDrop={(e) => {
                e.preventDefault();
                const from = items.findIndex((x) => itemId(x) === dragId);
                if (from >= 0) move(from, index, false);
                setDragId(null);
                setOverIndex(null);
                setArmedId(null);
              }}
              onDragEnd={() => {
                setDragId(null);
                setOverIndex(null);
                setArmedId(null);
              }}
              onClick={() => onSelect?.(id)}
              className={cn(
                "border-t border-line first:border-t-0",
                dragId === id && "opacity-50",
                overIndex === index && dragId !== null && dragId !== id && "outline-2 -outline-offset-2 outline-primary",
              )}
            >
              {renderItem(item, { index, selected, handle })}
            </li>
          );
        })}
      </ul>
      <div role="status" aria-live="polite" className="sr-only">
        {announce}
      </div>
    </div>
  );
}
