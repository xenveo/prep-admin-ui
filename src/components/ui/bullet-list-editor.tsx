"use client";

import { useRef } from "react";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";

const DOT = { strong: "bg-primary", mistake: "bg-improve", neutral: "bg-ink-muted" } as const;

export function BulletListEditor({
  items,
  onChange,
  tone,
  label,
  addLabel = "+ Add point",
}: {
  items: string[];
  onChange: (items: string[]) => void;
  tone: "strong" | "mistake" | "neutral";
  label: string;
  addLabel?: string;
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
    <div role="group" aria-label={label} className="flex flex-col gap-1.5">
      {items.map((it, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <span aria-hidden="true" className={cn("mx-1 size-1.5 shrink-0 rounded-full", DOT[tone])} />
          <Input
            ref={setRef(i)}
            value={it}
            aria-label={`${label}, point ${i + 1}`}
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
            className="h-8 flex-1 text-[13px]"
          />
          <button
            type="button"
            aria-label={`Remove point ${i + 1}`}
            onClick={() => remove(i)}
            className="inline-flex size-8 cursor-pointer items-center justify-center rounded-md text-ink-muted"
          >
            <Icon name="close" size={16} />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="h-8 cursor-pointer self-start px-1 text-[13px] font-semibold text-primary-text"
      >
        {addLabel}
      </button>
    </div>
  );
}
