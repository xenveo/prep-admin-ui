"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/cn";

export type FilterOption = { value: string; label: string };
export type FilterDef = { id: string; label: string; options: FilterOption[]; multi?: boolean };

function FilterButton({
  def,
  selected,
  onChange,
}: {
  def: FilterDef;
  selected: string[];
  onChange: (values: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popId = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const labels = selected.map((v) => def.options.find((o) => o.value === v)?.label ?? v);
  const summary = labels.length ? labels.join(", ") : null;
  const shown = labels.length === 0 ? "Any" : labels.length === 1 ? labels[0] : `${labels.length} selected`;

  return (
    <div
      ref={rootRef}
      className="relative"
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) {
          e.stopPropagation();
          setOpen(false);
          btnRef.current?.focus();
        }
      }}
    >
      <button
        ref={btnRef}
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={open ? popId : undefined}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "inline-flex h-[38px] cursor-pointer items-center gap-1.5 rounded-[9px] border bg-transparent px-3 text-[13px] whitespace-nowrap text-ink-muted hover:border-neutral-line hover:text-ink",
          summary ? "border-primary-line" : "border-input-line",
          open && "border-neutral-line text-ink",
        )}
      >
        {def.label}
        <span title={labels.length > 1 ? (summary ?? undefined) : undefined} className="max-w-[160px] truncate font-semibold text-ink">
          <span className="sr-only">: </span>
          {shown}
        </span>
        {labels.length > 1 && <span className="sr-only">: {summary}</span>}
        <span aria-hidden="true" className="text-[10px]">
          ▾
        </span>
      </button>
      {open && (
        <div
          id={popId}
          role="group"
          aria-label={`${def.label} filter`}
          className="absolute top-full left-0 z-30 mt-1 flex min-w-[200px] flex-col rounded-[10px] border border-line bg-surface p-1 shadow-[var(--shadow-menu)]"
        >
          {!def.multi && (
            <OptionRow
              type="radio"
              name={popId}
              label="Any"
              checked={selected.length === 0}
              onChange={() => {
                onChange([]);
                setOpen(false);
              }}
            />
          )}
          {def.options.map((o) => {
            const checked = selected.includes(o.value);
            return (
              <OptionRow
                key={o.value}
                type={def.multi ? "checkbox" : "radio"}
                name={popId}
                label={o.label}
                checked={checked}
                onChange={() => {
                  if (def.multi) {
                    onChange(checked ? selected.filter((v) => v !== o.value) : [...selected, o.value]);
                  } else {
                    onChange([o.value]);
                    setOpen(false);
                  }
                }}
              />
            );
          })}
          {def.multi && selected.length > 0 && (
            <button
              type="button"
              onClick={() => {
                onChange([]);
                setOpen(false);
                btnRef.current?.focus();
              }}
              className="mt-1 flex h-9 cursor-pointer items-center rounded-sm border-t border-line px-2 text-left text-[13px] font-semibold text-primary-text hover:bg-row-hover"
            >
              Clear {def.label.toLowerCase()} filter
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function OptionRow({
  type,
  name,
  label,
  checked,
  onChange,
}: {
  type: "radio" | "checkbox";
  name: string;
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex h-9 cursor-pointer items-center gap-2 rounded-sm px-2 text-sm text-ink hover:bg-row-hover">
      <input
        type={type}
        name={name}
        checked={checked}
        onChange={onChange}
        className="size-4 accent-[var(--primary)]"
      />
      {label}
    </label>
  );
}

export function FilterBar({
  search,
  onSearchChange,
  searchPlaceholder,
  searchLabel,
  filters,
  values,
  onChange,
  onClearAll,
}: {
  search: string;
  onSearchChange: (v: string) => void;
  searchPlaceholder: string;
  searchLabel: string;
  filters: FilterDef[];
  values: Record<string, string[]>;
  onChange: (id: string, values: string[]) => void;
  onClearAll: () => void;
}) {
  const active = filters.filter((f) => (values[f.id] ?? []).length > 0);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="flex h-[38px] min-w-[240px] max-w-[360px] flex-1 cursor-text items-center gap-2.5 rounded-[9px] border border-input-line bg-surface px-3 focus-within:[outline:var(--focus-ring)] focus-within:[outline-offset:var(--focus-offset)]">
        <Icon name="search" size={15} className="shrink-0 text-ink-faint" />
        <input
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          aria-label={searchLabel}
          className="min-w-0 flex-1 border-0 bg-transparent p-0 text-sm text-ink outline-none placeholder:text-ink-faint focus-visible:outline-none [&::-webkit-search-cancel-button]:appearance-none"
        />
      </label>
      {filters.map((f) => (
        <FilterButton
          key={f.id}
          def={f}
          selected={values[f.id] ?? []}
          onChange={(v) => onChange(f.id, v)}
        />
      ))}
      {active.length > 0 && (
        <button
          type="button"
          onClick={onClearAll}
          className="h-[38px] cursor-pointer rounded-[9px] px-2 text-[13px] font-semibold whitespace-nowrap text-primary-text hover:underline"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
