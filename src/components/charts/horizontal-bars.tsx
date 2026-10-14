import { ChartFrame } from "@/components/charts/chart-frame";

/** Dimension averages 0-100. The weakest bar uses --improve and an amber label (plus a "Weakest" text tag). */
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
      <div role="img" aria-label={ariaLabel} className="flex flex-col gap-2.5">
        {items.map((it) => {
          const weak = it.id === weakestId;
          const w = Math.max(0, Math.min(100, it.value));
          return (
            <div key={it.id} className="grid grid-cols-[120px_minmax(0,1fr)_32px] items-center gap-3 text-[13px]">
              <span className={weak ? "font-semibold text-improve-text" : "text-ink"}>
                {it.label}
                {weak ? <span className="ml-1 text-[11px] font-semibold">· Weakest</span> : null}
              </span>
              <span aria-hidden="true" className="block h-2.5 overflow-hidden rounded-full bg-neutral-soft">
                <span
                  className="block h-full rounded-full"
                  style={{ width: `${w}%`, background: weak ? "var(--improve)" : "var(--primary)" }}
                />
              </span>
              <span className={`text-right font-semibold ${weak ? "text-improve-text" : "text-ink"}`}>{it.value}</span>
            </div>
          );
        })}
      </div>
    </ChartFrame>
  );
}
