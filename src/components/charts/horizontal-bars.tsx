import { ChartFrame } from "@/components/charts/chart-frame";
import { cn } from "@/lib/cn";

/** Dimension averages 0-100 on 8px tracks. The weakest bar uses --improve, an amber label and a "Weakest" pill. */
export function HorizontalBars({
  items,
  weakestId,
  ariaLabel,
  caption,
  framed = true,
}: {
  items: { id: string; label: string; value: number }[];
  weakestId?: string;
  ariaLabel: string;
  caption: string;
  /** Wrap in a ChartFrame (caption + "Show as table"). Off when the card supplies its own heading. */
  framed?: boolean;
}) {
  const bars = (
    <div role="img" aria-label={ariaLabel} className="flex flex-col gap-3.5">
      {items.map((it) => {
        const weak = it.id === weakestId;
        const w = Math.max(0, Math.min(100, it.value));
        return (
          <div key={it.id} className="grid grid-cols-[130px_minmax(0,1fr)_32px] items-center gap-3.5 text-sm leading-5">
            <span
              className={cn(
                "flex items-center gap-2 whitespace-nowrap",
                weak ? "font-semibold text-improve-text" : "font-medium text-ink",
              )}
            >
              {it.label}
              {weak ? (
                <span className="rounded-full bg-improve-soft px-[7px] py-0.5 text-[11px] leading-4 font-bold text-improve-text">
                  Weakest
                </span>
              ) : null}
            </span>
            <span aria-hidden="true" className="flex h-2 overflow-hidden rounded bg-line">
              <span className={cn("block h-full rounded", weak ? "bg-improve" : "bg-primary")} style={{ width: `${w}%` }} />
            </span>
            <span className="text-right font-semibold text-ink">{it.value}</span>
          </div>
        );
      })}
    </div>
  );

  if (!framed) return bars;
  return (
    <ChartFrame
      caption={caption}
      table={{
        caption,
        columns: ["Dimension", "Average"],
        rows: items.map((i) => [i.id === weakestId ? `${i.label} (weakest)` : i.label, i.value]),
      }}
    >
      {bars}
    </ChartFrame>
  );
}
