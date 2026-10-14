import { cn } from "@/lib/cn";

/** 8px bars on a neutral-soft track, teal fill, value right-aligned. Exposed as a table for assistive tech. */
export function SubScoreBars({
  scores,
  className,
}: {
  scores: { label: string; value: number; weight?: number }[];
  className?: string;
}) {
  return (
    <div role="table" aria-label="Sub-scores" className={cn("flex flex-col gap-1.5 text-[13px]", className)}>
      {scores.map((s) => (
        <div
          key={s.label}
          role="row"
          className="grid grid-cols-[76px_minmax(0,1fr)_28px] items-center gap-2"
        >
          <span role="rowheader" className="text-[12px] text-ink">
            {s.label}
            {s.weight != null ? <span className="sr-only"> weighted {s.weight}%</span> : null}
          </span>
          <span role="cell" aria-hidden="true" className="block h-2 overflow-hidden rounded-full bg-neutral-soft">
            <span
              className="block h-full rounded-full"
              style={{ width: `${Math.max(0, Math.min(100, s.value))}%`, background: "var(--primary)" }}
            />
          </span>
          <span role="cell" className="text-right font-semibold text-ink">
            {s.value}
          </span>
        </div>
      ))}
    </div>
  );
}
