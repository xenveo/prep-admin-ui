"use client";

import { useId } from "react";
import { cn } from "@/lib/cn";

export type WeightPart = { id: string; label: string };

/** Segment / swatch colours, brightest first (dark: the design's four mint shades). */
const SEGMENT_COLOR = [
  "var(--weight-1)",
  "var(--weight-2)",
  "var(--primary-line)",
  "color-mix(in oklab, var(--primary) 30%, var(--bg))",
];

export function weightsValid(values: Record<string, number>): boolean {
  const total = Object.values(values).reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0);
  return Math.round(total * 100) === 10000;
}

export function WeightBar({
  label,
  description,
  parts,
  values,
  onChange,
}: {
  label: string;
  /** One line under the title, e.g. "How the two tries and improvement combine into one score." */
  description?: string;
  parts: WeightPart[];
  values: Record<string, number>;
  onChange: (v: Record<string, number>) => void;
}) {
  const uid = useId();
  const total = parts.reduce((a, p) => a + (values[p.id] || 0), 0);
  const valid = weightsValid(Object.fromEntries(parts.map((p) => [p.id, values[p.id] || 0])));
  const titleId = `${uid}-title`;
  const errId = `${uid}-total`;
  return (
    <div role="group" aria-labelledby={titleId} className="flex flex-col gap-3.5">
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-[3px]">
          <span id={titleId} className="text-sm leading-5 font-semibold text-ink">
            {label}
          </span>
          {description && <span className="text-[13px] leading-[18px] text-ink-faint">{description}</span>}
        </div>
        <span
          id={errId}
          role="status"
          className={cn(
            "shrink-0 text-[13px] leading-[18px] font-semibold whitespace-nowrap",
            valid ? "text-ink-faint" : "text-improve-text",
          )}
        >
          {valid ? "Total 100%" : `Total ${total}% · must be 100%`}
        </span>
      </div>
      <div
        role="img"
        aria-label={`${label}: ${parts.map((p) => `${p.label} ${values[p.id] || 0}%`).join(", ")}`}
        className="flex h-2.5 gap-[3px]"
      >
        {parts.map((p, i) => (
          <span
            key={p.id}
            style={{ flex: Math.max(values[p.id] || 0, 0.01), background: SEGMENT_COLOR[i % SEGMENT_COLOR.length] }}
            className="min-w-0 rounded-[3px] transition-[flex-grow] duration-200"
          />
        ))}
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(130px,1fr))] gap-3">
        {parts.map((p, i) => (
          <label key={p.id} className="flex min-w-0 flex-col gap-1.5">
            <span className="flex items-center gap-1.5 text-[13px] leading-[18px] text-ink-muted">
              <span
                aria-hidden="true"
                style={{ background: SEGMENT_COLOR[i % SEGMENT_COLOR.length] }}
                className="size-2 shrink-0 rounded-[2px]"
              />
              {p.label}
            </span>
            <span
              className={cn(
                "flex h-[38px] items-center gap-1 rounded-lg border border-input-line bg-surface-sunken px-3 transition-colors duration-100",
                "focus-within:border-primary-line focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary",
                "has-[:disabled]:cursor-not-allowed has-[:disabled]:bg-neutral-soft",
              )}
            >
              <input
                type="number"
                min={0}
                max={100}
                step={1}
                inputMode="numeric"
                value={values[p.id] ?? 0}
                aria-invalid={!valid || undefined}
                aria-describedby={errId}
                onChange={(e) => {
                  const n = e.target.value === "" ? 0 : Number(e.target.value);
                  onChange({ ...values, [p.id]: Math.max(0, Math.min(100, Number.isFinite(n) ? n : 0)) });
                }}
                className="min-w-0 flex-1 border-0 bg-transparent p-0 text-sm text-ink outline-none focus-visible:outline-none disabled:cursor-not-allowed disabled:text-ink-muted"
              />
              <span aria-hidden="true" className="text-[13px] text-ink-faint">
                %
              </span>
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
