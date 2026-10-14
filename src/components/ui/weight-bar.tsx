"use client";

import { useId } from "react";
import { Input } from "@/components/ui/input";

export type WeightPart = { id: string; label: string };

export function weightsValid(values: Record<string, number>): boolean {
  const total = Object.values(values).reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0);
  return Math.round(total * 100) === 10000;
}

export function WeightBar({
  label,
  parts,
  values,
  onChange,
}: {
  label: string;
  parts: WeightPart[];
  values: Record<string, number>;
  onChange: (v: Record<string, number>) => void;
}) {
  const uid = useId();
  const total = parts.reduce((a, p) => a + (values[p.id] || 0), 0);
  const valid = weightsValid(Object.fromEntries(parts.map((p) => [p.id, values[p.id] || 0])));
  const errId = `${uid}-total`;
  return (
    <div role="group" aria-label={label} className="flex flex-col gap-3">
      <div
        role="img"
        aria-label={`${label}: ${parts.map((p) => `${p.label} ${values[p.id] || 0}%`).join(", ")}`}
        className="flex h-7 gap-0.5 overflow-hidden rounded-sm text-xs font-semibold"
      >
        {parts.map((p, i) => {
          const v = values[p.id] || 0;
          if (v <= 0) return null;
          const n = (i % 4) + 1;
          return (
            <span
              key={p.id}
              style={{ flex: v, background: `var(--weight-${n})`, color: `var(--weight-${n}-on)` }}
              className="flex min-w-0 items-center overflow-hidden px-2 whitespace-nowrap"
            >
              {p.label} {v}%
            </span>
          );
        })}
      </div>
      <div className="flex flex-wrap items-end gap-3">
        {parts.map((p) => (
          <label key={p.id} className="flex flex-col gap-1 text-xs leading-4 text-ink-muted">
            {p.label}
            <span className="flex items-center gap-1.5">
              <Input
                type="number"
                min={0}
                max={100}
                step={1}
                inputMode="numeric"
                value={values[p.id] ?? 0}
                invalid={!valid}
                aria-describedby={errId}
                onChange={(e) => {
                  const n = e.target.value === "" ? 0 : Number(e.target.value);
                  onChange({ ...values, [p.id]: Math.max(0, Math.min(100, Number.isFinite(n) ? n : 0)) });
                }}
                className="w-20 text-right"
              />
              <span className="text-sm text-ink">%</span>
            </span>
          </label>
        ))}
      </div>
      <p
        id={errId}
        role="status"
        className={valid ? "text-xs leading-4 text-ink-muted" : "text-xs leading-4 font-medium text-improve-text"}
      >
        {valid ? "Total 100%" : `Total ${total}%. Must add up to 100%.`}
      </p>
    </div>
  );
}
