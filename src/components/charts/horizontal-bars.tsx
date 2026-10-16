import { ChartFrame } from "@/components/charts/chart-frame";
import { cn } from "@/lib/cn";

/** Dimension averages 0-100 on 4px --line tracks. The weakest bar uses --improve and an amber label (plus a "Weakest" text tag). */
export function HorizontalBars({
  items,
  weakestId,
  ariaLabel,
  caption,
}: {
  items: { id: string; label: string; value: number }[];
  weakestId?: string;
  ariaLabel: string;
  caption: string;
}) {
  return (
    <ChartFrame
      caption={caption}
      table={{
        caption,
        columns: ["Dimension", "Average"],
        rows: items.map((i) => [i.id === weakestId ? `${i.label} (weakest)` : i.label, i.value]),
      }}
    >
      <div role="img" aria-label={ariaLabel} className="flex flex-col gap-3">
        {items.map((it) => {
          const weak = it.id === weakestId;
          const w = Math.max(0, Math.min(100, it.value));
          return (
            <div key={it.id} className="grid grid-cols-[140px_minmax(0,1fr)_36px] items-center gap-3 text-[13px] leading-5">
              <span className={weak ? "font-semibold text-improve-text" : "text-ink-muted"}>
                {it.label}
                {weak ? <span className="ml-1 text-[11px] font-semibold">· Weakest</span> : null}
              </span>
              <span aria-hidden="true" className="flex h-1 overflow-hidden rounded-sm bg-line">
                <span className={cn("block h-full rounded-sm", weak ? "bg-improve" : "bg-primary")} style={{ width: `${w}%` }} />
              </span>
              <span className={cn("text-right text-sm font-semibold", weak ? "text-improve-text" : "text-ink")}>{it.value}</span>
            </div>
          );
        })}
      </div>
    </ChartFrame>
  );
}
