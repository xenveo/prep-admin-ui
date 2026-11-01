"use client";

import type { ReactNode } from "react";
import { Icon } from "@/components/ui/icon";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/cn";
import { SMALL_SAMPLE, type Ratio } from "./view-model";

export const CARD = "min-w-0 rounded-panel border border-line bg-surface";
export const KICKER = "m-0 font-mono text-[11px] leading-4 font-medium tracking-[0.08em] text-ink-faint uppercase";

export const fmtPct = (r: Ratio | null | undefined) => (r?.value == null ? "—" : `${Math.round(r.value * 100)}%`);
export const fmtNum = (n: number | null | undefined, digits = 0) => (n == null ? "—" : n.toFixed(digits));

/**
 * Names a figure's time basis when it differs from the selected month, e.g. "As of 31 Oct" or
 * "Invited in Sep". Figures for the reporting month itself need no label.
 */
export function Basis({ children }: { children: ReactNode }) {
  return (
    <span className="shrink-0 rounded-sm bg-neutral-soft px-1.5 py-0.5 text-[11px] leading-4 font-medium whitespace-nowrap text-ink-muted">
      {children}
    </span>
  );
}

export function InfoTip({ children, label }: { children: ReactNode; label: string }) {
  return (
    <Tooltip content={children}>
      <button
        type="button"
        aria-label={`About ${label}`}
        className="inline-flex size-5 cursor-help items-center justify-center rounded-full border-0 bg-transparent p-0 text-ink-faint hover:text-ink"
      >
        <Icon name="info" size={14} />
      </button>
    </Tooltip>
  );
}

export function Card({
  id, title, sub, basis, info, aside, children, className,
}: {
  id: string;
  title: string;
  sub?: ReactNode;
  basis?: ReactNode;
  info?: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section aria-labelledby={id} className={cn(CARD, "flex flex-col gap-5 p-[22px]", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex items-center gap-1.5">
            <h3 id={id} className="m-0 text-[17px] leading-6 font-semibold text-ink">{title}</h3>
            {info ? <InfoTip label={title}>{info}</InfoTip> : null}
          </div>
          {sub ? <p className="m-0 text-[13px] leading-5 text-ink-faint">{sub}</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {aside}
          {basis ? <Basis>{basis}</Basis> : null}
        </div>
      </div>
      {children}
    </section>
  );
}

/**
 * Change versus the previous period. `better` says which direction is good, so a falling cost
 * reads as positive. Hidden values (null) render an explicit "no comparison" state.
 */
export function Delta({
  current, previous, better = "up", unit = "", digits = 0, mode = "abs", since, className,
}: {
  current: number | null;
  previous: number | null;
  better?: "up" | "down";
  unit?: string;
  digits?: number;
  /** abs = difference in the metric's own unit; pct = relative change; pts = percentage points of a ratio. */
  mode?: "abs" | "pct" | "pts";
  since: string;
  className?: string;
}) {
  if (current == null || previous == null || (mode === "pct" && previous === 0)) {
    return <span className={cn("text-xs leading-4 text-ink-faint", className)}>No comparison for {since}</span>;
  }
  const raw = mode === "pct" ? ((current - previous) / previous) * 100 : mode === "pts" ? (current - previous) * 100 : current - previous;
  const shown = Number(raw.toFixed(mode === "abs" ? digits : 0));
  const suffix = mode === "pct" ? "%" : mode === "pts" ? " pts" : unit;
  const flat = shown === 0;
  const good = flat ? null : (shown > 0) === (better === "up");
  const text = flat ? "No change" : `${shown > 0 ? "+" : "−"}${Math.abs(shown).toFixed(mode === "abs" ? digits : 0)}${suffix}`;
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs leading-4", className)}>
      <span
        className={cn(
          "inline-flex items-center gap-0.5 rounded-full px-1.5 py-px font-semibold",
          good == null ? "bg-neutral-soft text-ink-faint" : good ? "bg-primary-tint text-primary-text" : "bg-improve-soft text-improve-text",
        )}
      >
        {!flat && <Icon name={shown > 0 ? "arrow-up" : "arrow-down"} size={14} />}
        {text}
      </span>
      <span className="text-ink-faint">vs {since}</span>
    </span>
  );
}

/** Six-point trend line; null points break the line. Decorative: the delta beside it carries the meaning. */
export function Sparkline({
  values, width = 112, height = 32, tone = "primary", className,
}: {
  values: (number | null)[];
  width?: number;
  height?: number;
  tone?: "primary" | "improve";
  className?: string;
}) {
  const nums = values.filter((v): v is number => v != null);
  if (nums.length < 2) return null;
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const span = max - min || 1;
  const pad = 4;
  const x = (i: number) => pad + (i / (values.length - 1)) * (width - pad * 2);
  const y = (v: number) => height - pad - ((v - min) / span) * (height - pad * 2);
  const segments: string[] = [];
  let open = false;
  values.forEach((v, i) => {
    if (v == null) { open = false; return; }
    segments.push(`${open ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`);
    open = true;
  });
  const last = values.length - 1;
  const stroke = tone === "primary" ? "var(--primary)" : "var(--improve)";
  const area = values[0] != null && values[last] != null
    ? `${segments.join(" ")} L${x(last).toFixed(1)},${height} L${x(0).toFixed(1)},${height} Z`
    : null;
  return (
    <svg aria-hidden="true" width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={cn("shrink-0 overflow-visible", className)}>
      {area && <path d={area} fill={stroke} opacity={0.1} />}
      <path d={segments.join(" ")} fill="none" stroke={stroke} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      {values[last] != null && <circle cx={x(last)} cy={y(values[last]!)} r={3.5} fill={stroke} stroke="var(--surface)" strokeWidth={2} />}
    </svg>
  );
}

/** Thin progress track for a share, 0–1. */
export function Meter({ value, tone = "primary", className }: { value: number | null; tone?: "primary" | "improve" | "ready"; className?: string }) {
  const w = value == null ? 0 : Math.max(0, Math.min(1, value)) * 100;
  return (
    <span aria-hidden="true" className={cn("flex h-1.5 overflow-hidden rounded-sm bg-line", className)}>
      <span
        className={cn("block h-full rounded-sm", tone === "improve" ? "bg-improve" : tone === "ready" ? "bg-band-ready" : "bg-primary")}
        style={{ width: `${w}%` }}
      />
    </span>
  );
}

/** "42 / 54" with a small-sample marker below the threshold. */
export function Fraction({ r, unit }: { r: Ratio; unit?: string }) {
  const small = r.den > 0 && r.den < SMALL_SAMPLE;
  return (
    <span className="inline-flex flex-wrap items-center gap-x-1.5 text-xs leading-4 text-ink-faint">
      {r.num} / {r.den}{unit ? ` ${unit}` : ""}
      {small && (
        <span className="rounded-full bg-improve-soft px-1.5 text-[11px] font-semibold text-improve-text">Small sample</span>
      )}
    </span>
  );
}

/** Large figure for KPI tiles. */
export function Figure({ value, unit, className }: { value: ReactNode; unit?: string; className?: string }) {
  return (
    <span className={cn("flex items-baseline gap-1.5 text-[30px] leading-none font-semibold tracking-[-0.03em] text-ink tabular-nums", className)}>
      {value}
      {unit ? <span className="text-sm font-medium tracking-normal text-ink-muted">{unit}</span> : null}
    </span>
  );
}

export type Kpi = {
  label: string;
  value: ReactNode;
  unit?: string;
  delta?: ReactNode;
  note?: ReactNode;
  info?: ReactNode;
  basis?: string;
};

/** Row of KPI tiles sharing one bordered strip. */
export function KpiStrip({ items, label }: { items: Kpi[]; label: string }) {
  return (
    <section
      aria-label={label}
      className={cn(CARD, "grid grid-cols-1 min-[640px]:grid-cols-2", items.length === 3 ? "min-[1100px]:grid-cols-3" : "min-[1100px]:grid-cols-4")}
    >
      {items.map((k, i) => (
        <div
          key={k.label}
          className={cn(
            "flex min-w-0 flex-col gap-2.5 px-[22px] py-5",
            i > 0 && "border-t border-line min-[1100px]:border-t-0 min-[1100px]:border-l",
            i === 1 && "min-[640px]:border-t-0 min-[640px]:border-l",
            i === 3 && "min-[640px]:border-l",
          )}
        >
          <div className="flex items-center gap-1.5">
            <span className="text-[13px] leading-5 font-medium text-ink-muted">{k.label}</span>
            {k.info ? <InfoTip label={k.label}>{k.info}</InfoTip> : null}
          </div>
          <Figure value={k.value} unit={k.unit} />
          {k.delta}
          {k.note ? <div className="text-xs leading-4 text-ink-faint">{k.note}</div> : null}
          {k.basis ? <div><Basis>{k.basis}</Basis></div> : null}
        </div>
      ))}
    </section>
  );
}
