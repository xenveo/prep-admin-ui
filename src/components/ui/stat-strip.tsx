import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type Stat = { label: string; value: ReactNode; tone?: "default" | "positive" | "attention"; note?: string };

const TONE = {
  default: "text-ink",
  positive: "text-primary-text",
  attention: "text-improve-text",
} as const;

export function StatStrip({ stats, className }: { stats: Stat[]; className?: string }) {
  return (
    <dl
      className={cn(
        "m-0 flex flex-wrap overflow-hidden rounded-md border border-line bg-surface",
        className,
      )}
    >
      {stats.map((s, i) => (
        <div
          key={s.label}
          className={cn("flex min-w-[140px] flex-1 flex-col gap-0.5 px-4 py-3", i > 0 && "border-l border-line")}
        >
          <dt className="text-xs leading-4 text-ink-muted">{s.label}</dt>
          <dd className={cn("m-0 text-xl font-semibold leading-7", TONE[s.tone ?? "default"])}>{s.value}</dd>
          {s.note ? <dd className="m-0 text-xs leading-4 text-ink-muted">{s.note}</dd> : null}
        </div>
      ))}
    </dl>
  );
}
