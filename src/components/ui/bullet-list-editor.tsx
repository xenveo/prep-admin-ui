"use client";

import { useRef } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";

const DOT = { strong: "bg-primary", mistake: "bg-improve", neutral: "bg-ink-muted" } as const;
const PLACEHOLDER = { strong: "Describe a point", mistake: "Describe a mistake", neutral: "" } as const;

/** Editable bullet rows: [5px dot, 38px input, 30px ✕] plus a "+ Add" text button. */
export function BulletListEditor({
  items,
  onChange,
  tone,
  label,
  addLabel = "+ Add point",
  itemLabel = "point",
  placeholder,
}: {
  items: string[];
  onChange: (items: string[]) => void;
  /** Dot colour: mint for strong points, amber for mistakes / red flags. */
  tone: "strong" | "mistake" | "neutral";
  label: string;
  addLabel?: string;
  /** Noun for one row in accessible names, e.g. "Remove mistake 2". Defaults to "point". */
  itemLabel?: string;
  /** Row placeholder. Defaults to "Describe a point" / "Describe a mistake" by tone. */
  placeholder?: string;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const focusAfter = useRef<number | null>(null);

  const setRef = (i: number) => (el: HTMLInputElement | null) => {
    refs.current[i] = el;
    if (el && focusAfter.current === i) {
      focusAfter.current = null;
      el.focus();
    }
  };

  const update = (i: number, v: string) => onChange(items.map((x, j) => (j === i ? v : x)));
  const add = () => {
    focusAfter.current = items.length;
    onChange([...items, ""]);
  };
  const remove = (i: number) => {
    focusAfter.current = Math.max(0, i - 1);
    const next = items.filter((_, j) => j !== i);
    onChange(next);
    if (next.length === 0) focusAfter.current = null;
  };

  return (
    <div role="group" aria-label={label} className="flex flex-col gap-2">
      {items.map((it, i) => (
        <div key={i} className="flex items-center gap-2">
          <span aria-hidden="true" className={cn("size-[5px] shrink-0 rounded-full", DOT[tone])} />
          <Input
            ref={setRef(i)}
            value={it}
            placeholder={placeholder ?? (PLACEHOLDER[tone] || undefined)}
            aria-label={`${label}, ${itemLabel} ${i + 1}`}
            onChange={(e) => update(i, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (it.trim()) add();
              } else if (e.key === "Backspace" && it === "") {
                e.preventDefault();
                remove(i);
              }
            }}
            className="min-w-0 flex-1"
          />
          <button
            type="button"
            aria-label={`Remove ${itemLabel} ${i + 1}`}
            onClick={() => remove(i)}
            className="inline-flex size-[30px] shrink-0 cursor-pointer items-center justify-center rounded-[7px] text-xs text-ink-faint transition-colors duration-100 hover:bg-row-hover hover:text-ink"
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="relative cursor-pointer self-start rounded-sm pt-1 pl-[13px] text-[13px] font-semibold text-primary-text after:absolute after:-inset-y-2 after:-inset-x-1 after:content-[''] hover:underline"
      >
        {addLabel}
      </button>
    </div>
  );
}
