"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
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

  const summary = selected.length
    ? selected.map((v) => def.options.find((o) => o.value === v)?.label ?? v).join(", ")
    : null;

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
        className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-md border border-line bg-surface pr-2.5 pl-3 text-sm font-medium text-ink"
      >
        {summary ? def.label : <span className="font-normal text-ink-muted">{def.label}:</span>}
        {!summary && " Any"}
        {summary && <span className="sr-only">: {summary}</span>}
        <Icon name="chevron-down" size={14} className="text-ink-muted" />
      </button>
      {open && (
        <div
          id={popId}
          role="group"
          aria-label={`${def.label} filter`}
          className="absolute top-full left-0 z-30 mt-1 flex min-w-[200px] flex-col rounded-md border border-line bg-surface p-1 shadow-[var(--shadow-menu)]"
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
      <Input
        type="search"
        iconLeft="search"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder={searchPlaceholder}
        aria-label={searchLabel}
        className="w-[280px] max-w-full"
      />
      {filters.map((f) => (
        <FilterButton
          key={f.id}
          def={f}
          selected={values[f.id] ?? []}
          onChange={(v) => onChange(f.id, v)}
        />
      ))}
      {active.map((f) => {
        const text = (values[f.id] ?? [])
          .map((v) => f.options.find((o) => o.value === v)?.label ?? v)
          .join(", ");
        return (
          <span
            key={f.id}
            className={cn(
              "inline-flex h-9 items-center gap-1 rounded-md border border-primary bg-primary-tint pr-1.5 pl-3 text-sm font-medium text-primary-text",
            )}
          >
            {f.label}: {text}
            <button
              type="button"
              aria-label={`Remove ${f.label.toLowerCase()} filter`}
              onClick={() => onChange(f.id, [])}
              className="inline-flex size-6 cursor-pointer items-center justify-center rounded-sm text-primary-text"
            >
              <Icon name="close" size={14} />
            </button>
          </span>
        );
      })}
      {active.length > 0 && (
        <button
          type="button"
          onClick={onClearAll}
          className="h-9 cursor-pointer px-2 text-sm font-semibold text-primary-text"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
