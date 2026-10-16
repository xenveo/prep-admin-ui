import { cn } from "@/lib/cn";

/**
 * Sub-scores on 4px --line tracks. "rows": label, bar, value on one line (compact panels).
 * "grid": the session dimension grid, label and 18px value above the bar, mint at 50+ and amber below.
 * Exposed as a table for assistive tech.
 */
export function SubScoreBars({
  scores,
  className,
  labelWidth = 76,
  layout = "rows",
}: {
  scores: { label: string; value: number; weight?: number }[];
  className?: string;
  /** Label column width in px for the "rows" layout; widen for longer labels such as "Clarity (written)". */
  labelWidth?: number;
  layout?: "rows" | "grid";
}) {
  const grid = layout === "grid";
  return (
    <div
      role="table"
      aria-label="Sub-scores"
      className={cn(
        grid ? "grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-3" : "flex flex-col gap-2.5",
        "text-[13px]",
        className,
      )}
    >
      {scores.map((s) => {
        const pct = Math.max(0, Math.min(100, s.value));
        const label = (
          <span role="rowheader" className="min-w-0 text-[13px] leading-5 text-ink-muted">
            {s.label}
            {s.weight != null ? <span className="sr-only"> weighted {s.weight}%</span> : null}
          </span>
        );
        const bar = (
          <span role="cell" aria-hidden="true" className="flex h-1 overflow-hidden rounded-sm bg-line">
            <span
              className={cn("block h-full rounded-sm", grid && s.value < 50 ? "bg-improve" : "bg-primary")}
              style={{ width: `${pct}%` }}
            />
          </span>
        );
        return grid ? (
          <div key={s.label} role="row" className="flex min-w-0 flex-col gap-2">
            <div className="flex items-baseline justify-between gap-2">
              {label}
              <span role="cell" className="text-lg font-semibold leading-6 text-ink">
                {s.value}
              </span>
            </div>
            {bar}
          </div>
        ) : (
          <div
            key={s.label}
            role="row"
            className="grid items-center gap-3"
            style={{ gridTemplateColumns: `${labelWidth}px minmax(0,1fr) 28px` }}
          >
            {label}
            {bar}
            <span role="cell" className="text-right font-semibold text-ink">
              {s.value}
            </span>
          </div>
        );
      })}
    </div>
  );
}
